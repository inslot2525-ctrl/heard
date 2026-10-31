import { useState } from 'react';
import { useMe } from '../App';
import { api } from '../api';
import { useT } from '../i18n';
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
        <button className="btn ghost" onClick={logout}>{t.logOut}</button>
      </header>
      <main className="page">
        <section className="card">
          <h2>{t.checkInTitle}</h2>
          <p className="hint">Sends every student this week’s one-tap check-in from the Heard Assistant.</p>
          <button className="btn primary block" disabled={busy} onClick={() => void sendRound()}>{t.sendRound}</button>
          {result && <p className="small" role="status">{result}</p>}
        </section>
        <div className="section-title">{t.chats}</div>
        <ChatList />
      </main>
    </>
  );
}
