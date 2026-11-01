// Theme tags: what a check-in note is ABOUT, from the student's own words. A fixed list, never
// feelings or diagnoses ("homesick" only if they wrote about missing home). Runs in the background
// after a note is saved; mentors see tags on the note, wardens see only counts.

import { THEMES, type Theme } from '@heard/shared';
import { eq } from 'drizzle-orm';
import type { Db } from './db/client.js';
import { pulses } from './db/schema.js';
import { LlmError, type Llm } from './llm.js';

export const THEMES_SYSTEM = [
  'You tag what a short note from a college student is ABOUT, using only these tags:',
  THEMES.join(', '),
  'Tag only topics the student actually wrote about. Never infer feelings, mood, risk or diagnoses.',
  'The note may be in any language. Use 0 to 3 tags. "other" only if there is a topic not in the list.',
  'Reply with JSON only: {"themes": ["..."]}',
].join('\n');

export function parseThemes(out: string): Theme[] {
  const json = out.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  try {
    const p = JSON.parse(json) as { themes?: unknown };
    const list = Array.isArray(p.themes) ? p.themes : [];
    return [...new Set(list.filter((x): x is Theme => typeof x === 'string' && (THEMES as readonly string[]).includes(x)))].slice(0, 3);
  } catch {
    return [];
  }
}

export async function tagNote(llm: Llm, note: string): Promise<Theme[]> {
  try {
    return parseThemes(await llm.complete({ system: THEMES_SYSTEM, user: note.slice(0, 500), maxOutputTokens: 100, timeoutMs: 5000 }));
  } catch (e) {
    if (e instanceof LlmError) return [];
    throw e;
  }
}

/** Tag a pulse's note and store it. Never throws (background job). */
export async function tagPulse(db: Db, llm: Llm | null, pulseId: string, note: string | null | undefined) {
  if (!llm || !note?.trim()) return;
  try {
    const themes = await tagNote(llm, note);
    await db.update(pulses).set({ themes }).where(eq(pulses.id, pulseId));
  } catch (e) {
    console.error('theme tagging failed', pulseId, e);
  }
}
