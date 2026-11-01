// Weekly pulse check-ins. Our API is the source of truth for answers; Nexconn carries the cards
// (PulseCard from the campus bot, PulseResponse mirrored into the chat as the student).

import { isoWeek, MSG, PULSE_AREAS, type PulseCard, type PulseLevel, type PulseResponse } from '@heard/shared';
import { and, eq } from 'drizzle-orm';
import { botIdFor } from './campus.js';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { pulses, users } from './db/schema.js';
import { evaluateStudent } from './flags.js';
import { newId } from './ids.js';
import { NexconnError } from './nexconn.js';
import { checkAndAlert } from './safety.js';

const WEEK_MS = 7 * 86_400_000;
export const NOTE_MAX = 500;

/** Answers are accepted for this week, and for last week (cards opened after the weekend). */
export function acceptableWeeks(now: Date) {
  return [isoWeek(now), isoWeek(new Date(now.getTime() - WEEK_MS))];
}

export async function campusStudents(db: Db, campusId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.campusId, campusId), eq(users.role, 'student')));
}

/**
 * Start this week's round: first catch students who went silent (evaluated as of last week, now
 * that it has ended), then send every student a PulseCard from the campus bot.
 */
export async function sendPulseRound(db: Db, chat: Chat | null, campusId: string, now = new Date()) {
  const week = isoWeek(now);
  const students = await campusStudents(db, campusId);

  const lastWeek = new Date(now.getTime() - WEEK_MS);
  let newFlags = 0;
  for (const s of students) newFlags += (await evaluateStudent(db, chat, s.id, lastWeek)).length;

  let sent = 0;
  if (chat && students.length) {
    const card: PulseCard = { pulseId: week, week, areas: PULSE_AREAS };
    for (let i = 0; i < students.length; i += 1000) {
      const batch = students.slice(i, i + 1000).map((s) => s.id);
      await chat.sendDirect({
        from: botIdFor(campusId),
        to: batch,
        messageType: MSG.PulseCard,
        content: JSON.stringify(card),
        pushContent: 'Your weekly check-in is here. One tap.',
      });
      sent += batch.length;
    }
  }
  return { week, students: students.length, sent, newFlags };
}

export interface PulseInput {
  week: string;
  levels: Record<string, unknown>;
  note?: unknown;
  wantsToTalk?: unknown;
}

export type PulseError = 'bad_week' | 'bad_levels' | 'note_too_long';

export function validatePulse(input: PulseInput, now: Date): { ok: true; value: Omit<PulseResponse, 'pulseId'> } | { ok: false; error: PulseError } {
  if (!acceptableWeeks(now).includes(input.week)) return { ok: false, error: 'bad_week' };
  const levels = {} as PulseResponse['levels'];
  for (const a of PULSE_AREAS) {
    const v = input.levels?.[a];
    if (v !== 0 && v !== 1 && v !== 2) return { ok: false, error: 'bad_levels' };
    levels[a] = v as PulseLevel;
  }
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > NOTE_MAX) return { ok: false, error: 'note_too_long' };
  return { ok: true, value: { week: input.week, levels, note: note || undefined, wantsToTalk: input.wantsToTalk === true } };
}

/**
 * Save (or update) a student's answer for a week, mirror it into the chat, and run the rules.
 * Changing an answer in the same week is allowed; flags already opened stay open.
 */
export async function recordPulse(db: Db, chat: Chat | null, student: { id: string; campusId: string }, value: Omit<PulseResponse, 'pulseId'>, now = new Date()) {
  const row = {
    id: newId('p'),
    studentId: student.id,
    week: value.week,
    ...value.levels,
    note: value.note ?? null,
    wantsToTalk: value.wantsToTalk ?? false,
  };
  const [saved] = await db
    .insert(pulses)
    .values(row)
    .onConflictDoUpdate({
      target: [pulses.studentId, pulses.week],
      set: { studies: row.studies, money: row.money, health: row.health, home: row.home, note: row.note, wantsToTalk: row.wantsToTalk, themes: null },
    })
    .returning();

  if (chat) {
    const msg: PulseResponse = { pulseId: saved.id, ...value };
    try {
      await chat.sendDirect({
        from: student.id,
        to: [botIdFor(student.campusId)],
        messageType: MSG.PulseResponse,
        content: JSON.stringify(msg),
        echo: true, // so the student's other devices show it too
      });
    } catch (e) {
      console.error('pulse mirror failed', saved.id, e instanceof NexconnError ? JSON.stringify(e.body) : e);
    }
  }

  if (value.note) await checkAndAlert(db, chat, student.id, value.note, saved.id, now);

  // Evaluate as of the answered week, so a late answer for last week is judged in its own week.
  const asOf = value.week === isoWeek(now) ? now : new Date(now.getTime() - WEEK_MS);
  const newFlags = await evaluateStudent(db, chat, student.id, asOf);
  return { pulse: saved, newFlags };
}
