// Hostel register routes.
//   Warden:  GET  /register?month=&hostelId=   the month's sheet for their campus
//            PUT  /register                     save rows (runs the register rules)
//            POST /register/scan                read a photo of the paper register (nothing saved)
//   Mentor:  GET  /register/students/:id        6 months of records, targets, six-month review
//            POST /register/students/:id/targets    set a next-month target
//            POST /register/students/:id/review     record the review decision (mentor decides)

import { lastMonths, METRICS, monthOf, sixMonthReview, type Metric, type Month } from '@heard/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Chat } from '../chat.js';
import type { Db } from '../db/client.js';
import { flags, hostels, mentorAssignments, registerRows, reviewDecisions, targets, users } from '../db/schema.js';
import { newId } from '../ids.js';
import type { Llm } from '../llm.js';
import { rateLimit } from '../rate-limit.js';
import { loadRegister, saveRegister, scanRegister, targetsWithStatus, type RowInput } from '../register.js';
import { requireSession, type AuthVars } from '../session.js';
import { requireRole } from '../session-guards.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_IMAGE_B64 = 8_000_000; // ≈6 MB image

export function registerRoutes({ db, chat, llm, sessionSecret, now }: { db: Db; chat: Chat | null; llm: Llm | null; sessionSecret: string; now: () => Date }) {
  const r = new Hono<AuthVars>();
  r.use('*', requireSession(sessionSecret));

  const monthParam = (m: string | undefined): Month | null => (m && MONTH_RE.test(m) ? m : null);

  async function campusStudents(campusId: string, hostelId?: string | null) {
    return db
      .select({ id: users.id, name: users.name, hostelId: users.hostelId, hostel: hostels.name })
      .from(users)
      .leftJoin(hostels, eq(hostels.id, users.hostelId))
      .where(and(eq(users.campusId, campusId), eq(users.role, 'student'), ...(hostelId ? [eq(users.hostelId, hostelId)] : [])))
      .orderBy(asc(users.name));
  }

  // ---- warden ----------------------------------------------------------------------------------------

  r.get('/', requireRole('warden'), async (c) => {
    const month = monthParam(c.req.query('month')) ?? monthOf(now());
    const students = await campusStudents(c.get('session').campusId, c.req.query('hostelId'));
    const rows = await db.select().from(registerRows).where(eq(registerRows.month, month));
    const hostelList = await db.select({ id: hostels.id, name: hostels.name }).from(hostels).where(eq(hostels.campusId, c.get('session').campusId)).orderBy(asc(hostels.name));
    return c.json({
      month,
      hostels: hostelList,
      students: students.map((s) => {
        const row = rows.find((x) => x.studentId === s.id);
        return { ...s, row: row ? { ...Object.fromEntries(METRICS.map((m) => [m, row[m]])), remarks: row.remarks, source: row.source } : null };
      }),
    });
  });

  r.put('/', requireRole('warden'), async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { month?: string; rows?: RowInput[]; source?: string };
    const month = monthParam(body.month);
    if (!month) return c.json({ error: 'bad_month' }, 400);
    if (month > monthOf(now())) return c.json({ error: 'future_month' }, 400);
    if (!Array.isArray(body.rows) || body.rows.length > 500) return c.json({ error: 'bad_rows' }, 400);
    const s = c.get('session');
    const result = await saveRegister(db, chat, { campusId: s.campusId, month, rows: body.rows, enteredBy: s.sub, source: body.source === 'photo' ? 'photo' : 'manual' });
    return c.json(result);
  });

  r.post('/scan', requireRole('warden'), rateLimit({ max: 30, windowMs: 10 * 60_000 }), async (c) => {
    if (!llm) return c.json({ error: 'ai_off' }, 503);
    const body = (await c.req.json().catch(() => ({}))) as { month?: string; hostelId?: string; image?: { mimeType?: string; data?: string } };
    const month = monthParam(body.month);
    if (!month) return c.json({ error: 'bad_month' }, 400);
    const img = body.image;
    if (!img?.data || !img.mimeType || !IMAGE_TYPES.includes(img.mimeType)) return c.json({ error: 'bad_image' }, 400);
    if (img.data.length > MAX_IMAGE_B64) return c.json({ error: 'image_too_large' }, 413);
    const students = await campusStudents(c.get('session').campusId, body.hostelId);
    const rows = await scanRegister(llm, { mimeType: img.mimeType, data: img.data }, students, month);
    if (rows === null) return c.json({ error: 'ai_unavailable' }, 503);
    return c.json({ month, rows });
  });

  // ---- mentor ----------------------------------------------------------------------------------------

  async function isMyStudent(mentorId: string, studentId: string) {
    const [a] = await db.select().from(mentorAssignments).where(and(eq(mentorAssignments.studentId, studentId), eq(mentorAssignments.mentorId, mentorId)));
    return Boolean(a);
  }

  r.get('/students/:id', requireRole('mentor'), async (c) => {
    const id = c.req.param('id');
    if (!(await isMyStudent(c.get('session').sub, id))) return c.json({ error: 'not_found' }, 404);
    const month = monthParam(c.req.query('month')) ?? monthOf(now());
    const rows = await loadRegister(db, id, month);
    const decisions = await db.select().from(reviewDecisions).where(eq(reviewDecisions.studentId, id)).orderBy(desc(reviewDecisions.createdAt));
    return c.json({
      month,
      months: lastMonths(6, month),
      rows,
      targets: await targetsWithStatus(db, id),
      review: sixMonthReview(rows, month),
      decisions: decisions.map((d) => ({ id: d.id, month: d.month, decision: d.decision, reason: d.reason, suggestionShown: d.suggestionShown, createdAt: d.createdAt })),
    });
  });

  r.post('/students/:id/targets', requireRole('mentor'), async (c) => {
    const id = c.req.param('id');
    const s = c.get('session');
    if (!(await isMyStudent(s.sub, id))) return c.json({ error: 'not_found' }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { metric?: string; month?: string; goal?: number; flagId?: string };
    const month = monthParam(body.month);
    if (!month || month < monthOf(now())) return c.json({ error: 'bad_month' }, 400);
    if (!body.metric || !(METRICS as readonly string[]).includes(body.metric)) return c.json({ error: 'bad_metric' }, 400);
    const goal = Number(body.goal);
    if (!Number.isInteger(goal) || goal < 0 || goal > 100) return c.json({ error: 'bad_goal' }, 400);
    let flagId: string | null = null;
    if (body.flagId) {
      const [f] = await db.select().from(flags).where(and(eq(flags.id, body.flagId), eq(flags.studentId, id), eq(flags.mentorId, s.sub)));
      if (!f) return c.json({ error: 'bad_flag' }, 400);
      flagId = f.id;
    }
    const row = { id: newId('t'), studentId: id, mentorId: s.sub, metric: body.metric as Metric, month, goal, flagId };
    await db
      .insert(targets)
      .values(row)
      .onConflictDoUpdate({ target: [targets.studentId, targets.metric, targets.month], set: { goal, flagId, mentorId: s.sub } });
    return c.json({ ok: true, targets: await targetsWithStatus(db, id) });
  });

  r.post('/students/:id/review', requireRole('mentor'), async (c) => {
    const id = c.req.param('id');
    const s = c.get('session');
    if (!(await isMyStudent(s.sub, id))) return c.json({ error: 'not_found' }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { month?: string; decision?: string; reason?: string };
    const month = monthParam(body.month) ?? monthOf(now());
    if (!['continue', 'continue_with_support', 'refer'].includes(body.decision ?? '')) return c.json({ error: 'bad_decision' }, 400);
    const reason = body.reason?.trim();
    if (!reason || reason.length < 10) return c.json({ error: 'reason_required' }, 400);
    // Store the suggestion as computed now, so the record shows what the mentor saw.
    const suggestion = sixMonthReview(await loadRegister(db, id, month), month).suggestion;
    const row = { id: newId('d'), studentId: id, mentorId: s.sub, month, suggestionShown: suggestion, decision: body.decision as 'continue' | 'continue_with_support' | 'refer', reason: reason.slice(0, 2000) };
    await db.insert(reviewDecisions).values(row);
    return c.json({ ok: true, decision: row });
  });

  return r;
}
