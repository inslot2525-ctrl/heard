// One Nexconn connection for the whole app, plus small helpers the screens use.
// Facts from docs/SPIKES.md: register custom types before connect; onMessageReceived gets batches;
// there is no automatic translation (we call translateMessages and cache results ourselves).

import {
  AreaCode,
  BaseChannel,
  CommunitySubChannel,
  CommunitySubChannelIdentifier,
  DirectChannel,
  DirectChannelIdentifier,
  MessageHandler,
  NCEngine,
  SendTextMessageParams,
  TranslateHandler,
  TranslateMessageParam,
  type Message,
} from '@nexconn/chat';
import { MSG } from '@heard/shared';
import { api, type ChatItem, type Lang } from './api';

const APP_KEY = import.meta.env.VITE_NEXCONN_APP_KEY as string | undefined;

export interface ChatMessage {
  id: string;
  from: string;
  sentTime: number;
  type: string;
  content: any;
  mine: boolean;
  /** "direct:<peerId>" or "community:<channelId>/<subChannelId>" */
  key: string;
}

export function chatKey(c: ChatItem) {
  return c.kind === 'direct' ? `direct:${c.peerId}` : `community:${c.channelId}/${c.subChannelId}`;
}

function keyOf(m: Message<any>, me: string): string {
  const id = m.channelIdentifier as unknown as { channelId: string; subChannelId?: string };
  if (id.subChannelId) return `community:${id.channelId}/${id.subChannelId}`;
  // For direct chats the channel ID is the other person, whoever sent it.
  return `direct:${id.channelId === me ? m.senderUserId : id.channelId}`;
}

function toChatMessage(m: Message<any>, me: string): ChatMessage {
  return { id: m.messageId, from: m.senderUserId, sentTime: m.sentTime, type: m.messageType, content: m.content, mine: m.senderUserId === me, key: keyOf(m, me) };
}

type Listener = (m: ChatMessage) => void;
const listeners = new Set<Listener>();
let me = '';
let connected: Promise<void> | null = null;

// --- translation: one request per message (batches can fail, see SPIKES C), cached by message ID ---
const pending = new Map<string, (text: string | null) => void>();
const cacheKey = (id: string, lang: Lang) => `heard.tr.${lang}.${id}`;

export function cachedTranslation(id: string, lang: Lang) {
  return localStorage.getItem(cacheKey(id, lang));
}

export function translateMessage(m: ChatMessage, lang: Lang): Promise<string | null> {
  const cached = cachedTranslation(m.id, lang);
  if (cached !== null) return Promise.resolve(cached);
  const text = typeof m.content?.text === 'string' ? m.content.text : null;
  if (!text) return Promise.resolve(null);
  return new Promise((resolve) => {
    pending.set(m.id, (out) => {
      if (out !== null) localStorage.setItem(cacheKey(m.id, lang), out);
      resolve(out);
    });
    NCEngine.translateModule
      .translateMessages({ list: [new TranslateMessageParam(m.id, 'auto', lang, text)], force: false })
      .then((r) => {
        if (r.code !== 0) pending.get(m.id)?.(null), pending.delete(m.id);
      });
    setTimeout(() => {
      if (pending.has(m.id)) pending.get(m.id)!(null), pending.delete(m.id);
    }, 10_000);
  });
}

/** Connect once per page load. Safe to call from many components. */
export function connectChat(userId: string) {
  if (connected && me === userId) return connected;
  me = userId;
  connected = (async () => {
    if (!APP_KEY) throw new Error('VITE_NEXCONN_APP_KEY is not set');
    NCEngine.initialize({ appKey: APP_KEY, areaCode: AreaCode.SG });
    NCEngine.registerCustomMessages(Object.values(MSG).map((messageType) => ({ messageType, isPersisted: true, isCounted: true })));
    NCEngine.addMessageHandler(
      'heard',
      new MessageHandler({
        onMessageReceived: ({ messages }) => {
          for (const m of messages) {
            const cm = toChatMessage(m, me);
            listeners.forEach((l) => l(cm));
          }
        },
      }),
    );
    NCEngine.addTranslateHandler(
      'heard',
      new TranslateHandler({
        onTranslationCompleted: ({ results }) => {
          for (const r of results) {
            const done = pending.get(r.identifier);
            if (!done) continue;
            pending.delete(r.identifier);
            done(r.code === 0 ? (r.translateInfo?.translatedText ?? null) : null);
          }
        },
      }),
    );
    const { token } = await api<{ token: string }>('/auth/nexconn-token', { method: 'POST', body: {} });
    const res = await NCEngine.connect({ token });
    if (res.code !== 0) throw new Error(`Nexconn connect failed: ${res.code}`);
  })();
  connected.catch(() => (connected = null));
  return connected;
}

export function onMessage(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function identifier(c: ChatItem) {
  return c.kind === 'direct' ? new DirectChannelIdentifier(c.peerId) : new CommunitySubChannelIdentifier(c.channelId, c.subChannelId);
}

export async function loadHistory(c: ChatItem, pageSize = 40): Promise<ChatMessage[]> {
  const q = BaseChannel.createMessagesQuery({ channelIdentifier: identifier(c), pageSize });
  const r = await q.loadNextPage();
  if (!r.isOk || !r.data) return [];
  return r.data.data.map((m) => toChatMessage(m, me)).sort((a, b) => a.sentTime - b.sentTime);
}

export async function sendText(c: ChatItem, text: string): Promise<ChatMessage | null> {
  const channel = c.kind === 'direct' ? new DirectChannel(c.peerId) : new CommunitySubChannel(c.channelId, c.subChannelId);
  const r = await channel.sendMessage(new SendTextMessageParams({ text }));
  return r.isOk && r.data ? toChatMessage(r.data, me) : null;
}

export async function disconnectChat() {
  try {
    await NCEngine.disconnect();
  } catch {
    /* ignore */
  }
  connected = null;
}
