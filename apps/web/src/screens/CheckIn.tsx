// The weekly one-tap check-in. Four rows, three choices each, optional note, "I'd like to talk".
import { useEffect, useState } from 'react';
import { api, type Level, type Pulse } from '../api';
import { useT } from '../i18n';

const AREAS = ['studies', 'money', 'health', 'home'] as const;
type Area = (typeof AREAS)[number];

export function CheckIn() {
  const t = useT();
  const [week, setWeek] = useState<string | null>(null);
  const [saved, setSaved] = useState<Pulse | null>(null);
  const [editing, setEditing] = useState(false);
  const [levels, setLevels] = useState<Partial<Record<Area, Level>>>({});
  const [note, setNote] = useState('');
  const [talk, setTalk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [mentorNotified, setMentorNotified] = useState(false);

  useEffect(() => {
    api<{ week: string; answer: Pulse | null }>('/pulse/current').then((r) => {
      setWeek(r.week);
      setSaved(r.answer);
      if (r.answer) {
        setLevels({ studies: r.answer.studies, money: r.answer.money, health: r.answer.health, home: r.answer.home });
        setNote(r.answer.note ?? '');
        setTalk(r.answer.wantsToTalk);
      }
    });
  }, []);

  const complete = AREAS.every((a) => levels[a] !== undefined);

  async function submit() {
    if (!week || !complete) return;
    setBusy(true);
    setErr(false);
    try {
      const r = await api<{ saved: { id: string; week: string }; mentorNotified: boolean }>('/pulse', {
        body: { week, levels, note, wantsToTalk: talk },
      });
      setMentorNotified(r.mentorNotified || talk);
      setSaved({ id: r.saved.id, week, ...(levels as Record<Area, Level>), note, wantsToTalk: talk });
      setEditing(false);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  if (!week) return <div className="card muted">…</div>;

  if (saved && !editing) {
    return (
      <div className="card done" id="checkin">
        <div className="tick" aria-hidden>✓</div>
        <div className="item-main">
          <div style={{ fontWeight: 600 }}>{mentorNotified ? t.checkInDoneMentor : t.checkInDone}</div>
          <div className="dots small" aria-label={t.checkInTitle}>
            {AREAS.map((a) => (
              <span key={a} className="dot" data-level={saved[a]} title={`${t[a]}`} />
            ))}
            <span className="muted" style={{ marginLeft: '0.4rem' }}>{week}</span>
          </div>
        </div>
        <button className="btn ghost" onClick={() => setEditing(true)}>{t.change}</button>
      </div>
    );
  }

  const labels: Record<Level, string> = { 2: t.good, 1: t.ok, 0: t.struggling };
  return (
    <section className="card" id="checkin" aria-labelledby="checkin-title">
      <h2 id="checkin-title">{t.checkInTitle}</h2>
      <p className="hint">{t.checkInSub}</p>
      {AREAS.map((a) => (
        <div className="pulse-row" key={a} role="radiogroup" aria-label={t[a]}>
          <span className="label">{t[a]}</span>
          <div className="levels">
            {([2, 1, 0] as Level[]).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={levels[a] === l}
                aria-pressed={levels[a] === l}
                data-level={l}
                onClick={() => setLevels((s) => ({ ...s, [a]: l }))}
              >
                {labels[l]}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="field" style={{ marginTop: '0.75rem' }}>
        <label htmlFor="note">{t.noteLabel}</label>
        <textarea id="note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <label className="check">
        <input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} />
        {t.wantsToTalk}
      </label>
      {err && <p className="error" role="alert">{t.error}</p>}
      <button className="btn primary block" disabled={!complete || busy} onClick={() => void submit()}>
        {busy ? t.sending : t.send}
      </button>
    </section>
  );
}
