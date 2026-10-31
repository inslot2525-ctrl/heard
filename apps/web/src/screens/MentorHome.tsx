import { useEffect, useState } from 'react';
import { useMe } from '../App';
import { api, type Flag } from '../api';
import { onMessage } from '../chat-client';
import { useT } from '../i18n';
import { href } from '../router';
import { ChatList } from './ChatList';

export function MentorHome({ tab }: { tab: 'inbox' | 'chats' }) {
  const t = useT();
  const { me, logout } = useMe();
  return (
    <>
      <header className="topbar">
        <h1>
          {me.user.name}
          <span className="sub">{me.campus.name}</span>
        </h1>
        <button className="btn ghost" onClick={logout}>{t.logOut}</button>
      </header>
      <nav className="tabs">
        <a href={href()} aria-current={tab === 'inbox' ? 'page' : undefined}>{t.inbox}</a>
        <a href={href('chats')} aria-current={tab === 'chats' ? 'page' : undefined}>{t.chats}</a>
      </nav>
      <main className="page">{tab === 'inbox' ? <Inbox /> : <ChatList />}</main>
    </>
  );
}

const RULE_LABEL: Record<Flag['rule'], string> = {
  repeat_struggling: 'Struggling two weeks running',
  drop_from_baseline: 'Sudden drop',
  silent: 'Gone quiet',
  wants_to_talk: 'Asked to talk',
};

export function ruleLabel(rule: Flag['rule']) {
  return RULE_LABEL[rule] ?? rule;
}

function Inbox() {
  const t = useT();
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const load = () => api<Flag[]>('/flags').then(setFlags).catch(() => setFlags([]));
  useEffect(() => {
    void load();
    // A new FlagCard in chat means the inbox changed.
    return onMessage((m) => {
      if (m.type === 'SA:FlagCard') void load();
    });
  }, []);

  if (!flags) return <div className="muted">…</div>;
  if (!flags.length) return <div className="card center muted">{t.inboxEmpty}</div>;
  const open = flags.filter((f) => f.status === 'open');
  const contacted = flags.filter((f) => f.status === 'contacted');
  return (
    <>
      {open.length > 0 && <div className="section-title">Needs you · {open.length}</div>}
      {open.length > 0 && <FlagList flags={open} />}
      {contacted.length > 0 && <div className="section-title">Contacted</div>}
      {contacted.length > 0 && <FlagList flags={contacted} />}
    </>
  );
}

function FlagList({ flags }: { flags: Flag[] }) {
  return (
    <div className="list">
      {flags.map((f) => (
        <a key={f.id} href={href('flag', f.id)}>
          <span className="avatar" aria-hidden>{f.student.name[0]}</span>
          <span className="item-main">
            <span className="item-title">{f.student.name}</span>
            <span className="item-sub">{ruleLabel(f.rule)}{f.area ? ` · ${f.area}` : ''}</span>
          </span>
          {f.status === 'open' && <span className="badge">new</span>}
        </a>
      ))}
    </div>
  );
}
