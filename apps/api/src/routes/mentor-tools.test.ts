import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJoinCodes, provisionCampus } from '../campus.js';
import { safetyEvents } from '../db/schema.js';
import { fakeLlm, testApp } from '../test-helpers.js';
import { parseTone } from '../tone.js';
import { parseVoice, voiceUrlAllowed } from '../voice.js';

let t: Awaited<ReturnType<typeof testApp>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

async function setup(reply: (system: string, user: string) => string, voiceFetch?: typeof fetch) {
  const fake = fakeLlm(reply);
  t = await testApp({ llm: fake.llm, voiceFetch });
  await provisionCampus(t!.db, t.chat, { id: 'c1', name: 'Campus', hostels: [{ id: 'hA', name: 'Hostel A' }] });
  const codes = await createJoinCodes(t!.db, 'c1');
  const join = async (role: string, name: string, lang: string) =>
    (await (await t!.req('POST', '/auth/join', { acceptedPrivacy: true, code: codes.find((c) => c.role === role)!.code, name, lang })).json()) as { session: string; user: { id: string } };
  return { fake, mentor: await join('mentor', 'Anil Rao', 'en'), student: await join('student', 'Priya Patil', 'mr') };
}

describe('Tone Guard', () => {
  it('parses OK and JSON replies, and ignores junk', () => {
    expect(parseTone('OK')).toEqual({ ok: true, issues: [] });
    expect(parseTone('```json\n{"issues":["blames the student"],"suggestion":"Shall we talk?"}\n```')).toEqual({ ok: false, issues: ['blames the student'], suggestion: 'Shall we talk?' });
    expect(parseTone('hmm')).toEqual({ ok: true, issues: [] });
  });

  it('POST /tone returns a suggestion for a judgemental message (mentors only)', async () => {
    const { fake, mentor, student } = await setup(() => '{"issues":["calls the student lazy"],"suggestion":"I noticed you missed some classes. Can we talk?"}');
    const r = (await (await t!.req('POST', '/tone', { text: 'You are so lazy, why do you skip class?' }, mentor.session)).json()) as any;
    expect(r).toMatchObject({ ok: false, checked: true, suggestion: 'I noticed you missed some classes. Can we talk?' });
    expect(fake.calls[0].user).toContain('English');
    expect((await t!.req('POST', '/tone', { text: 'hi' }, student.session)).status).toBe(403);
  });

  it('catches fixed labels without asking the model', async () => {
    const { fake, mentor } = await setup(() => 'OK');
    const r = (await (await t!.req('POST', '/tone', { text: 'You seem depressed' }, mentor.session)).json()) as any;
    expect(r.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('voice notes', () => {
  const url = 'https://bucket7-b-2.ronghub.com/2__RC-voice.webm';
  const audioFetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-type': 'audio/webm' } })) as unknown as typeof fetch;

  it('only fetches https URLs from allowed hosts', () => {
    const hosts = ['ronghub.com'];
    expect(voiceUrlAllowed(url, hosts)).toBe(true);
    expect(voiceUrlAllowed('http://bucket7-b-2.ronghub.com/a.webm', hosts)).toBe(false);
    expect(voiceUrlAllowed('https://evil.com/ronghub.com.webm', hosts)).toBe(false);
    expect(voiceUrlAllowed('https://ronghub.com.evil.com/a', hosts)).toBe(false);
  });

  it('parses the model reply', () => {
    expect(parseVoice('{"transcript":"हो सर","language":"mr","translation":"Yes sir"}')).toEqual({ transcript: 'हो सर', language: 'mr', translation: 'Yes sir' });
    expect(parseVoice('nope')).toBeNull();
  });

  it('transcribes and translates for the reader, sending the audio to the model, and caches it', async () => {
    const { fake, mentor } = await setup(() => '{"transcript":"मला घरची आठवण येते","language":"mr","translation":"I miss home"}', audioFetch);
    const a = (await (await t!.req('POST', '/voice/transcribe', { url }, mentor.session)).json()) as any;
    expect(a).toMatchObject({ transcript: 'मला घरची आठवण येते', translation: 'I miss home', alerted: false });
    expect(fake.calls[0].audio).toEqual({ mimeType: 'audio/webm', data: Buffer.from([1, 2, 3, 4]).toString('base64') });
    expect(fake.calls[0].user).toContain('English');
    await t!.req('POST', '/voice/transcribe', { url }, mentor.session);
    expect(fake.calls).toHaveLength(1);
  });

  it('refuses other hosts', async () => {
    const { mentor } = await setup(() => '{}', audioFetch);
    expect((await t!.req('POST', '/voice/transcribe', { url: 'https://example.com/a.webm' }, mentor.session)).status).toBe(400);
  });

  it('runs the safety check when a student transcribes their own note', async () => {
    const { student } = await setup(() => '{"transcript":"मला आता जगायचं नाही","language":"mr","translation":"मला आता जगायचं नाही"}', audioFetch);
    const r = (await (await t!.req('POST', '/voice/transcribe', { url, own: true, messageId: 'V1' }, student.session)).json()) as any;
    expect(r.alerted).toBe(true);
    expect(await t!.db.select().from(safetyEvents)).toHaveLength(1);
  });
});

describe('POST /mentor/ask', () => {
  it('answers from my students only, checks receipts, and sends the card from the bot', async () => {
    const { fake, mentor, student } = await setup(() =>
      JSON.stringify({ answer: 'Priya has not checked in yet.', receipts: [{ student: 'Priya Patil', week: '2026-W45', area: 'checkin', value: 'no reply' }, { student: 'Someone Else', week: '2026-W45', area: 'money', value: 'good' }] }),
    );
    const r = (await (await t!.req('POST', '/mentor/ask', { text: 'Who has not checked in?' }, mentor.session)).json()) as any;
    expect(r.answer).toBe('Priya has not checked in yet.');
    expect(r.receipts.map((x: any) => x.verified)).toEqual([true, false]);
    expect(fake.calls[0].system).toContain('STUDENT Priya Patil');
    expect(fake.calls[0].system).toContain('English');
    const card = t!.calls.find((c) => c.fn === 'sendDirect' && (c.args[0] as any).messageType === 'SA:AskAnswer')!.args[0] as any;
    expect(card).toMatchObject({ from: 'c1bot', to: [mentor.user.id] });
    expect((await t!.req('POST', '/mentor/ask', { text: 'hi' }, student.session)).status).toBe(403);
  });
});

describe('POST /mentor/meeting-card', () => {
  it('builds a card for my own flag only', async () => {
    const { mentor, student } = await setup(() =>
      JSON.stringify({ strengths: [], changes: [], questions: ['What would help most right now?'], avoid: ['Lecturing'] }),
    );
    t!.clock.set('2026-11-04');
    await t!.req('POST', '/pulse', { week: '2026-W45', levels: { studies: 2, money: 2, health: 2, home: 2 }, wantsToTalk: true }, student.session);
    const flag = ((await (await t!.req('GET', '/flags', undefined, mentor.session)).json()) as any[])[0];
    const card = (await (await t!.req('POST', '/mentor/meeting-card', { flagId: flag.id }, mentor.session)).json()) as any;
    expect(card).toMatchObject({ student: 'Priya Patil', questions: ['What would help most right now?'], avoid: ['Lecturing'] });
    expect((await t!.req('POST', '/mentor/meeting-card', { flagId: 'nope' }, mentor.session)).status).toBe(404);
    expect((await t!.req('POST', '/mentor/meeting-card', { flagId: flag.id }, student.session)).status).toBe(403);
  });
});
