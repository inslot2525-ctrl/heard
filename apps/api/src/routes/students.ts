// Mentors: their students at a glance, and one student's journey (12 weeks of check-ins, flags, notes).
// Only a student's own mentor can see their answers; wardens get counts elsewhere (/pulse/stats).

import { lastWeeks } from '@heard/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Db } from '../db/client.js';
import { flags, hostels, INTERVENTION_KINDS, interventions, mentorAssignments, pulses, users, type InterventionKind } from '../db/schema.js';
import { isoWeek } from '@heard/shared';
import { newId } from '../ids.js';
import { requireSession, type AuthVars } from '../session.js';
import { requireRole } from '../session-guards.js';

export const JOURNEY_WEEKS = 12;

export function studentRoutes({ db, sessionSecret, now }: { db: Db; sessionSecret: string; now: () => Date }) {
  const r = new Hono<AuthVars>();
  r.use('*', requireSession(sessionSecret), requireRole('mentor'));

  async function myStudentIds(mentorId: string) {
    const rows = await db.select({ id: mentorAssignments.studentId }).from(mentorAssignments).where(eq(mentorAssignments.mentorId, mentorId));
    return rows.map((r) => r.id);
  }

  /** My students with their latest check-in and open flags. */
  r.get('/', async (c) => {
    const ids = await myStudentIds(c.get('session').sub);
    if (!ids.length) return c.json([]);
    const people = await db
      .select({ id: users.id, name: users.name, lang: users.lang, hostel: hostels.name })
      .from(users)
      .leftJoin(hostels, eq(hostels.id, users.hostelId))
      .where(inArray(users.id, ids));
    const weeks = lastWeeks(4, now());
    const recent = await db.select().from(pulses).where(and(inArray(pulses.studentId, ids), inArray(pulses.week, weeks))).orderBy(desc(pulses.week));
    const open = await db.select({ studentId: flags.studentId, rule: flags.rule }).from(flags).where(and(inArray(flags.studentId, ids), eq(flags.status, 'open')));
    return c.json(
      people
        .map((p) => {
          const latest = recent.find((x) => x.studentId === p.id);
          return {
            ...p,
            latest: latest ? { week: latest.week, studies: latest.studies, money: latest.money, health: latest.health, home: latest.home } : null,
            answeredLast4: recent.filter((x) => x.studentId === p.id).length,
            openFlags: open.filter((f) => f.studentId === p.id).map((f) => f.rule),
          };
        })
        .sort((a, b) => b.openFlags.length - a.openFlags.length || a.name.localeCompare(b.name)),
    );
  });

  /** One student's journey. 404 unless they're my student. */
  r.get('/:id/journey', async (c) => {
    const id = c.req.param('id');
    const ids = await myStudentIds(c.get('session').sub);
    if (!ids.includes(id)) return c.json({ error: 'not_found' }, 404);
    const [student] = await db
      .select({ id: users.id, name: users.name, lang: users.lang, hostel: hostels.name, joined: users.createdAt })
      .from(users)
      .leftJoin(hostels, eq(hostels.id, users.hostelId))
      .where(eq(users.id, id));
    const weeks = lastWeeks(JOURNEY_WEEKS, now());
    const rows = await db.select().from(pulses).where(and(eq(pulses.studentId, id), inArray(pulses.week, weeks)));
    const series = weeks.map((week) => {
      const p = rows.find((r) => r.week === week);
      return p
        ? { week, studies: p.studies, money: p.money, health: p.health, home: p.home, note: p.note, wantsToTalk: p.wantsToTalk }
        : { week, studies: null, money: null, health: null, home: null, note: null, wantsToTalk: false };
    });
    const flagRows = await db.select().from(flags).where(eq(flags.studentId, id)).orderBy(desc(flags.createdAt));
    const helps = await db.select().from(interventions).where(eq(interventions.studentId, id)).orderBy(desc(interventions.createdAt));
    return c.json({
      student,
      weeks: series,
      flags: flagRows.map((f) => ({ id: f.id, rule: f.rule, area: f.area, week: f.week, reason: f.reason, status: f.status, openerSent: f.openerSent, dismissReason: f.dismissReason, createdAt: f.createdAt, updatedAt: f.updatedAt })),
      interventions: helps.map((h) => ({ id: h.id, kind: h.kind, note: h.note, week: h.week, flagId: h.flagId, createdAt: h.createdAt })),
      /** The student's own words, newest first (check-in notes). */
      words: series.filter((w) => w.note).map((w) => ({ week: w.week, text: w.note! })).reverse(),
    });
  });

  /** Log what I did for one of my students. Body: { kind, note?, flagId? } */
  r.post('/:id/interventions', async (c) => {
    const id = c.req.param('id');
    const mentorId = c.get('session').sub;
    if (!(await myStudentIds(mentorId)).includes(id)) return c.json({ error: 'not_found' }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { kind?: string; note?: string; flagId?: string };
    if (!(INTERVENTION_KINDS as readonly string[]).includes(body.kind ?? '')) return c.json({ error: 'bad_kind' }, 400);
    let flagId: string | null = null;
    if (body.flagId) {
      const [f] = await db.select({ id: flags.id }).from(flags).where(and(eq(flags.id, body.flagId), eq(flags.studentId, id), eq(flags.mentorId, mentorId)));
      flagId = f?.id ?? null;
    }
    const [row] = await db
      .insert(interventions)
      .values({ id: newId('i'), studentId: id, mentorId, kind: body.kind as InterventionKind, note: body.note?.trim().slice(0, 500) || null, week: isoWeek(now()), flagId })
      .returning();
    return c.json(row);
  });

  return r;
}
