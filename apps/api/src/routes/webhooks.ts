// Nexconn webhooks (docs: platform-chat-api/webhook/overview). One URL for all events:
//   POST /webhooks/nexconn   headers AppKey, Nonce, Timestamp, Signature = sha1(secret + nonce + timestamp)
// We verify the signature and the App Key, reject old timestamps (replays), acknowledge immediately
// (Nexconn times out after 5 s and retries twice), then process in the background.
//
// message:send → every text message a student sends, in any chat, goes through the safety check.
// This is the server-side path; the app's own POST /safety/check stays as a backup, and the unique
// message ID on safety_events makes sure a message alerts only once.

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Chat } from '../chat.js';
import type { Db } from '../db/client.js';
import { users } from '../db/schema.js';
import { verifyWebhook } from '../nexconn.js';
import { checkAndAlert } from '../safety.js';

export interface WebhookDeps {
  db: Db;
  chat: Chat | null;
  /** null = webhooks off (Nexconn not configured). */
  nexconn: { appKey: string; appSecret: string } | null;
  now: () => Date;
}

/** Nexconn's clock and ours may differ a little; anything older than this is treated as a replay. */
export const MAX_SKEW_MS = 5 * 60_000;

interface MessageSendItem {
  userId: string;
  channelId: string;
  messageType: string;
  content: string;
  channelType: number;
  messageId: string;
  os?: string;
  subchannelId?: string;
}

export function textOf(item: MessageSendItem): string | null {
  if (item.messageType !== 'RC:TxtMsg') return null;
  try {
    const c = JSON.parse(item.content) as { content?: unknown };
    return typeof c.content === 'string' ? c.content : null;
  } catch {
    return null;
  }
}

/** Process one message:send item. Exported for tests. */
export async function handleMessageSend(deps: Pick<WebhookDeps, 'db' | 'chat' | 'now'>, item: MessageSendItem) {
  // Messages our server sends (bot replies, mirrored check-ins) are already handled where they're made.
  if (item.os === 'Server') return 'skipped_server';
  const text = textOf(item);
  if (!text) return 'skipped_not_text';
  const [sender] = await deps.db.select({ role: users.role }).from(users).where(eq(users.id, item.userId));
  if (sender?.role !== 'student') return 'skipped_not_student';
  const hit = await checkAndAlert(deps.db, deps.chat, item.userId, text, item.messageId, deps.now());
  if (!hit) return 'clean';
  return 'duplicate' in hit ? 'duplicate' : 'alerted';
}

export function webhookRoutes(deps: WebhookDeps) {
  const r = new Hono();

  r.post('/nexconn', async (c) => {
    if (!deps.nexconn) return c.json({ error: 'not_configured' }, 503);
    const h = { appKey: c.req.header('AppKey'), nonce: c.req.header('Nonce'), timestamp: c.req.header('Timestamp'), signature: c.req.header('Signature') };
    if (h.appKey !== deps.nexconn.appKey || !verifyWebhook(deps.nexconn.appSecret, h)) return c.json({ error: 'bad_signature' }, 401);
    const ts = Number(h.timestamp);
    if (!Number.isFinite(ts) || Math.abs(deps.now().getTime() - ts) > MAX_SKEW_MS) return c.json({ error: 'stale' }, 401);

    const event = (await c.req.json().catch(() => null)) as { type?: string; id?: string; data?: unknown[] } | null;
    if (!event?.type) return c.json({ error: 'bad_body' }, 400);

    if (event.type === 'message:send' && Array.isArray(event.data)) {
      const items = event.data as MessageSendItem[];
      // Acknowledge now; alerts involve several Nexconn calls and must not hit the 5 s timeout.
      void (async () => {
        for (const item of items) {
          try {
            await handleMessageSend(deps, item);
          } catch (e) {
            console.error('webhook: message:send failed', event.id, item?.messageId, e);
          }
        }
      })();
    }
    return c.json({ ok: true });
  });

  return r;
}
