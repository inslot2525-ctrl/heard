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
import { requireSession, type AuthVars } from '../session.js';
import { requireRole } from '../session-guards.js';

export interface AiDeps {
  db: Db;
  chat: Chat | null;
  llm: Llm | null;
  sessionSecret: string;
  now: () => Date;
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

export function aiRoutes({ db, chat, llm, sessionSecret, now }: AiDeps) {
  const r = new Hono<AuthVars>();
  const cache = lru<string>(5000);
  // Scoped to this router's own paths: it's mounted at '/', so '*' would also catch other routes.
  for (const p of ['/translate', '/assistant/*', '/safety/*']) r.use(p, requireSession(sessionSecret));
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

  return r;
}
