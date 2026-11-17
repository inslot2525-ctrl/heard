// Meeting card: a one-page brief before a mentor talks to a student. Strengths first, then what
// changed, questions to ask and things to avoid, in the mentor's language. Every factual point
// carries a receipt; code drops any point whose receipt doesn't match the records (fact-check), so
// the mentor never walks into a conversation with a made-up number.

import { englishLanguageName, type AskReceipt } from '@heard/shared';
import { verifyReceipts, type FactSheet } from './ask.js';
import { LlmError, type Llm } from './llm.js';

export interface MeetingPoint {
  text: string;
  receipts: AskReceipt[];
}

export interface MeetingCard {
  student: string;
  strengths: MeetingPoint[];
  changes: MeetingPoint[];
  questions: string[];
  avoid: string[];
  /** Points the model wrote whose receipts failed the check (removed from the card). */
  removed: string[];
  unavailable?: boolean;
}

export const MEETING_SYSTEM = (lang: string, reason: string) =>
  [
    'You prepare a short brief for a college mentor who is about to talk with one student.',
    `Write in ${englishLanguageName(lang)} (${lang}). Use ONLY the fact sheet. The mentor is talking because: ${reason}`,
    'Sections:',
    '- strengths: 1-3 things going well (start here, always look for something real);',
    '- changes: 1-3 facts about what changed recently;',
    '- questions: 3 open, warm, non-judgemental questions the mentor could ask (no yes/no, no "why did you");',
    '- avoid: 1-2 things not to say or do (e.g. lecturing, comparing with others, promising what they cannot keep).',
    'Every strength and change needs receipts from the sheet: {"student","week","area","value"} exactly as in the sheet',
    '(area: studies, money, health, home, checkin, wants_to_talk, flag, or register_<metric> with the month as week; value: good/ok/struggling, "no reply"/"answered", "yes", the rule, or the register number as shown, e.g. 57%).',
    'Never diagnose, label, score or guess feelings. Quote the student only from their notes.',
    'Reply with JSON only: {"strengths":[{"text":"...","receipts":[...]}],"changes":[{"text":"...","receipts":[...]}],"questions":["..."],"avoid":["..."]}',
  ].join('\n');

type RawPoint = { text?: unknown; receipts?: unknown };

function toPoints(sheet: FactSheet, raw: unknown, removed: string[]): MeetingPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: MeetingPoint[] = [];
  for (const p of raw.slice(0, 4) as RawPoint[]) {
    if (typeof p?.text !== 'string' || !p.text.trim()) continue;
    const rec = (Array.isArray(p.receipts) ? p.receipts : [])
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .map((r) => ({ student: String(r.student ?? ''), week: String(r.week ?? ''), area: String(r.area ?? ''), value: String(r.value ?? '') }));
    const checked = verifyReceipts(sheet, rec);
    // Fact-check: keep a point only if it has at least one receipt and every receipt matches.
    if (checked.length && checked.every((r) => r.verified)) out.push({ text: p.text.trim(), receipts: checked });
    else removed.push(p.text.trim());
  }
  return out;
}

const strings = (raw: unknown, max: number) =>
  (Array.isArray(raw) ? raw : []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, max);

export function parseMeeting(sheet: FactSheet, student: string, out: string): MeetingCard | null {
  const json = out.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Record<string, unknown>;
    const removed: string[] = [];
    return {
      student,
      strengths: toPoints(sheet, p.strengths, removed),
      changes: toPoints(sheet, p.changes, removed),
      questions: strings(p.questions, 4),
      avoid: strings(p.avoid, 3),
      removed,
    };
  } catch {
    return null;
  }
}

export async function meetingCard(llm: Llm | null, sheet: FactSheet, student: string, reason: string, lang: string): Promise<MeetingCard> {
  const empty: MeetingCard = { student, strengths: [], changes: [], questions: [], avoid: [], removed: [], unavailable: true };
  if (!llm) return empty;
  try {
    const out = await llm.complete({ system: `${MEETING_SYSTEM(lang, reason)}\n\nFACT SHEET\n${sheet.text}`, user: `Prepare the brief for ${student}.`, maxOutputTokens: 1200, timeoutMs: 15_000 });
    return parseMeeting(sheet, student, out) ?? empty;
  } catch (e) {
    if (!(e instanceof LlmError)) throw e;
    return empty;
  }
}
