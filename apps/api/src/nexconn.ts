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

  // ---- messages -------------------------------------------------------------------------------
  // Built-in types take a JSON string, e.g. RC:TxtMsg → {"content":"hi"}. Custom types (our "SA:*")
  // take any string; must not start with "RC:", max 32 chars, and must be registered on the client.

  /** docs: platform-chat-api/message/send-private. Not echoed to the sender unless isEchoToSender=1. */
  sendDirect(p: { from: string; to: string[]; messageType: string; content: string; pushContent?: string; echo?: boolean }) {
    return this.call<{ messageIds: { userId: string; messageId: string }[] }>('/v4/direct-channel/message/send', {
      fromUserId: p.from,
      toUserIds: p.to,
      messageType: p.messageType,
      content: p.content,
      ...(p.pushContent ? { pushContent: p.pushContent } : {}),
      isEchoToSender: p.echo ? 1 : 0,
    });
  }

  sendDirectText(from: string, to: string, text: string) {
    return this.sendDirect({ from, to: [to], messageType: 'RC:TxtMsg', content: JSON.stringify({ content: text }) });
  }

  /**
   * docs: platform-chat-api/message/send-direct-stream. Sends RC:StreamMsg chunks: the first call
   * (no messageId) returns the ID; later calls append; the last sets complete=true. seq starts at 1.
   */
  async sendDirectStream(from: string, to: string, chunks: AsyncIterable<string> | Iterable<string>, type: 'text' | 'markdown' = 'text') {
    let messageId: string | undefined;
    let seq = 0;
    const post = (content: string, complete: boolean) =>
      this.call<{ messageId?: string } | undefined>('/v4/direct-channel/message/stream/send', {
        fromUserId: from,
        toUserId: to,
        messageType: 'RC:StreamMsg',
        content: { content, complete, seq: ++seq, ...(messageId ? { messageId } : { type }) },
      });
    for await (const chunk of chunks) {
      const r = await post(chunk, false);
      messageId ??= r?.messageId;
    }
    await post('', true);
    return messageId;
  }

  // ---- community channels ------------------------------------------------------------------------
  // IDs: letters and digits only. Community ID ≤64 chars, subchannel ID ≤20. Max 50 subchannels.

  /** docs: platform-chat-api/community-channel/create-community-channel */
  createCommunity(channelId: string, name: string, firstMemberId: string) {
    return this.call('/v4/community-channel/create', { userId: firstMemberId, channelId, name });
  }

  /** docs: platform-chat-api/community-channel/create-channel. visibility 0 = public, 1 = private */
  createSubchannel(channelId: string, subchannelId: string, visibility: 0 | 1 = 0) {
    return this.call('/v4/community-channel/subchannel/create', { channelId, subchannelId, channelVisibility: visibility });
  }

  /** docs: platform-chat-api/community-channel/join-community-channel. One user per call. */
  joinCommunity(channelId: string, userId: string) {
    return this.call('/v4/community-channel/join', { channelId, userId });
  }

  /**
   * docs: platform-chat-api/community-channel/private-channel/add-to-private-channel-users.
   * Users must already be community members (else code 24406). Max 20 per call; we batch.
   */
  async addPrivateSubchannelMembers(channelId: string, subchannelId: string, userIds: string[]) {
    for (let i = 0; i < userIds.length; i += 20) {
      await this.call('/v4/community-channel/private-subchannel/member/add', { channelId, subchannelId, userIds: userIds.slice(i, i + 20) });
    }
  }

  /** docs: platform-chat-api/message/community-channel/send-community-channel. Sender also receives it. */
  sendCommunity(p: { from: string; channelId: string; subchannelId?: string; messageType: string; content: string; toUserIds?: string[] }) {
    return this.call('/v4/community-channel/message/send', {
      fromUserId: p.from,
      toChannelIds: [p.channelId],
      messageType: p.messageType,
      content: p.content,
      ...(p.subchannelId ? { subchannelId: p.subchannelId } : {}),
      ...(p.toUserIds ? { toUserIds: p.toUserIds } : {}),
    });
  }
}

/**
 * docs: platform-chat-api/webhook/overview. Webhook headers: AppKey, Nonce, Timestamp, Signature,
 * with Signature = sha1(appSecret + nonce + timestamp), lowercase hex. Same scheme as our requests.
 */
export function verifyWebhook(appSecret: string, h: { nonce?: string | null; timestamp?: string | null; signature?: string | null }) {
  if (!h.nonce || !h.timestamp || !h.signature) return false;
  return sign(appSecret, h.nonce, h.timestamp) === h.signature.toLowerCase();
}
