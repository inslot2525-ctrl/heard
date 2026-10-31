import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env, nexconnConfigured } from './env.js';
import { Nexconn, NexconnError } from './nexconn.js';

export function createApp(nexconn: Nexconn | null) {
  const app = new Hono();
  app.use('*', cors({ origin: env.webOrigin }));

  app.get('/health', (c) => c.json({ ok: true, nexconn: nexconnConfigured }));

  // Demo login: passcode + chosen user ID → Nexconn access token.
  // Temporary until /auth with the DB lands (plan: Nov 5). Never exposes the App Secret.
  app.post('/auth/demo-login', async (c) => {
    if (!nexconn) return c.json({ error: 'nexconn_not_configured' }, 503);
    const body = await c.req.json().catch(() => ({}));
    const { passcode, userId, name } = body as { passcode?: string; userId?: string; name?: string };
    if (!env.demoPasscode || passcode !== env.demoPasscode) return c.json({ error: 'bad_passcode' }, 401);
    if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) return c.json({ error: 'bad_user_id' }, 400);
    try {
      const { accessToken } = await nexconn.issueAccessToken(userId, name?.trim() || userId);
      return c.json({ userId, token: accessToken });
    } catch (e) {
      if (e instanceof NexconnError) {
        console.error(e.message, JSON.stringify(e.body));
        return c.json({ error: 'nexconn_error', code: e.code }, 502);
      }
      throw e;
    }
  });

  return app;
}
