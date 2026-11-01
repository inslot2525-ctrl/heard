import { createHash } from 'node:crypto';
import { isLanguage } from '@heard/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { ask, QUESTION_MAX } from '../assistant.js';
import type { Chat } from '../chat.js';
import type { Db } from '../db/client.js';
import { users } from '../db/schema.js';
import { LlmError, translateWithLlm, type Llm } from '../llm.js';
import { rateLimit } from '../rate-limit.js';
import { checkAndAlert } from '../safety.js';
import { checkTone } from '../tone.js';
import { cacheKeyFor, DEFAULT_VOICE_HOSTS, mimeFor, transcribe, VOICE_MAX_BYTES, voiceUrlAllowed, type VoiceResult } from '../voice.js';
import { requireSession, type AuthVars } from '../session.js';
import { requireRole } from '../session-guards.js';

export interface AiDeps {
  db: Db;
  chat: Chat | null;
  llm: Llm | null;
  sessionSecret: string;
  now: () => Date;
  /** Hosts voice files may be fetched from (Nexconn's file host). */
  voiceHosts?: string[];
  /** For tests: replaces fetch when downloading voice files. */
  fetchImpl?: typeof fetch;
}

const TEXT_MAX = 2000;

/** Small in-memory cache: the same message is translated once, however many devices open it. */
function lru<V>(max: number) {
  const m = new Map<string, V>();
  return {
    get(k: string) {
      const v = m.get(k);
      if (v !== undefined) (m.delete(k), m.set(k, v));
      return v;
    },
    set(k: string, v: V) {
      m.set(k, v);
      if (m.size > max) m.delete(m.keys().next().value!);
    },
  };
}

export function aiRoutes({ db, chat, llm, sessionSecret, now, voiceHosts = DEFAULT_VOICE_HOSTS, fetchImpl = fetch }: AiDeps) {
  const r = new Hono<AuthVars>();
  const cache = lru<string>(5000);
  // Scoped to this router's own paths: it's mounted at '/', so '*' would also catch other routes.
  for (const p of ['/translate', '/assistant/*', '/safety/*', '/tone', '/voice/*']) r.use(p, requireSession(sessionSecret));
  r.use('/tone', rateLimit({ max: 200, windowMs: 10 * 60_000 }));
  r.use('/voice/*', rateLimit({ max: 120, windowMs: 10 * 60_000 }));
  const voiceCache = lru<VoiceResult>(2000);
  r.use('/translate', rateLimit({ max: 300, windowMs: 10 * 60_000 }));
  r.use('/assistant/*', rateLimit({ max: 60, windowMs: 10 * 60_000 }));

  /** Body: { text, to } → { text }. Used for Indian languages (see LLM_TRANSLATED). */
  r.post('/translate', async (c) => {
    if (!llm) return c.json({ error: 'llm_not_configured' }, 503);
    const { text, to } = (await c.req.json().catch(() => ({}))) as { text?: string; to?: string };
    if (!text?.trim() || text.length > TEXT_MAX) return c.json({ error: 'bad_text' }, 400);
    if (!isLanguage(to)) return c.json({ error: 'bad_lang' }, 400);
    const key = createHash('sha256').update(`${to}\n${text}`).digest('hex');
    const hit = cache.get(key);
    if (hit !== undefined) return c.json({ text: hit, cached: true });
    try {
      const out = await translateWithLlm(llm, text, to);
      cache.set(key, out);
      return c.json({ text: out });
    } catch (e) {
      if (e instanceof LlmError) return c.json({ error: 'llm_unavailable' }, 503);
      throw e;
    }
  });

  /** Student asks the assistant. Body: { text, messageId? }. The reply arrives in chat from the bot. */
  r.post('/assistant/ask', requireRole('student'), async (c) => {
    const { text, messageId } = (await c.req.json().catch(() => ({}))) as { text?: string; messageId?: string };
    if (!text?.trim() || text.length > QUESTION_MAX) return c.json({ error: 'bad_text' }, 400);
    const { sub, campusId } = c.get('session');
    const result = await ask({ db, chat, llm }, { id: sub, campusId }, text, messageId, now());
    return c.json(result);
  });

  /**
   * Safety check for a message the student just sent in any chat. Until Nexconn webhooks are live
   * (needs a public URL), the web app calls this after sending. Body: { text, messageId? }.
   */
  r.post('/safety/check', requireRole('student'), async (c) => {
    const { text, messageId } = (await c.req.json().catch(() => ({}))) as { text?: string; messageId?: string };
    if (!text?.trim()) return c.json({ alerted: false });
    const [me] = await db.select({ id: users.id }).from(users).where(eq(users.id, c.get('session').sub));
    if (!me) return c.json({ error: 'not_found' }, 404);
    const hit = await checkAndAlert(db, chat, me.id, text.slice(0, TEXT_MAX), messageId, now());
    return c.json({ alerted: Boolean(hit) });
  });

  /** Mentor/warden: check a message's tone before sending. Body: { text } → ToneResult */
  r.post('/tone', requireRole('mentor', 'warden'), async (c) => {
    const { text } = (await c.req.json().catch(() => ({}))) as { text?: string };
    if (!text?.trim() || text.length > TEXT_MAX) return c.json({ error: 'bad_text' }, 400);
    const [me] = await db.select({ lang: users.lang }).from(users).where(eq(users.id, c.get('session').sub));
    return c.json(await checkTone(llm, text.trim(), me?.lang ?? 'en'));
  });

  /**
   * Transcribe + translate a voice note for the reader. Body: { url, to?, messageId?, own? }.
   * `own: true` from a student who just sent the note also runs the safety check on the transcript.
   */
  r.post('/voice/transcribe', async (c) => {
    if (!llm) return c.json({ error: 'llm_not_configured' }, 503);
    const { url, to, messageId, own } = (await c.req.json().catch(() => ({}))) as { url?: string; to?: string; messageId?: string; own?: boolean };
    if (!url || !voiceUrlAllowed(url, voiceHosts)) return c.json({ error: 'bad_url' }, 400);
    const { sub, role } = c.get('session');
    const [me] = await db.select({ lang: users.lang }).from(users).where(eq(users.id, sub));
    const target = isLanguage(to) ? to : (me?.lang ?? 'en');
    const key = cacheKeyFor(url, target);
    let result = voiceCache.get(key);
    if (!result) {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
      if (!res?.ok) return c.json({ error: 'audio_unavailable' }, 502);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > VOICE_MAX_BYTES) return c.json({ error: 'audio_too_large' }, 413);
      try {
        const out = await transcribe(llm, { mimeType: mimeFor(res.headers.get('content-type'), url), data: buf.toString('base64') }, target);
        if (!out) return c.json({ error: 'llm_unavailable' }, 503);
        result = out;
        voiceCache.set(key, out);
      } catch (e) {
        if (e instanceof LlmError) return c.json({ error: 'llm_unavailable' }, 503);
        throw e;
      }
    }
    let alerted = false;
    if (own && role === 'student' && result.transcript) {
      alerted = Boolean(await checkAndAlert(db, chat, sub, result.transcript, messageId, now()));
    }
    return c.json({ ...result, alerted });
  });

  return r;
}
