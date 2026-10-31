// Flags engine: runs the shared rules over a student's last 6 weeks and opens new flags.
// Deterministic; the only "AI" part is the opener draft, which a mentor must edit and send.

import { evaluate, lastWeeks, MSG, type FlagCard, type PulseArea, type PulseLevel, type WeekPulse } from '@heard/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { botIdFor } from './campus.js';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { flags, mentorAssignments, pulses, users } from './db/schema.js';
import { newId } from './ids.js';
import { NexconnError } from './nexconn.js';
import { draftOpener } from './openers.js';

export const HISTORY_WEEKS = 6;

/** A student's pulse history as the rules expect it: one entry per week, oldest first. */
export async function loadHistory(db: Db, studentId: string, now: Date): Promise<WeekPulse[]> {
  const weeks = lastWeeks(HISTORY_WEEKS, now);
  const rows = await db
    .select()
    .from(pulses)
    .where(and(eq(pulses.studentId, studentId), inArray(pulses.week, weeks)));
  return weeks.map((week) => {
    const p = rows.find((r) => r.week === week);
    return {
      week,
      response: p
        ? {
            pulseId: p.id,
            week,
            levels: { studies: p.studies as PulseLevel, money: p.money as PulseLevel, health: p.health as PulseLevel, home: p.home as PulseLevel },
            note: p.note ?? undefined,
            wantsToTalk: p.wantsToTalk,
          }
        : null,
    };
  });
}

/**
 * Evaluate one student as of `now` and open any new flags (one per rule/area/week).
 * New flags are sent to the mentor as a FlagCard from the campus bot. Returns the new flags.
 */
export async function evaluateStudent(db: Db, chat: Chat | null, studentId: string, now = new Date()) {
  const [row] = await db
    .select({ student: users, mentorId: mentorAssignments.mentorId })
    .from(users)
    .leftJoin(mentorAssignments, eq(mentorAssignments.studentId, users.id))
    .where(eq(users.id, studentId));
  if (!row || row.student.role !== 'student' || !row.mentorId) return [];
  const [mentor] = await db.select().from(users).where(eq(users.id, row.mentorId));

  const history = await loadHistory(db, studentId, now);
  const week = history.at(-1)!.week;
  const created = [];
  for (const hit of evaluate(history)) {
    const area = (hit.area ?? '') as PulseArea | '';
    const values = {
      id: newId('f'),
      studentId,
      mentorId: row.mentorId,
      rule: hit.rule,
      area,
      week,
      reason: hit.reason,
      evidence: { history: hit.history ?? null, studentWords: hit.studentWords ?? null },
      openerDraft: draftOpener(hit.rule, area, row.student.name, mentor.lang),
    };
    const [inserted] = await db.insert(flags).values(values).onConflictDoNothing().returning();
    if (!inserted) continue; // already flagged this week
    created.push(inserted);
    if (chat) {
      const card: FlagCard = {
        flagId: inserted.id,
        studentId,
        studentName: row.student.name,
        rule: hit.rule,
        reason: hit.reason,
        history: hit.history,
        studentWords: hit.studentWords,
      };
      try {
        await chat.sendDirect({
          from: botIdFor(row.student.campusId),
          to: [row.mentorId],
          messageType: MSG.FlagCard,
          content: JSON.stringify(card),
          pushContent: `Check-in update for ${row.student.name}`,
        });
      } catch (e) {
        // The flag is saved and shows in the inbox; only the chat notification failed.
        console.error('flag card send failed', inserted.id, e instanceof NexconnError ? JSON.stringify(e.body) : e);
      }
    }
  }
  return created;
}
