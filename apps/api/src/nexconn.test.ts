import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { authHeaders, Nexconn, NexconnError, sign } from './nexconn.js';

const cfg = { appKey: 'key123', appSecret: 'secret', apiHost: 'api.sg-light-api.com' };

describe('sign', () => {
  it('is sha1(secret + nonce + timestamp) in hex', () => {
    expect(sign('secret', '14314', '1408710653491')).toBe(
      createHash('sha1').update('secret' + '14314' + '1408710653491').digest('hex'),
    );
  });
});

describe('authHeaders', () => {
  it('sets every required header', () => {
    const h = authHeaders(cfg, 1408710653491, '14314');
    expect(h).toMatchObject({ 'App-Key': 'key123', Nonce: '14314', Timestamp: '1408710653491' });
    expect(h.Signature).toBe(sign('secret', '14314', '1408710653491'));
    expect(h.Nonce.length).toBeLessThanOrEqual(18);
  });
  it('generates a nonce within 18 characters', () => {
    expect(authHeaders(cfg).Nonce.length).toBeLessThanOrEqual(18);
  });
});

describe('Nexconn.issueAccessToken', () => {
  it('posts to the token endpoint and returns the result', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 0, result: { userId: 'u1', accessToken: 'tok' } })));
    const n = new Nexconn(cfg, fetchMock as unknown as typeof fetch);
    await expect(n.issueAccessToken('u1', 'Priya')).resolves.toEqual({ userId: 'u1', accessToken: 'tok' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.sg-light-api.com/v4/auth/access-token/issue');
    expect(JSON.parse(init.body as string)).toEqual({ userId: 'u1', name: 'Priya' });
  });
  it('throws NexconnError on a non-zero code', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 1002, msg: 'bad sig' })));
    const n = new Nexconn(cfg, fetchMock as unknown as typeof fetch);
    await expect(n.issueAccessToken('u1', 'x')).rejects.toBeInstanceOf(NexconnError);
  });
});
