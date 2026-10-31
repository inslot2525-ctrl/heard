// Stateless sessions: an HS256 JWT in the Authorization header. The token is the credential
// (no passwords in the MVP), so it is long-lived and stored by the web app.

import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';
import type { Role } from './db/schema.js';

export interface Session {
  sub: string;
  campusId: string;
  role: Role;
}

const SIXTY_DAYS = 60 * 24 * 3600;

export function createSession(secret: string, s: Session, now = Math.floor(Date.now() / 1000)) {
  return sign({ ...s, iat: now, exp: now + SIXTY_DAYS }, secret, 'HS256');
}

export type AuthVars = { Variables: { session: Session } };

export function requireSession(secret: string): MiddlewareHandler<AuthVars> {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) return c.json({ error: 'not_logged_in' }, 401);
    try {
      const p = await verify(token, secret, 'HS256');
      c.set('session', { sub: String(p.sub), campusId: String(p.campusId), role: p.role as Role });
    } catch {
      return c.json({ error: 'bad_session' }, 401);
    }
    await next();
  };
}
