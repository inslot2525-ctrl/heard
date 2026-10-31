import { isoWeek } from '@heard/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Chat } from '../chat.js';
import type { Db } from '../db/client.js';
import { pulses, users } from '../db/schema.js';
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

  return r;
}
