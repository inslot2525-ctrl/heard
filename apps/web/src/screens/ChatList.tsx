import { useEffect, useState } from 'react';
import { api, type ChatItem } from '../api';
import { chatKey, onMessage } from '../chat-client';
import { useT, type Strings } from '../i18n';
import { href } from '../router';

export function chatRoute(c: ChatItem) {
  return c.kind === 'direct' ? href('chat', 'direct', c.peerId) : href('chat', 'community', c.channelId, c.subChannelId);
}

const ICON: Record<ChatItem['role'], string> = {
  mentor: '',
  student: '',
  staff: '',
  assistant: '✦',
  hostel: '⌂',
  notices: '!',
  mentors: '🔒',
};

/** Server titles are English; show role-based labels in the user's language. */
export function chatLabels(c: ChatItem, t: Strings): { title: string; subtitle?: string } {
  switch (c.role) {
    case 'mentor': return { title: c.title, subtitle: t.yourMentor };
    case 'assistant':
      return c.title === 'Ask Heard' ? { title: t.askHeard, subtitle: t.askHeardSub } : { title: t.assistantTitle, subtitle: t.assistantSub };
    case 'notices': return { title: t.noticesTitle };
    case 'mentors': return { title: t.mentorsRoom, subtitle: t.mentorsRoomSub };
    default: return { title: c.title, subtitle: c.subtitle };
  }
}

export function useChats() {
  const [chats, setChats] = useState<ChatItem[] | null>(null);
  useEffect(() => {
    api<ChatItem[]>('/chats').then(setChats).catch(() => setChats([]));
  }, []);
  return chats;
}

/** Unread dots for chats that got a message since this page opened (simple, client-side). */
function useUnread() {
  const [unread, setUnread] = useState<Record<string, number>>({});
  useEffect(
    () =>
      onMessage((m) => {
        if (!m.mine) setUnread((u) => ({ ...u, [m.key]: (u[m.key] ?? 0) + 1 }));
      }),
    [],
  );
  return unread;
}

export function ChatList({ filter }: { filter?: (c: ChatItem) => boolean }) {
  const t = useT();
  const chats = useChats();
  const unread = useUnread();
  if (!chats) return <div className="muted small">…</div>;
  const shown = filter ? chats.filter(filter) : chats;
  return (
    <nav className="list" aria-label={t.chats}>
      {shown.map((c) => {
        const n = unread[chatKey(c)];
        const label = chatLabels(c, t);
        return (
          <a key={chatKey(c)} href={chatRoute(c)}>
            <span className="avatar" aria-hidden>{ICON[c.role] || c.title.replace(/^(Prof\.|Dr\.|Mrs\.)\s*/, '')[0]}</span>
            <span className="item-main">
              <span className="item-title">{label.title}</span>
              {label.subtitle && <span className="item-sub">{label.subtitle}</span>}
            </span>
            {n ? <span className="badge">{n}</span> : null}
          </a>
        );
      })}
    </nav>
  );
}

/** Chats as a page of its own (sidebar / bottom tab "Chats"). */
export function ChatsPage() {
  const t = useT();
  return (
    <div className="page">
      <h1 className="page-title">{t.chats}</h1>
      <ChatList />
    </div>
  );
}
