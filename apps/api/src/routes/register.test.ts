import { afterEach, describe, expect, it } from 'vitest';
import { createJoinCodes, provisionCampus } from '../campus.js';
import { matchName, parseScan, weeksOfMonth } from '../register.js';
import { fakeLlm, testApp } from '../test-helpers.js';

let t: Awaited<ReturnType<typeof testApp>> | undefined;
afterEach(async () => {
  await t?.close();
  t = undefined;
});

async function setup(reply: (system: string, user: string) => string = () => '{}') {
  const fake = fakeLlm(reply);
  t = await testApp({ llm: fake.llm });
  await provisionCampus(t!.db, t.chat, { id: 'c1', name: 'Campus', hostels: [{ id: 'hA', name: 'Hostel A' }] });
  const codes = await createJoinCodes(t!.db, 'c1');
  const join = async (role: string, name: string, lang = 'en') =>
    (await (await t!.req('POST', '/auth/join', { acceptedPrivacy: true, code: codes.find((c) => c.role === role)!.code, name, lang })).json()) as { session: string; user: { id: string } };
  const warden = await join('warden', 'Warden');
  const mentor = await join('mentor', 'Anil Rao');
  const priya = await join('student', 'Priya Patil', 'mr');
  const rohan = await join('student', 'Rohan Yadav', 'hi');
  return { fake, warden, mentor, priya, rohan };
}

const steady = { attendance: 92, academics: 80, duties: 90, activities: 12, conduct: 0 };

describe('hostel register', () => {
  it('helpers: weeks of a month, name matching, scan parsing', () => {
    expect(weeksOfMonth('2026-11')).toEqual(['2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49']);
    const people = [
      { id: 'a', name: 'Priya Patil' },
      { id: 'b', name: 'Priya Shah' },
      { id: 'c', name: 'Rohan Yadav' },
    ];
    expect(matchName('PRIYA  PATIL', people)).toEqual({ studentId: 'a', match: 'exact' });
    expect(matchName('Rohan Y.', people)).toEqual({ studentId: 'c', match: 'close' });
    expect(matchName('Priya', people)).toEqual({ studentId: null, match: 'none' }); // two Priyas: never guess
    const rows = parseScan('```json\n{"rows":[{"name":"Rohan Yadav","attendance":"71%","conduct":null,"remarks":"late twice"},{"name":""}]}\n```', people);
    expect(rows).toEqual([{ name: 'Rohan Yadav', studentId: 'c', match: 'exact', values: { attendance: 71, academics: null, duties: null, activities: null, conduct: null }, remarks: 'late twice' }]);
  });

  it('warden saves months; a three-month decline opens one flag for the mentor with the evidence', async () => {
    const { warden, mentor, priya, rohan } = await setup();
    const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
    const att = [92, 92, 88, 80, 72, 61];
    for (const [i, month] of months.entries()) {
      const r = await t!.req('PUT', '/register', { month, rows: [{ studentId: priya.user.id, ...steady, attendance: att[i] }, { studentId: rohan.user.id, ...steady }] }, warden.session);
      expect(r.status).toBe(200);
    }
    const flags = (await (await t!.req('GET', '/flags?status=open', undefined, mentor.session)).json()) as any[];
    expect(flags).toHaveLength(1);
    // It first fired in October; November's save refreshed the same card instead of opening another.
    expect(flags[0]).toMatchObject({ rule: 'register_decline', area: 'attendance', week: '2026-10' });
    expect(flags[0].reason).toContain('88% → 80% → 72% → 61%');
    expect(flags[0].evidence.registerHistory).toHaveLength(6);
    expect(flags[0].openerDraft).toContain('class attendance');
    expect(t!.calls.some((c) => c.fn === 'sendDirect' && (c.args[0] as any).to[0] === mentor.user.id)).toBe(true);

    // Saving the same month again doesn't duplicate the flag.
    await t!.req('PUT', '/register', { month: '2026-11', rows: [{ studentId: priya.user.id, ...steady, attendance: 61 }] }, warden.session);
    expect(((await (await t!.req('GET', '/flags?status=open', undefined, mentor.session)).json()) as any[]).length).toBe(1);

    // The sheet shows saved values; students only see nothing.
    const sheet = (await (await t!.req('GET', '/register?month=2026-11', undefined, warden.session)).json()) as any;
    expect(sheet.students.find((s: any) => s.id === priya.user.id).row.attendance).toBe(61);
    expect((await t!.req('GET', '/register', undefined, priya.session)).status).toBe(403);
    expect((await t!.req('PUT', '/register', { month: '2026-11', rows: [] }, mentor.session)).status).toBe(403);
  });

  it('rejects other campuses, bad months and future months', async () => {
    const { warden, priya } = await setup();
    const r = (await (await t!.req('PUT', '/register', { month: '2026-11', rows: [{ studentId: 'someone-else', attendance: 50 }, { studentId: priya.user.id, attendance: 80 }] }, warden.session)).json()) as any;
    expect(r).toMatchObject({ saved: 1, skipped: 1 });
    expect((await t!.req('PUT', '/register', { month: '2026-13', rows: [] }, warden.session)).status).toBe(400);
    expect((await t!.req('PUT', '/register', { month: '2027-01', rows: [] }, warden.session)).status).toBe(400);
  });

  it('perception gap: the register says one thing, their own check-ins another', async () => {
    const { warden, mentor, priya } = await setup();
    t!.clock.set('2026-11-04');
    await t!.req('POST', '/pulse', { week: '2026-W45', levels: { studies: 2, money: 2, health: 2, home: 2 } }, priya.session);
    for (const [month, a] of [['2026-09', 90], ['2026-10', 88], ['2026-11', 55]] as const) {
      await t!.req('PUT', '/register', { month, rows: [{ studentId: priya.user.id, attendance: a }] }, warden.session);
    }
    const [flag] = (await (await t!.req('GET', '/flags?status=open', undefined, mentor.session)).json()) as any[];
    expect(flag.rule).toBe('register_drop');
    expect(flag.evidence.perceptionGap).toContain('"good" 1 of 1');
  });

  it('photo scan returns rows to check; nothing is saved until the warden saves', async () => {
    const { warden, priya } = await setup(() => '{"rows":[{"name":"Priya Patil","attendance":81,"activities":"9"}]}');
    const r = (await (await t!.req('POST', '/register/scan', { month: '2026-11', image: { mimeType: 'image/jpeg', data: 'aGVsbG8=' } }, warden.session)).json()) as any;
    expect(r.rows[0]).toMatchObject({ studentId: priya.user.id, match: 'exact', values: { attendance: 81, activities: 9 } });
    const sheet = (await (await t!.req('GET', '/register?month=2026-11', undefined, warden.session)).json()) as any;
    expect(sheet.students.every((s: any) => s.row === null)).toBe(true);
    expect((await t!.req('POST', '/register/scan', { month: '2026-11', image: { mimeType: 'application/pdf', data: 'x' } }, warden.session)).status).toBe(400);
  });

  it('mentor: targets resolve the flag when met; the review is advisory and the mentor decides', async () => {
    const { warden, mentor, priya, rohan } = await setup();
    for (const [month, a] of [['2026-09', 14], ['2026-10', 13], ['2026-11', 3]] as const) {
      await t!.req('PUT', '/register', { month, rows: [{ studentId: priya.user.id, ...steady, activities: a }] }, warden.session);
    }
    const [flag] = (await (await t!.req('GET', '/flags?status=open', undefined, mentor.session)).json()) as any[];
    expect(flag.rule).toBe('register_drop');
    // A target for this month or later only, and only for my own students.
    expect((await t!.req('POST', `/register/students/${priya.user.id}/targets`, { metric: 'activities', month: '2026-10', goal: 10 }, mentor.session)).status).toBe(400);
    t!.clock.set('2026-12-02');
    const set = await t!.req('POST', `/register/students/${priya.user.id}/targets`, { metric: 'activities', month: '2026-12', goal: 10, flagId: flag.id }, mentor.session);
    expect(set.status).toBe(200);
    await t!.req('PUT', '/register', { month: '2026-12', rows: [{ studentId: priya.user.id, ...steady, activities: 11 }] }, warden.session);
    const view = (await (await t!.req('GET', `/register/students/${priya.user.id}?month=2026-12`, undefined, mentor.session)).json()) as any;
    expect(view.targets[0]).toMatchObject({ metric: 'activities', goal: 10, value: 11, met: true });
    const after = (await (await t!.req('GET', '/flags?status=resolved', undefined, mentor.session)).json()) as any[];
    expect(after.map((f) => f.id)).toContain(flag.id);

    expect(view.review.suggestion).toBe('continue');
    expect((await t!.req('POST', `/register/students/${priya.user.id}/review`, { decision: 'continue', reason: 'ok' }, mentor.session)).status).toBe(400);
    const d = (await (await t!.req('POST', `/register/students/${priya.user.id}/review`, { month: '2026-12', decision: 'continue', reason: 'Activities back up after the target; no other concerns.' }, mentor.session)).json()) as any;
    expect(d.decision).toMatchObject({ decision: 'continue', suggestionShown: 'continue' });

    expect((await t!.req('GET', `/register/students/${rohan.user.id}`, undefined, warden.session)).status).toBe(403);
  });
});
