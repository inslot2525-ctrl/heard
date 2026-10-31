import type { MiddlewareHandler } from 'hono';
import type { Role } from './db/schema.js';
import type { AuthVars } from './session.js';

/** Use after requireSession. */
export function requireRole(...roles: Role[]): MiddlewareHandler<AuthVars> {
  return async (c, next) => {
    if (!roles.includes(c.get('session').role)) return c.json({ error: 'forbidden' }, 403);
    await next();
  };
}
