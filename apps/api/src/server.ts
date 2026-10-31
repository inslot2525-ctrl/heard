import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openDb } from './db/client.js';
import { env, nexconnConfigured, sessionSecret } from './env.js';
import { Nexconn } from './nexconn.js';
import { geminiLlm } from './llm.js';

const chat = nexconnConfigured
  ? new Nexconn({ appKey: env.nexconnAppKey!, appSecret: env.nexconnAppSecret!, apiHost: env.nexconnApiHost })
  : null;
if (!chat) console.warn('NEXCONN_APP_KEY / NEXCONN_APP_SECRET not set: chat features are off.');

const { db } = await openDb({ url: env.databaseUrl });
console.log(`database: ${env.databaseUrl ? 'Postgres (DATABASE_URL)' : 'embedded PGlite (apps/api/.pglite)'}`);

const llm = env.geminiApiKey ? geminiLlm({ apiKey: env.geminiApiKey, models: env.geminiModels }) : null;
if (!llm) console.warn('GEMINI_API_KEY not set: AI translation and the assistant are off.');

const app = createApp({ db, chat, llm, sessionSecret: sessionSecret(), demoPasscode: env.demoPasscode, webOrigin: env.webOrigins });

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
