import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJoinCodes, provisionCampus } from '../campus.js';
import { invites, mentorAssignments, users } from '../db/schema.js';
import { testApp, TEST_PASSCODE } from '../test-helpers.js';

let t: Awaited<ReturnType<typeof testApp>>;
let codes: Awaited<ReturnType<typeof createJoinCodes>>;
const code = (role: string, hostel?: string) => codes.find((c) => c.role === role && (!hostel || c.hostel === hostel))!.code;

beforeEach(async () => {
  t = await testApp();
  await provisionCampus(t.db, t.chat, { id: 'testcampus', name: 'Test Campus', hostels: [{ id: 'hostelA', name: 'Hostel A' }] });
  codes = await createJoinCodes(t.db, 'testcampus');
  t.calls.length = 0;
});
afterEach(() => t.close());

async function join(c: string, name = 'Priya', lang = 'mr') {
  const res = await t.req('POST', '/auth/join', { code: c, name, lang });
  return { status: res.status, body: (await res.json()) as any };
}

describe('POST /auth/join', () => {
  it('creates a student in the code’s hostel, joins the community, and returns a session', async () => {
    const r = await join(code('student', 'Hostel A'));
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ role: 'student', name: 'Priya', lang: 'mr', campusId: 'testcampus', hostelId: 'testcampushostelA' });
    expect(r.body.user.id).toMatch(/^s[a-z0-9]{10}$/);
    expect(t.calls.map((c) => c.fn)).toEqual(['issueAccessToken', 'joinCommunity']);
  });

  it('accepts lower-case codes and trims names', async () => {
    const r = await join(code('student').toLowerCase(), '  Priya   P  ');
    expect(r.body.user.name).toBe('Priya P');
  });

  it('adds mentors to the private mentors room and gives them unassigned students', async () => {
    const s = await join(code('student'));
    const m = await join(code('mentor'), 'Mr Rao', 'en');
    expect(t.calls.filter((c) => c.fn === 'addPrivateSubchannelMembers')[0].args).toEqual(['testcampus', 'mentors', [m.body.user.id]]);
    const [a] = await t.db.select().from(mentorAssignments).where(eq(mentorAssignments.studentId, s.body.user.id));
    expect(a.mentorId).toBe(m.body.user.id);
  });

  it('assigns new students to the mentor with the fewest students', async () => {
    const m1 = await join(code('mentor'), 'Mentor One');
    await join(code('student'), 'S1');
    const m2 = await join(code('mentor'), 'Mentor Two');
    const s2 = await join(code('student'), 'S2');
    const [a] = await t.db.select().from(mentorAssignments).where(eq(mentorAssignments.studentId, s2.body.user.id));
    expect(a.mentorId).toBe(m2.body.user.id);
    expect(m1.body.user.id).not.toBe(m2.body.user.id);
  });

  it('rejects unknown, used-up and expired codes', async () => {
    expect((await join('NOPE-1234')).status).toBe(404);
    await t.db.update(invites).set({ maxUses: 1 }).where(eq(invites.code, code('warden')));
    expect((await join(code('warden'), 'W1')).status).toBe(200);
    expect((await join(code('warden'), 'W2')).status).toBe(404);
    await t.db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.code, code('mentor')));
    expect((await join(code('mentor'), 'Mentor M')).status).toBe(404);
  });

  it('needs a name', async () => {
    expect((await join(code('student'), ' ')).status).toBe(400);
  });
});

describe('sessions', () => {
  it('/auth/me returns the user, campus, hostel and mentor', async () => {
    const m = await join(code('mentor'), 'Mr Rao');
    const s = await join(code('student'), 'Priya');
    const res = await t.req('GET', '/auth/me', undefined, s.body.session);
    const me = (await res.json()) as any;
    expect(me.user.id).toBe(s.body.user.id);
    expect(me.campus.name).toBe('Test Campus');
    expect(me.hostel.name).toBe('Hostel A');
    expect(me.mentor).toEqual({ id: m.body.user.id, name: 'Mr Rao' });
  });

  it('rejects missing and forged sessions', async () => {
    expect((await t.req('GET', '/auth/me')).status).toBe(401);
    expect((await t.req('GET', '/auth/me', undefined, 'not.a.jwt')).status).toBe(401);
  });

  it('/auth/nexconn-token issues a token for the session user only', async () => {
    const s = await join(code('student'));
    const res = await t.req('POST', '/auth/nexconn-token', {}, s.body.session);
    expect(await res.json()).toEqual({ userId: s.body.user.id, token: `tok-${s.body.user.id}` });
  });
});

describe('POST /auth/demo-login', () => {
  it('only works for demo users with the passcode', async () => {
    await t.db.insert(users).values({ id: 'demopriya', campusId: 'testcampus', role: 'student', name: 'Priya', isDemo: true });
    await t.db.insert(users).values({ id: 'realuser', campusId: 'testcampus', role: 'student', name: 'Real' });
    expect((await t.req('POST', '/auth/demo-login', { passcode: 'wrong', userId: 'demopriya' })).status).toBe(401);
    expect((await t.req('POST', '/auth/demo-login', { passcode: TEST_PASSCODE, userId: 'realuser' })).status).toBe(404);
    const ok = await t.req('POST', '/auth/demo-login', { passcode: TEST_PASSCODE, userId: 'demopriya' });
    expect(ok.status).toBe(200);
  });

  it('never lets anyone log in as the bot', async () => {
    expect((await t.req('POST', '/auth/demo-login', { passcode: TEST_PASSCODE, userId: 'testcampusbot' })).status).toBe(404);
  });
});
