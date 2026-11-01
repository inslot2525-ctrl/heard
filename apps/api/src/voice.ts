// Voice notes: students and mentors can talk instead of type (Nexconn HD voice messages, RC:HQVCMsg).
// Nexconn's own speech-to-text is off on our plan, so Gemini listens to the note and returns a
// transcript plus a translation for the reader. The audio is fetched from Nexconn's file host only
// (no arbitrary URLs: that would let anyone make our server fetch anything).

import { createHash } from 'node:crypto';
import { englishLanguageName } from '@heard/shared';
import type { Llm } from './llm.js';

export const VOICE_MAX_BYTES = 3 * 1024 * 1024; // 60 s of Opus is ~0.5 MB; leave room for other codecs

/**
 * Hosts Nexconn serves voice files from. Checked against the URL of real messages; add hosts here if Nexconn changes its file domain.
 */
// Seen Nov 1: voice notes are stored at https://bucket7-b-2.ronghub.com/... (RongCloud = Nexconn's file host).
export const DEFAULT_VOICE_HOSTS = ['ronghub.com', 'nexconn.ai', 'nexconn.com'];

export function voiceUrlAllowed(url: string, hosts: string[]) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

export interface VoiceResult {
  transcript: string;
  /** Language code the speaker used, as detected by the model. */
  language: string;
  /** Translation into the reader's language; equals transcript when the languages match. */
  translation: string;
}

export const VOICE_SYSTEM = [
  'You transcribe a short voice note from a college student or mentor, then translate it.',
  'Transcribe exactly what is said, in the language and script it is spoken in (e.g. Marathi in Devanagari).',
  'Then translate faithfully into the target language, keeping every detail, especially about difficulty, money, health or feelings.',
  'Never add commentary, never describe tone or emotion.',
  'Reply with JSON only: {"transcript": "...", "language": "<ISO 639-1 code>", "translation": "..."}.',
  'If the audio has no speech, reply {"transcript": "", "language": "", "translation": ""}.',
].join('\n');

export function parseVoice(out: string): VoiceResult | null {
  const json = out.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Partial<VoiceResult>;
    if (typeof p.transcript !== 'string') return null;
    return {
      transcript: p.transcript.trim(),
      language: typeof p.language === 'string' ? p.language.trim().toLowerCase() : '',
      translation: typeof p.translation === 'string' ? p.translation.trim() : p.transcript.trim(),
    };
  } catch {
    return null;
  }
}

export function mimeFor(contentType: string | null, url: string) {
  const ct = contentType?.split(';')[0].trim().toLowerCase();
  if (ct && ct.startsWith('audio/')) return ct;
  if (/\.(ogg|opus)(\?|$)/i.test(url)) return 'audio/ogg';
  if (/\.(m4a|aac|mp4)(\?|$)/i.test(url)) return 'audio/mp4';
  if (/\.mp3(\?|$)/i.test(url)) return 'audio/mpeg';
  if (/\.wav(\?|$)/i.test(url)) return 'audio/wav';
  return 'audio/webm';
}

export function cacheKeyFor(url: string, to: string) {
  return createHash('sha256').update(`${to}\n${url}`).digest('hex');
}

export async function transcribe(llm: Llm, audio: { mimeType: string; data: string }, to: string) {
  const out = await llm.complete({
    system: VOICE_SYSTEM,
    user: `Target language: ${englishLanguageName(to)} (${to})`,
    audio,
    maxOutputTokens: 1500,
    timeoutMs: 20_000,
  });
  return parseVoice(out);
}
