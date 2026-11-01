import { useEffect, useState } from 'react';
import { api } from '../api';
import { useT } from '../i18n';
import { ChatList } from './ChatList';
import { themeLabel } from './NoteText';
import { languageName } from '@heard/shared';

export function WardenHome() {
  const t = useT();
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
    <div className="page">
      <h1 className="page-title">{t.navOverview}</h1>
      <div className="grid-2">
        <section className="card">
          <h2>{t.checkInTitle}</h2>
          <p className="hint">{t.sendRoundHint}</p>
          <button className="btn primary block" disabled={busy} onClick={() => void sendRound()}>{t.sendRound}</button>
          {result && <p className="small" role="status">{result}</p>}
        </section>
        <PilotStats />
      </div>
      <div className="section-title">{t.chats}</div>
      <ChatList />
    </div>
  );
}

interface Stats {
  students: number;
  mentors: number;
  checkIns: { week: string; answered: number }[];
  conversationsStarted: number;
  safetyAlerts: number;
  themes: { theme: string; n: number }[];
  fairness: { byHostel: Group[]; byLanguage: Group[] };
}

interface Group {
  group: string;
  students: number;
  flagged: number;
  rate: number;
}

function FairnessTable({ title, rows, label }: { title: string; rows: Group[]; label: (g: string) => string }) {
  const t = useT();
  if (!rows.length) return null;
  return (
    <div className="fair">
      <div className="small muted">{title}</div>
      {rows.map((r) => (
        <div key={r.group} className="fair-row">
          <span>{label(r.group)}</span>
          <span className="fair-bar">
            <span style={{ width: `${Math.round(r.rate * 100)}%` }} />
          </span>
          <span className="small muted">
            {r.flagged}/{r.students} {t.flaggedShort}
          </span>
        </div>
      ))}
    </div>
  );
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
      {s.themes?.length > 0 && (
        <>
          <div className="small muted" style={{ marginTop: '0.9rem' }}>{t.themesTitle}</div>
          <div className="themes" style={{ marginTop: '0.35rem' }}>
            {s.themes.map((x) => (
              <span key={x.theme} className="theme-chip">
                {themeLabel(t, x.theme)} · {x.n}
              </span>
            ))}
          </div>
        </>
      )}
      {s.fairness && (
        <>
          <h2 style={{ marginTop: '1.1rem' }}>{t.fairnessTitle}</h2>
          <p className="hint">{t.fairnessHint}</p>
          <FairnessTable title={t.byHostel} rows={s.fairness.byHostel} label={(g) => g} />
          <FairnessTable title={t.byLanguage} rows={s.fairness.byLanguage} label={(g) => languageName(g)} />
        </>
      )}
    </section>
  );
}
