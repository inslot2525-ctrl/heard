import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { flagRoutes } from './routes/flags.js';
import { pulseRoutes } from './routes/pulse.js';
import { chatRoutes } from './routes/chats.js';
import { aiRoutes } from './routes/ai.js';
import { webhookRoutes } from './routes/webhooks.js';
import { studentRoutes } from './routes/students.js';
import type { Llm } from './llm.js';

export interface AppDeps {
  db: Db;
  chat: Chat | null;
  sessionSecret: string;
  demoPasscode?: string;
  /** Allowed browser origins; '*' allows any (tests). */
  webOrigin: string | string[];
  /** Gemini; null = AI features off (translation falls back to Nexconn, assistant hands off). */
  llm?: Llm | null;
  /** App Key + Secret for verifying Nexconn webhooks; null = webhooks off. */
  nexconnWebhook?: { appKey: string; appSecret: string } | null;
  /** Tests: replaces fetch when downloading voice notes. */
  voiceFetch?: typeof fetch;
  /** Injectable clock, so tests can move through weeks. */
  now?: () => Date;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const now = deps.now ?? (() => new Date());
  app.use('*', cors({ origin: deps.webOrigin }));

  app.get('/health', (c) => c.json({ ok: true, nexconn: Boolean(deps.chat), llm: Boolean(deps.llm) }));
  app.route('/auth', authRoutes(deps));
  app.route('/pulse', pulseRoutes({ ...deps, now, llm: deps.llm ?? null }));
  app.route('/flags', flagRoutes({ ...deps, now }));
  app.route('/chats', chatRoutes(deps));
  app.route('/students', studentRoutes({ ...deps, now }));
  app.route('/webhooks', webhookRoutes({ db: deps.db, chat: deps.chat, nexconn: deps.nexconnWebhook ?? null, now }));
  app.route('/', aiRoutes({ ...deps, llm: deps.llm ?? null, now, fetchImpl: deps.voiceFetch }));

  return app;
}
