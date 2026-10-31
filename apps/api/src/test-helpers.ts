import type { Chat } from './chat.js';
import { openDb } from './db/client.js';
import { createApp } from './app.js';

export const TEST_SECRET = 'test-secret';
export const TEST_PASSCODE = 'test-pass';

/** Records every Nexconn call instead of making it. */
export function fakeChat() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const rec =
    (fn: string, result: unknown = undefined) =>
    async (...args: unknown[]) => {
      calls.push({ fn, args });
      return result;
    };
  const chat = {
    issueAccessToken: async (userId: string) => {
      calls.push({ fn: 'issueAccessToken', args: [userId] });
      return { userId, accessToken: `tok-${userId}` };
    },
    createCommunity: rec('createCommunity'),
    createSubchannel: rec('createSubchannel'),
    joinCommunity: rec('joinCommunity'),
    addPrivateSubchannelMembers: rec('addPrivateSubchannelMembers'),
    sendCommunity: rec('sendCommunity'),
    sendDirect: rec('sendDirect', { messageIds: [] }),
    sendDirectText: rec('sendDirectText', { messageIds: [] }),
  } as unknown as Chat;
  return { chat, calls };
}

/** A clock tests can move: clock.set('2026-11-04'). */
export function testClock(start = '2026-11-04T10:00:00Z') {
  let t = new Date(start);
  return { now: () => t, set: (iso: string) => (t = new Date(iso.length === 10 ? `${iso}T10:00:00Z` : iso)) };
}

export async function testApp() {
  const handle = await openDb({ memory: true });
  const fake = fakeChat();
  const clock = testClock();
  const app = createApp({ db: handle.db, chat: fake.chat, sessionSecret: TEST_SECRET, demoPasscode: TEST_PASSCODE, webOrigin: '*', now: clock.now });
  const req = (method: string, path: string, body?: unknown, session?: string) =>
    app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { ...handle, ...fake, app, req, clock };
}
