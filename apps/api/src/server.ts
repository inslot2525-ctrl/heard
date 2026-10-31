import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { env, nexconnConfigured } from './env.js';
import { Nexconn } from './nexconn.js';

const nexconn = nexconnConfigured
  ? new Nexconn({ appKey: env.nexconnAppKey!, appSecret: env.nexconnAppSecret!, apiHost: env.nexconnApiHost })
  : null;

if (!nexconn) console.warn('NEXCONN_APP_KEY / NEXCONN_APP_SECRET not set: /auth/demo-login will return 503.');

serve({ fetch: createApp(nexconn).fetch, port: env.port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
