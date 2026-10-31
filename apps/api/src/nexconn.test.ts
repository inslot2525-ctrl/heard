import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { authHeaders, Nexconn, NexconnError, sign, verifyWebhook } from './nexconn.js';

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

describe('verifyWebhook', () => {
  const good = { nonce: '8f3a2b1c', timestamp: '1709020800000', signature: sign('secret', '8f3a2b1c', '1709020800000') };
  it('accepts a correct signature, case-insensitively', () => {
    expect(verifyWebhook('secret', good)).toBe(true);
    expect(verifyWebhook('secret', { ...good, signature: good.signature.toUpperCase() })).toBe(true);
  });
  it('rejects a wrong secret or missing headers', () => {
    expect(verifyWebhook('other', good)).toBe(false);
    expect(verifyWebhook('secret', { ...good, signature: null })).toBe(false);
  });
});

describe('Nexconn.sendDirectStream', () => {
  it('numbers chunks from 1, reuses the first messageId, and ends with complete=true', async () => {
    const bodies: any[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return new Response(JSON.stringify({ code: 0, result: bodies.length === 1 ? { messageId: 'M1' } : undefined }));
    });
    const n = new Nexconn(cfg, fetchMock as unknown as typeof fetch);
    await expect(n.sendDirectStream('bot', 'alice', ['a', 'b'])).resolves.toBe('M1');
    expect(bodies.map((b) => [b.content.seq, b.content.complete, b.content.messageId])).toEqual([
      [1, false, undefined],
      [2, false, 'M1'],
      [3, true, 'M1'],
    ]);
    expect(bodies[0].content.type).toBe('text');
  });
});
