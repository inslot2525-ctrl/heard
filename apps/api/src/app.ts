import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Chat } from './chat.js';
import type { Db } from './db/client.js';
import { authRoutes } from './routes/auth.js';

export interface AppDeps {
  db: Db;
  chat: Chat | null;
  sessionSecret: string;
  demoPasscode?: string;
  webOrigin: string;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.use('*', cors({ origin: deps.webOrigin }));

  app.get('/health', (c) => c.json({ ok: true, nexconn: Boolean(deps.chat) }));
  app.route('/auth', authRoutes(deps));

  return app;
}
