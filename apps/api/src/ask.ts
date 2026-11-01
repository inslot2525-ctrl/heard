// Ask Heard: mentors ask questions about their own students in chat ("who hasn't checked in?",
// "how is Priya doing?"). Gemini answers from a fact sheet built from the database and must cite a
// receipt for every claim; code then checks each receipt against the records. Verified receipts are
// shown with a tick and link to the student; anything that doesn't match is shown as unverified.

import { englishLanguageName, lastWeeks, type AskAnswer, type AskReceipt, type PulseArea } from '@heard/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { flags, mentorAssignments, pulses, users } from './db/schema.js';
import { LlmError, type Llm } from './llm.js';

export const ASK_WEEKS = 12;
const AREAS: PulseArea[] = ['studies', 'money', 'health', 'home'];
const LEVEL = ['struggling', 'ok', 'good'] as const;

export interface FactSheet {
  text: string;
  /** "<name lowercase>|<week>|<area>" → value, for checking receipts. */
  facts: Map<string, string>;
  students: { id: string; name: string }[];
}

/** `onlyStudentId`: build the sheet for one of the mentor's students (meeting card). */
export async function buildFactSheet(db: Db, mentorId: string, now: Date, onlyStudentId?: string): Promise<FactSheet> {
  const assigned = await db.select({ id: mentorAssignments.studentId }).from(mentorAssignments).where(eq(mentorAssignments.mentorId, mentorId));
  const ids = assigned.map((a) => a.id).filter((id) => !onlyStudentId || id === onlyStudentId);
  const facts = new Map<string, string>();
  if (!ids.length) return { text: '(no students yet)', facts, students: [] };
  const people = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids));
  const weeks = lastWeeks(ASK_WEEKS, now);
  const rows = await db.select().from(pulses).where(and(inArray(pulses.studentId, ids), inArray(pulses.week, weeks)));
  const open = await db.select().from(flags).where(and(inArray(flags.studentId, ids), inArray(flags.status, ['open', 'contacted'])));

  const lines: string[] = [`Weeks covered: ${weeks[0]} to ${weeks.at(-1)}. Levels: good, ok, struggling; "no reply" = no check-in that week.`];
  for (const p of people.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = p.name.toLowerCase();
    lines.push(`\nSTUDENT ${p.name}`);
    for (const week of weeks) {
      const r = rows.find((x) => x.studentId === p.id && x.week === week);
      if (!r) {
        facts.set(`${key}|${week}|checkin`, 'no reply');
        lines.push(`  ${week}: no reply`);
        continue;
      }
      facts.set(`${key}|${week}|checkin`, 'answered');
      const parts = AREAS.map((a) => {
        const v = LEVEL[r[a] as 0 | 1 | 2];
        facts.set(`${key}|${week}|${a}`, v);
        return `${a} ${v}`;
      });
      if (r.wantsToTalk) {
        facts.set(`${key}|${week}|wants_to_talk`, 'yes');
        parts.push('asked to talk');
      }
      lines.push(`  ${week}: ${parts.join(', ')}${r.note ? `; note: "${r.note.replace(/\s+/g, ' ').slice(0, 200)}"` : ''}`);
    }
    for (const f of open.filter((x) => x.studentId === p.id)) {
      facts.set(`${key}|${f.week}|flag`, f.rule);
      lines.push(`  flag ${f.week}: ${f.rule}${f.area ? ` (${f.area})` : ''}, ${f.status}`);
    }
  }
  return { text: lines.join('\n'), facts, students: people };
}

export const ASK_SYSTEM = (lang: string) =>
  [
    "You answer a college mentor's questions about THEIR OWN students, using ONLY the fact sheet below.",
    `Answer in ${englishLanguageName(lang)} (${lang}), briefly (at most 5 short sentences or a short list).`,
    'Every claim about a student must be backed by a receipt from the fact sheet.',
    'Receipt fields: "student" (exact name), "week" (e.g. 2026-W44), "area" (one of: studies, money, health, home, checkin, wants_to_talk, flag), "value" (exactly as in the sheet: good / ok / struggling, "no reply" or "answered" for checkin, "yes" for wants_to_talk, the rule name for flag).',
    'Never invent students, weeks or values. Never diagnose, label, score or rank students by risk. If the sheet does not answer the question, say so plainly.',
    'Reply with JSON only: {"answer": "...", "receipts": [{"student": "...", "week": "...", "area": "...", "value": "..."}]}',
  ].join('\n');

export function parseAsk(out: string): { answer: string; receipts: Omit<AskReceipt, 'verified' | 'studentId'>[] } | null {
  const json = out.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const p = JSON.parse(json) as { answer?: unknown; receipts?: unknown };
    if (typeof p.answer !== 'string' || !p.answer.trim()) return null;
    const receipts = (Array.isArray(p.receipts) ? p.receipts : [])
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .map((r) => ({ student: String(r.student ?? ''), week: String(r.week ?? ''), area: String(r.area ?? ''), value: String(r.value ?? '') }))
      .slice(0, 20);
    return { answer: p.answer.trim(), receipts };
  } catch {
    return null;
  }
}

/** Code check: a receipt is verified only if the exact fact is in the sheet. */
export function verifyReceipts(sheet: FactSheet, receipts: Omit<AskReceipt, 'verified' | 'studentId'>[]): AskReceipt[] {
  return receipts.map((r) => {
    const student = sheet.students.find((s) => s.name.toLowerCase() === r.student.trim().toLowerCase());
    const actual = sheet.facts.get(`${r.student.trim().toLowerCase()}|${r.week.trim()}|${r.area.trim()}`);
    return { ...r, studentId: student?.id ?? null, verified: Boolean(student) && actual !== undefined && actual === r.value.trim().toLowerCase() };
  });
}

export async function askHeard(llm: Llm | null, sheet: FactSheet, question: string, lang: string): Promise<AskAnswer> {
  if (!llm) return { question, answer: 'Ask Heard needs the AI service, which is not configured.', receipts: [], unavailable: true };
  try {
    const out = await llm.complete({ system: `${ASK_SYSTEM(lang)}\n\nFACT SHEET\n${sheet.text}`, user: question, maxOutputTokens: 900, timeoutMs: 12_000 });
    const parsed = parseAsk(out);
    if (!parsed) return { question, answer: 'Sorry, I could not answer that. Try asking more simply.', receipts: [], unavailable: true };
    return { question, answer: parsed.answer, receipts: verifyReceipts(sheet, parsed.receipts) };
  } catch (e) {
    if (!(e instanceof LlmError)) throw e;
    return { question, answer: 'The AI is busy right now. Please try again in a minute.', receipts: [], unavailable: true };
  }
}
