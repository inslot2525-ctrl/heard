import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// One .env at the repo root, shared by api and web.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

function opt(name: string) {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export const env = {
  port: Number(opt('PORT') ?? 8787),
  webOrigin: opt('WEB_ORIGIN') ?? 'http://localhost:5173',
  nexconnAppKey: opt('NEXCONN_APP_KEY'),
  nexconnAppSecret: opt('NEXCONN_APP_SECRET'),
  nexconnApiHost: opt('NEXCONN_API_HOST') ?? 'api.sg-light-api.com',
  demoPasscode: opt('DEMO_PASSCODE'),
};

export const nexconnConfigured = Boolean(env.nexconnAppKey && env.nexconnAppSecret);
