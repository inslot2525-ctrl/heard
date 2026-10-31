import { MSG } from '@heard/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createJoinCodes, provisionCampus } from '../campus.js';
import { flags, safetyEvents } from '../db/schema.js';
import { LlmError } from '../llm.js';
import { fakeLlm, testApp } from '../test-helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
afterEach(() => t?.close());

async function setup(reply: (system: string, user: string) => string) {
  const fake = fakeLlm(reply);
  t = await testApp({ llm: fake.llm });
  // heardDemo has a handbook in data/handbook
  await provisionCampus(t.db, t.chat, { id: 'heardDemo', name: 'Demo', hostels: [{ id: 'hostelA', name: 'Hostel A' }] });
  const codes = await createJoinCodes(t.db, 'heardDemo');
  const join = async (role: string, name: string, lang: string) =>
    (await (await t.req('POST', '/auth/join', { code: codes.find((c) => c.role === role)!.code, name, lang })).json()) as { session: string; user: { id: string } };
  const mentor = await join('mentor', 'Anil Rao', 'en');
  const warden = await join('warden', 'Sunita Shinde', 'mr');
  const student = await join('student', 'Priya Patil', 'mr');
  t.calls.length = 0;
  return { fake, mentor, warden, student };
}
const sends = () => t.calls.filter((c) => c.fn === 'sendDirect' || c.fn === 'sendDirectText');

describe('POST /assistant/ask', () => {
  it('answers from the handbook, in the student’s language, as the campus bot', async () => {
    const { fake, student } = await setup(() => 'रात्रीचे जेवण 7:30 ते 9:30 या वेळेत असते.');
    const res = (await (await t.req('POST', '/assistant/ask', { text: 'dinner kab hai?' }, student.session)).json()) as any;
    expect(res.outcome).toBe('answered');
    expect(fake.calls[0].system).toContain('Mess');
    expect(fake.calls[0].system).toContain('Marathi');
    expect(t.calls.find((c) => c.fn === 'sendDirectText')!.args).toEqual(['heardDemobot', student.user.id, 'रात्रीचे जेवण 7:30 ते 9:30 या वेळेत असते.']);
  });

  it('hands off to the mentor with a flag when the model says HANDOFF', async () => {
    const { mentor, student } = await setup(() => 'HANDOFF');
    const res = (await (await t.req('POST', '/assistant/ask', { text: 'I am scared about my results' }, student.session)).json()) as any;
    expect(res.outcome).toBe('handoff');
    const [f] = await t.db.select().from(flags);
    expect(f).toMatchObject({ rule: 'asked_for_help', mentorId: mentor.user.id });
    expect((f.evidence as any).studentWords).toBe('I am scared about my results');
    const card = sends().find((c) => (c.args[0] as any).messageType === MSG.FlagCard);
    expect((card!.args[0] as any).to).toEqual([mentor.user.id]);
  });

  it('runs the safety path before any AI, and never asks the model', async () => {
    const { fake, mentor, warden, student } = await setup(() => 'should not be called');
    const res = (await (await t.req('POST', '/assistant/ask', { text: 'I want to die' }, student.session)).json()) as any;
    expect(res.outcome).toBe('safety');
    expect(fake.calls).toHaveLength(0);
    expect(await t.db.select().from(safetyEvents)).toHaveLength(1);
    const helpline = sends().find((c) => (c.args[0] as any).messageType === MSG.SafetyCard)!.args[0] as any;
    expect(helpline.to).toEqual([student.user.id]);
    expect(JSON.parse(helpline.content).helplines[0].number).toBe('14416');
    const alert = sends().find((c) => (c.args[0] as any).messageType === 'RC:TxtMsg')!.args[0] as any;
    expect(new Set(alert.to)).toEqual(new Set([mentor.user.id, warden.user.id]));
    const [f] = await t.db.select().from(flags).where(eq(flags.studentId, student.user.id));
    expect(f.rule).toBe('safety');
  });

  it('says it is unavailable (and does not hand off) when every model fails', async () => {
    const { student } = await setup(() => {
      throw new LlmError('down');
    });
    const res = (await (await t.req('POST', '/assistant/ask', { text: 'wifi password?' }, student.session)).json()) as any;
    expect(res.outcome).toBe('unavailable');
    expect(await t.db.select().from(flags)).toHaveLength(0);
  });

  it('is for students only', async () => {
    const { mentor } = await setup(() => 'x');
    expect((await t.req('POST', '/assistant/ask', { text: 'hi' }, mentor.session)).status).toBe(403);
  });
});

describe('safety on other paths', () => {
  it('POST /safety/check alerts on a risky chat message, and ignores ordinary ones', async () => {
    const { student } = await setup(() => 'x');
    expect(await (await t.req('POST', '/safety/check', { text: 'see you at dinner' }, student.session)).json()).toEqual({ alerted: false });
    expect(await (await t.req('POST', '/safety/check', { text: 'seniors keep ragging us' }, student.session)).json()).toEqual({ alerted: true });
    const [f] = await t.db.select().from(flags);
    expect(f.rule).toBe('safety_ragging');
  });

  it('checks check-in notes too', async () => {
    const { student } = await setup(() => 'x');
    const week = ((await (await t.req('GET', '/pulse/current', undefined, student.session)).json()) as any).week;
    await t.req('POST', '/pulse', { week, levels: { studies: 2, money: 2, health: 0, home: 2 }, note: 'मला आता जगायचं नाही' }, student.session);
    expect(await t.db.select().from(safetyEvents)).toHaveLength(1);
  });
});

describe('POST /translate', () => {
  it('translates with the LLM and caches repeats', async () => {
    const { fake, student } = await setup((_s, user) => (user.includes('mr') ? 'नमस्कार' : 'Hello'));
    const a = (await (await t.req('POST', '/translate', { text: 'Hello', to: 'mr' }, student.session)).json()) as any;
    const b = (await (await t.req('POST', '/translate', { text: 'Hello', to: 'mr' }, student.session)).json()) as any;
    expect(a).toEqual({ text: 'नमस्कार' });
    expect(b).toEqual({ text: 'नमस्कार', cached: true });
    expect(fake.calls).toHaveLength(1);
  });

  it('rejects unknown languages and needs a session', async () => {
    const { student } = await setup(() => 'x');
    expect((await t.req('POST', '/translate', { text: 'hi', to: 'xx' }, student.session)).status).toBe(400);
    expect((await t.req('POST', '/translate', { text: 'hi', to: 'mr' })).status).toBe(401);
  });
});
