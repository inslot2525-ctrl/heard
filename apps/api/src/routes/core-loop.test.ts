// The core loop: pulse → flag → mentor opener. Weeks (2026): W45 = Nov 2–8, W46 = Nov 9–15,
// W47 = Nov 16–22, W48 = Nov 23–29.

import { MSG } from '@heard/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJoinCodes, provisionCampus } from '../campus.js';
import { flags } from '../db/schema.js';
import { testApp } from '../test-helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let codes: Awaited<ReturnType<typeof createJoinCodes>>;
const code = (role: string) => codes.find((c) => c.role === role)!.code;

const good = { studies: 2, money: 2, health: 2, home: 2 };
const moneyBad = { ...good, money: 0 };

async function join(role: string, name: string, lang = 'en') {
  const res = await t.req('POST', '/auth/join', { code: code(role), name, lang });
  return (await res.json()) as { session: string; user: { id: string } };
}
async function answer(session: string, week: string, levels: object, extra: object = {}) {
  const res = await t.req('POST', '/pulse', { week, levels, ...extra }, session);
  return { status: res.status, body: (await res.json()) as any };
}
const callsTo = (fn: string) => t.calls.filter((c) => c.fn === fn).map((c) => c.args[0] as any);

let mentor: Awaited<ReturnType<typeof join>>;
let student: Awaited<ReturnType<typeof join>>;

beforeEach(async () => {
  t = await testApp();
  await provisionCampus(t.db, t.chat, { id: 'c1', name: 'Campus', hostels: [{ id: 'hA', name: 'Hostel A' }] });
  codes = await createJoinCodes(t.db, 'c1');
  mentor = await join('mentor', 'Anil Rao', 'mr');
  student = await join('student', 'Priya Patil', 'mr');
  t.calls.length = 0;
});
afterEach(() => t.close());

describe('POST /pulse', () => {
  it('saves the answer and mirrors it into the chat as the student', async () => {
    t.clock.set('2026-11-04');
    const r = await answer(student.session, '2026-W45', good, { note: '  all fine  ' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ saved: { week: '2026-W45' }, mentorNotified: false });
    const [mirror] = callsTo('sendDirect');
    expect(mirror).toMatchObject({ from: student.user.id, to: ['c1bot'], messageType: MSG.PulseResponse, echo: true });
    expect(JSON.parse(mirror.content)).toMatchObject({ week: '2026-W45', note: 'all fine', levels: good });
  });

  it('rejects other weeks, bad levels and non-students', async () => {
    t.clock.set('2026-11-18');
    expect((await answer(student.session, '2026-W45', good)).body.error).toBe('bad_week');
    expect((await answer(student.session, '2026-W47', { ...good, money: 3 })).body.error).toBe('bad_levels');
    expect((await answer(mentor.session, '2026-W47', good)).status).toBe(403);
    expect((await answer(student.session, '2026-W46', good)).status).toBe(200); // last week is still open
  });

  it('lets a student change this week’s answer without duplicating it', async () => {
    t.clock.set('2026-11-04');
    await answer(student.session, '2026-W45', good);
    await answer(student.session, '2026-W45', moneyBad);
    const cur = (await (await t.req('GET', '/pulse/current', undefined, student.session)).json()) as any;
    expect(cur.answer.money).toBe(0);
  });
});

describe('flags', () => {
  async function twoBadWeeks() {
    t.clock.set('2026-11-04');
    await answer(student.session, '2026-W45', moneyBad);
    t.clock.set('2026-11-11');
    return answer(student.session, '2026-W46', moneyBad, { note: 'fees are late' });
  }

  it('opens a flag after two struggling weeks and sends the mentor a FlagCard', async () => {
    const r = await twoBadWeeks();
    expect(r.body.mentorNotified).toBe(true);
    const card = callsTo('sendDirect').find((c) => c.messageType === MSG.FlagCard);
    expect(card).toMatchObject({ from: 'c1bot', to: [mentor.user.id] });
    expect(JSON.parse(card.content)).toMatchObject({ studentId: student.user.id, studentName: 'Priya Patil', rule: 'repeat_struggling', studentWords: 'fees are late' });
  });

  it('does not open the same flag twice in a week', async () => {
    await twoBadWeeks();
    await answer(student.session, '2026-W46', moneyBad, { note: 'changed my note' });
    expect(await t.db.select().from(flags)).toHaveLength(1);
  });

  it('shows the mentor the flag with a draft in the mentor’s language', async () => {
    await twoBadWeeks();
    const list = (await (await t.req('GET', '/flags', undefined, mentor.session)).json()) as any[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ rule: 'repeat_struggling', area: 'money', status: 'open', student: { name: 'Priya Patil' } });
    expect(list[0].openerDraft).toContain('नमस्कार Priya'); // Marathi, first name only
    expect(list[0].openerDraft).toContain('पैसे');
  });

  it('keeps flags private to the student’s own mentor', async () => {
    await twoBadWeeks();
    const other = await join('mentor', 'Other Mentor');
    const [f] = await t.db.select().from(flags);
    expect(await (await t.req('GET', '/flags', undefined, other.session)).json()).toEqual([]);
    expect((await t.req('GET', `/flags/${f.id}`, undefined, other.session)).status).toBe(404);
    expect((await t.req('GET', '/flags', undefined, student.session)).status).toBe(403);
  });

  it('sends the edited opener as the mentor and marks the flag contacted', async () => {
    await twoBadWeeks();
    const [f] = await t.db.select().from(flags);
    t.calls.length = 0;
    const res = await t.req('POST', `/flags/${f.id}/opener`, { text: 'Hi Priya, shall we talk after dinner?' }, mentor.session);
    expect(res.status).toBe(200);
    expect(callsTo('sendDirect')[0]).toMatchObject({ from: mentor.user.id, to: [student.user.id], messageType: 'RC:TxtMsg', echo: true });
    const [after] = await t.db.select().from(flags).where(eq(flags.id, f.id));
    expect(after).toMatchObject({ status: 'contacted', openerSent: 'Hi Priya, shall we talk after dinner?' });
  });

  it('refuses openers with labels or diagnoses', async () => {
    await twoBadWeeks();
    const [f] = await t.db.select().from(flags);
    const res = await t.req('POST', `/flags/${f.id}/opener`, { text: 'Hi Priya, you seem depressed.' }, mentor.session);
    expect((await res.json()) as any).toEqual({ error: 'labels_or_diagnosis' });
  });

  it('needs a reason to dismiss, then closes the flag', async () => {
    await twoBadWeeks();
    const [f] = await t.db.select().from(flags);
    expect((await t.req('POST', `/flags/${f.id}/dismiss`, {}, mentor.session)).status).toBe(400);
    expect((await t.req('POST', `/flags/${f.id}/dismiss`, { reason: 'Talked in class already' }, mentor.session)).status).toBe(200);
    expect((await t.req('POST', `/flags/${f.id}/opener`, { text: 'Hi' }, mentor.session)).status).toBe(409);
  });

  it('flags "wants to talk" straight away', async () => {
    t.clock.set('2026-11-04');
    const r = await answer(student.session, '2026-W45', good, { wantsToTalk: true, note: 'internship' });
    expect(r.body.mentorNotified).toBe(true);
  });
});

describe('POST /pulse/rounds', () => {
  it('is warden-only and sends a PulseCard to every student', async () => {
    const warden = await join('warden', 'Sunita Shinde');
    const s2 = await join('student', 'Rohan Yadav');
    t.calls.length = 0;
    t.clock.set('2026-11-09');
    expect((await t.req('POST', '/pulse/rounds', {}, mentor.session)).status).toBe(403);
    const res = await t.req('POST', '/pulse/rounds', {}, warden.session);
    expect(await res.json()).toMatchObject({ week: '2026-W46', students: 2, sent: 2 });
    const card = callsTo('sendDirect').find((c) => c.messageType === MSG.PulseCard);
    expect(card.from).toBe('c1bot');
    expect(new Set(card.to)).toEqual(new Set([student.user.id, s2.user.id]));
    expect(JSON.parse(card.content)).toMatchObject({ week: '2026-W46', areas: ['studies', 'money', 'health', 'home'] });
  });

  it('catches students who went silent when the next round starts', async () => {
    const warden = await join('warden', 'Sunita Shinde');
    t.clock.set('2026-11-04');
    await answer(student.session, '2026-W45', good); // replied once
    // no replies in W46 or W47; the W48 round evaluates as of W47
    t.clock.set('2026-11-23');
    const res = (await (await t.req('POST', '/pulse/rounds', {}, warden.session)).json()) as any;
    expect(res.newFlags).toBe(1);
    const [f] = await t.db.select().from(flags);
    expect(f).toMatchObject({ rule: 'silent', week: '2026-W47', studentId: student.user.id });
  });
});

describe('GET /chats', () => {
  it('gives a student their mentor, hostel, notices and the assistant', async () => {
    const list = (await (await t.req('GET', '/chats', undefined, student.session)).json()) as any[];
    expect(list.map((x) => x.role)).toEqual(['mentor', 'hostel', 'notices', 'assistant']);
    expect(list[0]).toMatchObject({ kind: 'direct', peerId: mentor.user.id, title: 'Anil Rao' });
    expect(list.find((x) => x.role === 'notices').canPost).toBe(false);
    expect(list.some((x) => x.role === 'mentors')).toBe(false);
  });

  it('gives a mentor their students and the private mentors room', async () => {
    const list = (await (await t.req('GET', '/chats', undefined, mentor.session)).json()) as any[];
    expect(list[0]).toMatchObject({ kind: 'direct', peerId: student.user.id, role: 'student', peerLang: 'mr' });
    expect(list.some((x) => x.role === 'mentors')).toBe(true);
  });
});
