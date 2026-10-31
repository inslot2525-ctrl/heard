// Minimal Nexconn server API client.
// Auth (docs: platform-chat-api/prepare-to-use-api/auth): headers App-Key, Nonce, Timestamp (ms),
// Signature = sha1(appSecret + nonce + timestamp). JSON bodies.
// Base URLs (docs: .../base-url): Singapore api.sg-light-api.com, backup api-b.sg-light-api.com.

import { createHash, randomBytes } from 'node:crypto';

export interface NexconnConfig {
  appKey: string;
  appSecret: string;
  /** e.g. "api.sg-light-api.com" */
  apiHost: string;
}

export function sign(appSecret: string, nonce: string, timestamp: string): string {
  return createHash('sha1').update(appSecret + nonce + timestamp).digest('hex');
}

export function authHeaders(cfg: NexconnConfig, now = Date.now(), nonce = randomBytes(6).toString('hex')) {
  const timestamp = String(now);
  return {
    'App-Key': cfg.appKey,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: sign(cfg.appSecret, nonce, timestamp),
    'Content-Type': 'application/json',
  };
}

export class NexconnError extends Error {
  constructor(public path: string, public code: number | string, public body: unknown) {
    super(`Nexconn ${path} failed: ${code}`);
  }
}

export class Nexconn {
  constructor(private cfg: NexconnConfig, private fetchImpl: typeof fetch = fetch) {}

  async call<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`https://${this.cfg.apiHost}${path}`, {
      method: 'POST',
      headers: authHeaders(this.cfg),
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { code?: number; result?: T } | null;
    if (!res.ok || !json || json.code !== 0) throw new NexconnError(path, json?.code ?? res.status, json);
    return json.result as T;
  }

  /** docs: platform-chat-api/user/register. Creates the user if new and returns a client token. */
  issueAccessToken(userId: string, name: string, avatarUrl?: string) {
    return this.call<{ userId: string; accessToken: string }>('/v4/auth/access-token/issue', {
      userId,
      name: name.slice(0, 64),
      ...(avatarUrl ? { avatarUrl } : {}),
    });
  }
}
