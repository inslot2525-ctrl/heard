// "What you did": the mentor's log of help for one student. Used for "improved after help".
import { useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { api } from '../api';
import { useT, type Strings } from '../i18n';

export const KINDS = ['talked', 'counsellor', 'fee_support', 'academic_help', 'peer_buddy', 'other'] as const;
type Item = { id: string; kind: string; note: string | null; week: string; flagId: string | null };

export function kindLabel(t: Strings, kind: string) {
  return (t[`help_${kind}` as keyof Strings] as string | undefined) ?? kind;
}

export function HelpLog({ studentId, items, onLogged }: { studentId: string; items: Item[]; onLogged: (row: Item) => void }) {
  const t = useT();
  const [kind, setKind] = useState<string>('talked');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function log(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const row = await api<Item>(`/students/${studentId}/interventions`, { body: { kind, note } });
      onLogged(row);
      setNote('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>
        <HeartHandshake size={16} aria-hidden /> {t.helpTitle}
      </h2>
      {items.length === 0 && <p className="small muted">{t.helpEmpty}</p>}
      <ul className="help-list">
        {items.map((h) => (
          <li key={h.id}>
            <span className="help-dot" aria-hidden />
            <span>
              <b>{kindLabel(t, h.kind)}</b> <span className="small muted">· {h.week}</span>
              {h.note && <span className="small muted block">{h.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      <form className="help-form" onSubmit={log}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t.helpKind}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(t, k)}
            </option>
          ))}
        </select>
        <input type="text" placeholder={t.helpNote} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        <button className="btn primary" disabled={busy}>
          {t.helpLog}
        </button>
      </form>
    </section>
  );
}
