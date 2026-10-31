// Tiny in-memory fixed-window rate limiter. Good enough for one API instance (Render free tier).
import type { MiddlewareHandler } from 'hono';

export function rateLimit(opts: { max: number; windowMs: number; key?: (ip: string) => string }): MiddlewareHandler {
  const hits = new Map<string, { n: number; reset: number }>();
  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'local';
    const key = opts.key ? opts.key(ip) : ip;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset <= now) {
      h = { n: 0, reset: now + opts.windowMs };
      hits.set(key, h);
    }
    if (++h.n > opts.max) {
      c.header('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return c.json({ error: 'too_many_attempts' }, 429);
    }
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    await next();
  };
}
