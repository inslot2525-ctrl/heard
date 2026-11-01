import { MSG } from '@heard/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJoinCodes, provisionCampus } from '../campus.js';
import { flags, safetyEvents } from '../db/schema.js';
import { sign } from '../nexconn.js';
import { testApp } from '../test-helpers.js';
import { textOf } from './webhooks.js';

let t: Awaited<ReturnType<typeof testApp>>;
let student: { session: string; user: { id: string } };
let mentor: { session: string; user: { id: string } };

beforeEach(async () => {
  t = await testApp();
  await provisionCampus(t.db, t.chat, { id: 'c1', name: 'Campus', hostels: [{ id: 'hA', name: 'Hostel A' }] });
  const codes = await createJoinCodes(t.db, 'c1');
  const join = async (role: string, name: string) =>
    (await (await t.req('POST', '/auth/join', { acceptedPrivacy: true,  code: codes.find((c) => c.role === role)!.code, name, lang: 'en' })).json()) as typeof student;
  mentor = await join('mentor', 'Anil Rao');
  student = await join('student', 'Priya Patil');
  t.calls.length = 0;
});
afterEach(() => t.close());

const settle = () => new Promise((r) => setTimeout(r, 200)); // processing happens after the 200 response

function post(body: unknown, opts: { secret?: string; appKey?: string; timestamp?: number } = {}) {
  const nonce = 'n0nce123';
  const timestamp = String(opts.timestamp ?? t.clock.now().getTime());
  return t.app.request('/webhooks/nexconn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      AppKey: opts.appKey ?? 'testkey',
      Nonce: nonce,
      Timestamp: timestamp,
      Signature: sign(opts.secret ?? 'testsecret', nonce, timestamp),
    },
    body: JSON.stringify(body),
  });
}

const sendEvent = (over: Partial<Record<string, unknown>> = {}) => ({
  type: 'message:send',
  id: 'evt-1',
  time: t.clock.now().getTime(),
  data: [
    {
      userId: student.user.id,
      channelId: mentor.user.id,
      messageType: 'RC:TxtMsg',
      content: JSON.stringify({ content: 'I want to die' }),
      channelType: 1,
      time: t.clock.now().getTime(),
      messageId: 'MSG-1',
      os: 'Websocket',
      ...over,
    },
  ],
});

describe('POST /webhooks/nexconn', () => {
  it('runs the safety path for a student’s risky message', async () => {
    expect((await post(sendEvent())).status).toBe(200);
    await settle();
    expect(await t.db.select().from(safetyEvents)).toHaveLength(1);
    expect((await t.db.select().from(flags))[0].rule).toBe('safety');
    expect(t.calls.some((c) => c.fn === 'sendDirect' && (c.args[0] as any).messageType === MSG.SafetyCard)).toBe(true);
  });

  it('alerts once per message, even if the app reports it too', async () => {
    await post(sendEvent());
    await post(sendEvent()); // Nexconn retry
    await t.req('POST', '/safety/check', { text: 'I want to die', messageId: 'MSG-1' }, student.session);
    await settle();
    expect(await t.db.select().from(safetyEvents)).toHaveLength(1);
    expect(t.calls.filter((c) => c.fn === 'sendDirect' && (c.args[0] as any).messageType === MSG.SafetyCard)).toHaveLength(1);
  });

  it('ignores ordinary messages, server-sent messages, non-students and non-text', async () => {
    await post(sendEvent({ content: JSON.stringify({ content: 'see you at dinner' }), messageId: 'A' }));
    await post(sendEvent({ os: 'Server', messageId: 'B' }));
    await post(sendEvent({ userId: mentor.user.id, messageId: 'C' }));
    await post(sendEvent({ messageType: 'RC:ImgMsg', messageId: 'D' }));
    await settle();
    expect(await t.db.select().from(safetyEvents)).toHaveLength(0);
  });

  it('rejects bad signatures, wrong App Keys and stale timestamps', async () => {
    expect((await post(sendEvent(), { secret: 'wrong' })).status).toBe(401);
    expect((await post(sendEvent(), { appKey: 'otherapp' })).status).toBe(401);
    expect((await post(sendEvent(), { timestamp: t.clock.now().getTime() - 10 * 60_000 })).status).toBe(401);
    await settle();
    expect(await t.db.select().from(safetyEvents)).toHaveLength(0);
  });

  it('acknowledges other event types without doing anything', async () => {
    expect((await post({ type: 'user:connection_status', id: 'e', time: 1, data: [{ status: '0', userId: 'x' }] })).status).toBe(200);
  });
});

describe('textOf', () => {
  it('reads the text from an RC:TxtMsg body', () => {
    expect(textOf({ messageType: 'RC:TxtMsg', content: '{"content":"hi","extra":""}' } as any)).toBe('hi');
    expect(textOf({ messageType: 'RC:TxtMsg', content: 'not json' } as any)).toBeNull();
  });
});

describe('routing', () => {
  it('does not require a user session for the webhook, but still does for app routes', async () => {
    expect((await post({ type: 'noop', id: 'e', time: 1, data: [] })).status).toBe(200);
    expect((await t.req('POST', '/translate', { text: 'x', to: 'en' })).status).toBe(401);
    expect((await t.req('POST', '/safety/check', { text: 'x' })).status).toBe(401);
  });
});
