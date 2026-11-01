import { useEffect, useState } from 'react';
import { useMe } from '../App';
import { api } from '../api';
import { useT } from '../i18n';
import { LanguageSwitch } from './LanguageSwitch';
import { ChatList } from './ChatList';

export function WardenHome() {
  const t = useT();
  const { me, logout } = useMe();
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendRound() {
    setBusy(true);
    try {
      const r = await api<{ week: string; sent: number; newFlags: number }>('/pulse/rounds', { body: {} });
      setResult(`${t.roundSent.replace('{n}', String(r.sent))} · ${r.week}`);
    } catch {
      setResult(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <h1>
          {me.user.name}
          <span className="sub">{me.campus.name}</span>
        </h1>
        <LanguageSwitch />
        <button className="btn ghost" onClick={logout}>{t.logOut}</button>
      </header>
      <main className="page">
        <section className="card">
          <h2>{t.checkInTitle}</h2>
          <p className="hint">{t.sendRoundHint}</p>
          <button className="btn primary block" disabled={busy} onClick={() => void sendRound()}>{t.sendRound}</button>
          {result && <p className="small" role="status">{result}</p>}
        </section>
        <PilotStats />
        <div className="section-title">{t.chats}</div>
        <ChatList />
      </main>
    </>
  );
}

interface Stats {
  students: number;
  mentors: number;
  checkIns: { week: string; answered: number }[];
  conversationsStarted: number;
  safetyAlerts: number;
}

/** Counts only: what the warden may see, and the pilot’s traction proof. */
function PilotStats() {
  const t = useT();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    api<Stats>('/pulse/stats').then(setS).catch(() => setS(null));
  }, []);
  if (!s) return null;
  const max = Math.max(1, s.students, ...s.checkIns.map((w) => w.answered));
  return (
    <section className="card" aria-labelledby="pilot-title">
      <h2 id="pilot-title">{t.pilotTitle}</h2>
      <div className="stats">
        <div className="stat"><b>{s.students}</b>{t.statStudents}</div>
        <div className="stat"><b>{s.mentors}</b>{t.statMentors}</div>
        <div className="stat"><b>{s.conversationsStarted}</b>{t.statConversations}</div>
        <div className="stat"><b>{s.safetyAlerts}</b>{t.statSafety}</div>
      </div>
      <div className="small muted">{t.statCheckIns}</div>
      <div className="bars">
        {s.checkIns.map((w) => (
          <div key={w.week} title={`${w.week}: ${w.answered}`}>
            <span>{w.answered}</span>
            <span className="bar" style={{ height: `${(w.answered / max) * 100}%` }} />
            <span>{w.week.slice(-3)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
