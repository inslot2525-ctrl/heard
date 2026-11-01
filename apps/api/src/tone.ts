// Tone Guard: before a mentor sends a message, catch wording that blames, shames, labels, threatens or
// is sarcastic, and offer a warm, factual rewrite in the same language. The mentor chooses: use the
// suggestion, edit, or send anyway. Never blocks on its own except for the fixed label list
// (checkOpener), and never runs on students' messages.

import { englishLanguageName } from '@heard/shared';
import { LlmError, type Llm } from './llm.js';
import { checkOpener } from './openers.js';

export interface ToneResult {
  ok: boolean;
  /** Short phrases describing what to change, in English (shown to the mentor). */
  issues: string[];
  /** Rewritten message in the same language, when not ok. */
  suggestion?: string;
  /** false when the AI check didn't run (no key, or every model failed): only the label list ran. */
  checked: boolean;
}

export const TONE_SYSTEM = [
  'You check a message a college mentor is about to send to a student.',
  'Flag ONLY wording that is judgemental, blaming, shaming, sarcastic, threatening, guilt-tripping, or that labels the student',
  '(for example: "lazy", "careless", "you never", "you always", "irresponsible", "disappointed in you", mental-health labels).',
  'Direct or brief messages are fine. Asking about attendance, money or marks is fine if it is neutral.',
  'Reply with exactly OK if nothing needs changing.',
  'Otherwise reply with JSON only: {"issues": ["short phrase, in English"], "suggestion": "the same message rewritten warmly and factually, same language, same meaning, similar length"}.',
].join('\n');

export function parseTone(out: string): Omit<ToneResult, 'checked'> {
  const t = out.trim();
  if (/^ok\.?$/i.test(t)) return { ok: true, issues: [] };
  const json = t.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return { ok: true, issues: [] }; // unparseable: don't get in the mentor's way
  try {
    const p = JSON.parse(json) as { issues?: unknown; suggestion?: unknown };
    const issues = Array.isArray(p.issues) ? p.issues.filter((x): x is string => typeof x === 'string').slice(0, 4) : [];
    const suggestion = typeof p.suggestion === 'string' && p.suggestion.trim() ? p.suggestion.trim().slice(0, 1000) : undefined;
    return issues.length || suggestion ? { ok: false, issues, suggestion } : { ok: true, issues: [] };
  } catch {
    return { ok: true, issues: [] };
  }
}

export async function checkTone(llm: Llm | null, text: string, lang: string): Promise<ToneResult> {
  const label = checkOpener(text);
  if (label === 'labels_or_diagnosis') {
    return { ok: false, issues: ['uses a label or diagnosis (e.g. "depressed", "at risk"); describe what you noticed instead'], checked: false };
  }
  if (!llm) return { ok: true, issues: [], checked: false };
  try {
    const out = await llm.complete({
      system: TONE_SYSTEM,
      user: `Message language: ${englishLanguageName(lang)} (${lang})\n\n${text}`,
      maxOutputTokens: 600,
      timeoutMs: 5000,
    });
    return { ...parseTone(out), checked: true };
  } catch (e) {
    if (!(e instanceof LlmError)) throw e;
    return { ok: true, issues: [], checked: false };
  }
}
