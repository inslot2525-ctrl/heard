import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openDb } from './db/client.js';
import { env, nexconnConfigured, sessionSecret } from './env.js';
import { Nexconn } from './nexconn.js';

const chat = nexconnConfigured
  ? new Nexconn({ appKey: env.nexconnAppKey!, appSecret: env.nexconnAppSecret!, apiHost: env.nexconnApiHost })
  : null;
if (!chat) console.warn('NEXCONN_APP_KEY / NEXCONN_APP_SECRET not set: chat features are off.');

const { db } = await openDb({ url: env.databaseUrl });
console.log(`database: ${env.databaseUrl ? 'Postgres (DATABASE_URL)' : 'embedded PGlite (apps/api/.pglite)'}`);

const app = createApp({ db, chat, sessionSecret: sessionSecret(), demoPasscode: env.demoPasscode, webOrigin: env.webOrigin });

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
