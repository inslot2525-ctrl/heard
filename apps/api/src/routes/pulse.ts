import { isoWeek, lastWeeks } from '@heard/shared';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Chat } from '../chat.js';
import type { Db } from '../db/client.js';
import { campuses, flags, pulses, safetyEvents, users } from '../db/schema.js';
import { recordPulse, sendPulseRound, validatePulse, type PulseInput } from '../pulse.js';
import { requireSession, type AuthVars } from '../session.js';
import { requireRole } from '../session-guards.js';

export interface PulseDeps {
  db: Db;
  chat: Chat | null;
  sessionSecret: string;
  now: () => Date;
}

export function pulseRoutes({ db, chat, sessionSecret, now }: PulseDeps) {
  const r = new Hono<AuthVars>();
  r.use('*', requireSession(sessionSecret));

  /** Student: this week and my answer so far (null if not answered). */
  r.get('/current', requireRole('student'), async (c) => {
    const week = isoWeek(now());
    const [mine] = await db
      .select()
      .from(pulses)
      .where(and(eq(pulses.studentId, c.get('session').sub), eq(pulses.week, week)));
    return c.json({ week, answer: mine ?? null });
  });

  /** Student: answer (or change) a week's check-in. Body: { week, levels, note?, wantsToTalk? } */
  r.post('/', requireRole('student'), async (c) => {
    const input = (await c.req.json().catch(() => ({}))) as PulseInput;
    const v = validatePulse(input, now());
    if (!v.ok) return c.json({ error: v.error }, 400);
    const { sub, campusId } = c.get('session');
    const [student] = await db.select().from(users).where(eq(users.id, sub));
    if (!student) return c.json({ error: 'not_found' }, 404);
    const { pulse, newFlags } = await recordPulse(db, chat, { id: sub, campusId }, v.value, now());
    // Students never see flags; only that their answer was saved.
    return c.json({ saved: { week: pulse.week, id: pulse.id }, mentorNotified: newFlags.length > 0 });
  });

  /** Warden: send this week's check-in to every student in the campus. */
  r.post('/rounds', requireRole('warden'), async (c) => {
    const result = await sendPulseRound(db, chat, c.get('session').campusId, now());
    return c.json(result);
  });

  /**
   * Warden: pilot numbers for this campus (traction proof). Counts only: no names, no answers.
   * Demo users are excluded on pilot campuses so test data never inflates real numbers.
   */
  r.get('/stats', requireRole('warden'), async (c) => {
    const { campusId } = c.get('session');
    const [campus] = await db.select().from(campuses).where(eq(campuses.id, campusId));
    const people = await db
      .select({ id: users.id, role: users.role, isDemo: users.isDemo })
      .from(users)
      .where(eq(users.campusId, campusId));
    const real = people.filter((p) => p.role !== 'bot' && (!campus?.isPilot || !p.isDemo));
    const studentIds = real.filter((p) => p.role === 'student').map((p) => p.id);
    const weeks = lastWeeks(4, now());
    const answered = studentIds.length
      ? await db
          .select({ week: pulses.week, n: sql<number>`count(*)`.mapWith(Number) })
          .from(pulses)
          .where(and(inArray(pulses.studentId, studentIds), inArray(pulses.week, weeks)))
          .groupBy(pulses.week)
      : [];
    const flagRows = studentIds.length
      ? await db
          .select({ status: flags.status, n: sql<number>`count(*)`.mapWith(Number) })
          .from(flags)
          .where(inArray(flags.studentId, studentIds))
          .groupBy(flags.status)
      : [];
    const [{ n: conversations }] = studentIds.length
      ? await db
          .select({ n: sql<number>`count(*)`.mapWith(Number) })
          .from(flags)
          .where(and(inArray(flags.studentId, studentIds), isNotNull(flags.openerSent)))
      : [{ n: 0 }];
    const [{ n: safetyAlerts }] = studentIds.length
      ? await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(safetyEvents).where(inArray(safetyEvents.studentId, studentIds))
      : [{ n: 0 }];
    const byStatus = Object.fromEntries(flagRows.map((f) => [f.status, f.n]));
    return c.json({
      campus: { id: campusId, name: campus?.name, isPilot: campus?.isPilot ?? false },
      students: studentIds.length,
      mentors: real.filter((p) => p.role === 'mentor').length,
      wardens: real.filter((p) => p.role === 'warden').length,
      checkIns: weeks.map((week) => ({ week, answered: answered.find((a) => a.week === week)?.n ?? 0 })),
      flags: { open: byStatus.open ?? 0, contacted: byStatus.contacted ?? 0, resolved: byStatus.resolved ?? 0, dismissed: byStatus.dismissed ?? 0 },
      conversationsStarted: conversations,
      safetyAlerts,
    });
  });

  return r;
}
