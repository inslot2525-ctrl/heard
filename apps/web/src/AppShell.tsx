// App shell: left sidebar + top bar on desktop, compact top bar + bottom tabs on phones.
// Navigation depends on the role; screens render only their content.
import { useEffect, useState, type ReactNode } from 'react';
import { Bell, House, Inbox, LayoutDashboard, LogOut, Megaphone, MessageCircle, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { useMe } from './App';
import { api, type Flag } from './api';
import { onMessage } from './chat-client';
import { useT } from './i18n';
import { href, useRoute } from './router';
import { LanguageSwitch } from './screens/LanguageSwitch';

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  /** Route prefixes that count as "this item is active". */
  match: (route: string[]) => boolean;
}

function useNav(): NavItem[] {
  const t = useT();
  const { me } = useMe();
  const campus = me.user.campusId;
  if (me.user.role === 'student') {
    return [
      { key: 'home', label: t.navHome, icon: House, to: href(), match: (r) => r.length === 0 },
      { key: 'chats', label: t.chats, icon: MessageCircle, to: href('chats'), match: (r) => r[0] === 'chats' || (r[0] === 'chat' && r[2] !== `${campus}bot`) },
      { key: 'assistant', label: t.assistantTitle, icon: Sparkles, to: href('chat', 'direct', `${campus}bot`), match: (r) => r[0] === 'chat' && r[2] === `${campus}bot` },
    ];
  }
  if (me.user.role === 'mentor') {
    return [
      { key: 'inbox', label: t.inbox, icon: Inbox, to: href(), match: (r) => r.length === 0 || r[0] === 'flag' },
      { key: 'students', label: t.students, icon: Users, to: href('students'), match: (r) => r[0] === 'students' || r[0] === 'student' },
      { key: 'chats', label: t.chats, icon: MessageCircle, to: href('chats'), match: (r) => r[0] === 'chats' || (r[0] === 'chat' && r[2] !== `${campus}bot`) },
      { key: 'ask', label: t.askHeard, icon: Sparkles, to: href('chat', 'direct', `${campus}bot`), match: (r) => r[0] === 'chat' && r[2] === `${campus}bot` },
    ];
  }
  return [
    { key: 'overview', label: t.navOverview, icon: LayoutDashboard, to: href(), match: (r) => r.length === 0 },
    { key: 'chats', label: t.chats, icon: MessageCircle, to: href('chats'), match: (r) => r[0] === 'chats' || (r[0] === 'chat' && r[3] !== 'notices') },
    { key: 'notices', label: t.noticesTitle, icon: Megaphone, to: href('chat', 'community', campus, 'notices'), match: (r) => r[0] === 'chat' && r[3] === 'notices' },
  ];
}

/** Open flags for mentors (the bell), kept fresh when a FlagCard arrives. */
function useOpenFlags() {
  const { me } = useMe();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (me.user.role !== 'mentor') return;
    const load = () =>
      api<Flag[]>('/flags?status=open')
        .then((f) => setN(f.length))
        .catch(() => undefined);
    void load();
    return onMessage((m) => {
      if (m.type === 'SA:FlagCard') void load();
    });
  }, [me.user.role]);
  return n;
}

function initials(name: string) {
  return name
    .replace(/^(Prof\.|Dr\.|Mrs\.|Mr\.|Ms\.)\s*/, '')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const t = useT();
  const { me, logout } = useMe();
  const route = useRoute();
  const nav = useNav();
  const openFlags = useOpenFlags();
  const roleLabel = { student: t.roleStudent, mentor: t.roleMentor, warden: t.roleWarden }[me.user.role];

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main">
        <a className="logo" href={href()}>
          <span className="logo-mark" aria-hidden>
            H
          </span>
          Heard
        </a>
        <nav>
          {nav.map((n) => (
            <a key={n.key} href={n.to} className="nav-item" aria-current={n.match(route) ? 'page' : undefined}>
              <n.icon size={19} strokeWidth={1.9} aria-hidden />
              <span>{n.label}</span>
              {n.key === 'inbox' && openFlags > 0 && <span className="count">{openFlags}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="small muted">{me.campus.name}</div>
        </div>
      </aside>

      <div className="main">
        <header className="appbar">
          <a className="logo mobile-only" href={href()}>
            <span className="logo-mark" aria-hidden>
              H
            </span>
          </a>
          <div className="appbar-title">
            <div className="campus">{me.campus.name}</div>
            {me.hostel && <div className="small muted">{me.hostel.name}</div>}
          </div>
          <span className="spacer" />
          {me.user.role === 'mentor' && (
            <a className="icon-btn" href={href()} aria-label={`${t.inbox}: ${openFlags}`}>
              <Bell size={19} strokeWidth={1.9} />
              {openFlags > 0 && <span className="dot-count">{openFlags}</span>}
            </a>
          )}
          <LanguageSwitch />
          <div className="me" title={me.user.name}>
            <span className="avatar sm">{initials(me.user.name)}</span>
            <span className="me-text desktop-only">
              <span className="me-name">{me.user.name}</span>
              <span className="small muted">{roleLabel}</span>
            </span>
          </div>
          <button className="icon-btn" onClick={logout} aria-label={t.logOut} title={t.logOut}>
            <LogOut size={18} strokeWidth={1.9} />
          </button>
        </header>
        <main className={`content${wide ? ' wide' : ''}`}>{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {nav.map((n) => (
          <a key={n.key} href={n.to} aria-current={n.match(route) ? 'page' : undefined}>
            <span className="bn-icon">
              <n.icon size={21} strokeWidth={1.9} aria-hidden />
              {n.key === 'inbox' && openFlags > 0 && <span className="dot-count">{openFlags}</span>}
            </span>
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
