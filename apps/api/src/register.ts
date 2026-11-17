// Hostel register: monthly records per student, entered by a warden by hand or read from a photo of
// the paper register (and always confirmed by a person before saving). Saving runs the register rules,
// which open flags for the student's mentor like check-in flags do, with the evidence attached.

import {
  addMonths,
  cleanValue,
  evaluateRegister,
  isoWeek,
  lastMonths,
  METRICS,
  monthLabel,
  perceptionGap,
  targetMet,
  type Metric,
  type Month,
  type PulseLevel,
  type RegisterRow,
} from '@heard/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { flags, mentorAssignments, pulses, registerRows, targets, users } from './db/schema.js';
import { openFlag } from './flags.js';
import { newId } from './ids.js';
import { LlmError, type Llm } from './llm.js';

export type RowInput = { studentId: string; remarks?: string | null } & Partial<Record<Metric, unknown>>;

/** ISO weeks whose Monday falls in `month` (the weeks a student's check-ins are filed under). */
export function weeksOfMonth(month: Month): string[] {
  const [y, m] = month.split('-').map(Number);
  const out = new Set<string>();
  for (let d = 1; d <= 31; d++) {
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCMonth() !== m - 1) break;
    if (date.getUTCDay() === 1) out.add(isoWeek(date));
  }
  return [...out];
}

export async function loadRegister(db: Db, studentId: string, month: Month): Promise<RegisterRow[]> {
  const months = lastMonths(6, month);
  const rows = await db.select().from(registerRows).where(and(eq(registerRows.studentId, studentId), inArray(registerRows.month, months)));
  return rows.map((r) => ({ month: r.month, attendance: r.attendance, academics: r.academics, duties: r.duties, activities: r.activities, conduct: r.conduct, remarks: r.remarks }));
}

/**
 * Save rows for one month (upsert per student), then run the register rules and check any targets
 * set for that month. Only students of `campusId` are accepted. Returns counts for the UI.
 */
export async function saveRegister(
  db: Db,
  chat: Chat | null,
  p: { campusId: string; month: Month; rows: RowInput[]; enteredBy: string; source: 'manual' | 'photo' },
) {
  const ids = [...new Set(p.rows.map((r) => r.studentId))];
  const students = ids.length
    ? await db.select().from(users).where(and(inArray(users.id, ids), eq(users.campusId, p.campusId), eq(users.role, 'student')))
    : [];
  const ok = new Set(students.map((s) => s.id));
  let saved = 0;
  for (const r of p.rows) {
    if (!ok.has(r.studentId)) continue;
    const values = {
      attendance: cleanValue('attendance', r.attendance),
      academics: cleanValue('academics', r.academics),
      duties: cleanValue('duties', r.duties),
      activities: cleanValue('activities', r.activities),
      conduct: cleanValue('conduct', r.conduct),
      remarks: r.remarks?.toString().trim().slice(0, 300) || null,
      source: p.source,
      enteredBy: p.enteredBy,
    };
    await db
      .insert(registerRows)
      .values({ id: newId('r'), studentId: r.studentId, month: p.month, ...values })
      .onConflictDoUpdate({ target: [registerRows.studentId, registerRows.month], set: values });
    saved++;
  }
  let flagged = 0;
  let targetsMet = 0;
  for (const id of ok) {
    flagged += (await evaluateRegisterStudent(db, chat, id, p.month)).length;
    targetsMet += await checkTargets(db, id, p.month);
  }
  return { saved, skipped: p.rows.length - saved, flagged, targetsMet };
}

/** Run the register rules for one student and month; opens new flags (deduped per rule/metric/month). */
export async function evaluateRegisterStudent(db: Db, chat: Chat | null, studentId: string, month: Month) {
  const [row] = await db
    .select({ student: users, mentorId: mentorAssignments.mentorId })
    .from(users)
    .leftJoin(mentorAssignments, eq(mentorAssignments.studentId, users.id))
    .where(eq(users.id, studentId));
  if (!row?.mentorId) return [];
  const [mentor] = await db.select().from(users).where(eq(users.id, row.mentorId));
  const rows = await loadRegister(db, studentId, month);
  const hits = evaluateRegister(rows, month);
  if (!hits.length) return [];

  const weeks = weeksOfMonth(month);
  const checkins = weeks.length ? await db.select().from(pulses).where(and(eq(pulses.studentId, studentId), inArray(pulses.week, weeks))) : [];
  const studies = weeks.map((w) => (checkins.find((c) => c.week === w)?.studies ?? null) as PulseLevel | null);
  const remarks = rows.find((r) => r.month === month)?.remarks ?? null;

  const openNow = await db
    .select()
    .from(flags)
    .where(and(eq(flags.studentId, studentId), inArray(flags.status, ['open', 'contacted'])));
  const created = [];
  for (const hit of hits) {
    const gap = perceptionGap(hit.metric, studies);
    const evidence = { history: null, registerHistory: hit.history, perceptionGap: gap, remarks, studentWords: null, month };
    // Still the same problem as an open card: refresh that card with this month's evidence instead of a new one.
    const existing = openNow.find((f) => f.rule === hit.rule && f.area === hit.metric);
    if (existing) {
      await db.update(flags).set({ reason: hit.reason, evidence }).where(eq(flags.id, existing.id));
      continue;
    }
    const flag = await openFlag(db, chat, {
      student: row.student,
      mentorId: row.mentorId,
      mentorLang: mentor.lang,
      rule: hit.rule,
      area: hit.metric,
      week: month,
      reason: hit.reason,
      evidence,
      card: {},
    });
    if (flag) created.push(flag);
  }
  return created;
}

/** Targets for this month: when met, resolve the flag they came from. Returns how many were met. */
export async function checkTargets(db: Db, studentId: string, month: Month) {
  const ts = await db.select().from(targets).where(and(eq(targets.studentId, studentId), eq(targets.month, month)));
  if (!ts.length) return 0;
  const [r] = await db.select().from(registerRows).where(and(eq(registerRows.studentId, studentId), eq(registerRows.month, month)));
  let met = 0;
  for (const t of ts) {
    const value = r ? (r[t.metric as Metric] as number | null) : null;
    if (targetMet(t.metric as Metric, t.goal, value) !== true) continue;
    met++;
    if (t.flagId) await db.update(flags).set({ status: 'resolved' }).where(and(eq(flags.id, t.flagId), inArray(flags.status, ['open', 'contacted'])));
  }
  return met;
}

/** A target's status for display. */
export async function targetsWithStatus(db: Db, studentId: string) {
  const ts = await db.select().from(targets).where(eq(targets.studentId, studentId));
  const months = [...new Set(ts.map((t) => t.month))];
  const rows = months.length ? await db.select().from(registerRows).where(and(eq(registerRows.studentId, studentId), inArray(registerRows.month, months))) : [];
  return ts
    .map((t) => {
      const r = rows.find((x) => x.month === t.month);
      const value = r ? (r[t.metric as Metric] as number | null) : null;
      return { id: t.id, metric: t.metric, month: t.month, goal: t.goal, flagId: t.flagId, value, met: targetMet(t.metric as Metric, t.goal, value) };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}

export const nextMonth = (m: Month) => addMonths(m, 1);

// ---- reading a photo of the paper register -------------------------------------------------------------

export const SCAN_SYSTEM = [
  'You read a photo of a paper hostel register and copy it into JSON. Copy only what is written; never guess.',
  `Columns to look for (any order, any language, handwritten or printed): student name; ${METRICS.map((m) => m).join(', ')} ` +
    '(attendance/academics/duties as a percentage 0–100, activities as days in the month, conduct as a count of incidents); remarks.',
  'If a cell is empty, unreadable or the column is missing, use null. Keep names exactly as written.',
  'Reply with JSON only: {"rows": [{"name": "...", "attendance": 85, "academics": null, "duties": 90, "activities": 12, "conduct": 0, "remarks": null}]}',
].join('\n');

export interface ScannedRow {
  name: string;
  studentId: string | null;
  match: 'exact' | 'close' | 'none';
  values: Record<Metric, number | null>;
  remarks: string | null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();

/** Match a written name to a student: exact (normalised), else same first name + same last initial. */
export function matchName(name: string, students: { id: string; name: string }[]): { studentId: string | null; match: ScannedRow['match'] } {
  const n = norm(name);
  const exact = students.filter((s) => norm(s.name) === n);
  if (exact.length === 1) return { studentId: exact[0].id, match: 'exact' };
  const [first, ...rest] = n.split(' ');
  const lastInitial = rest.at(-1)?.[0];
  const close = students.filter((s) => {
    const [f, ...r] = norm(s.name).split(' ');
    return f === first && (!lastInitial || r.at(-1)?.[0] === lastInitial);
  });
  return close.length === 1 ? { studentId: close[0].id, match: 'close' } : { studentId: null, match: 'none' };
}

export function parseScan(out: string, students: { id: string; name: string }[]): ScannedRow[] {
  const json = out.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  let rows: unknown[] = [];
  try {
    const p = JSON.parse(json) as { rows?: unknown };
    rows = Array.isArray(p.rows) ? p.rows : [];
  } catch {
    return [];
  }
  return rows.slice(0, 200).flatMap((raw) => {
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
    if (!name) return [];
    const values = Object.fromEntries(METRICS.map((m) => [m, cleanValue(m, r[m])])) as Record<Metric, number | null>;
    return [{ name, ...matchName(name, students), values, remarks: typeof r.remarks === 'string' && r.remarks.trim() ? r.remarks.trim().slice(0, 300) : null }];
  });
}

/** Read a register photo. Nothing is saved: the warden checks every row and then saves. */
export async function scanRegister(llm: Llm, image: { mimeType: string; data: string }, students: { id: string; name: string }[], month: Month) {
  try {
    const out = await llm.complete({
      system: SCAN_SYSTEM,
      user: `This is the register for ${monthLabel(month)} ${month.slice(0, 4)}. Return every student row you can read.`,
      image,
      maxOutputTokens: 4096,
      timeoutMs: 30_000,
    });
    return parseScan(out, students);
  } catch (e) {
    if (e instanceof LlmError) return null;
    throw e;
  }
}
