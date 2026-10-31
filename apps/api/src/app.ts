import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { flagRoutes } from './routes/flags.js';
import { pulseRoutes } from './routes/pulse.js';

export interface AppDeps {
  db: Db;
  chat: Chat | null;
  sessionSecret: string;
  demoPasscode?: string;
  webOrigin: string;
  /** Injectable clock, so tests can move through weeks. */
  now?: () => Date;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const now = deps.now ?? (() => new Date());
  app.use('*', cors({ origin: deps.webOrigin }));

  app.get('/health', (c) => c.json({ ok: true, nexconn: Boolean(deps.chat) }));
  app.route('/auth', authRoutes(deps));
  app.route('/pulse', pulseRoutes({ ...deps, now }));
  app.route('/flags', flagRoutes(deps));

  return app;
}
