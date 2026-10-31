import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { flagRoutes } from './routes/flags.js';
import { pulseRoutes } from './routes/pulse.js';
import { chatRoutes } from './routes/chats.js';
import { aiRoutes } from './routes/ai.js';
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
  /** Injectable clock, so tests can move through weeks. */
  now?: () => Date;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const now = deps.now ?? (() => new Date());
  app.use('*', cors({ origin: deps.webOrigin }));

  app.get('/health', (c) => c.json({ ok: true, nexconn: Boolean(deps.chat), llm: Boolean(deps.llm) }));
  app.route('/auth', authRoutes(deps));
  app.route('/pulse', pulseRoutes({ ...deps, now }));
  app.route('/flags', flagRoutes(deps));
  app.route('/chats', chatRoutes(deps));
  app.route('/', aiRoutes({ ...deps, llm: deps.llm ?? null, now }));

  return app;
}
