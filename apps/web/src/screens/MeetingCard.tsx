// "Prepare for the talk": strengths first, what changed, questions to ask, what to avoid.
// Facts were checked against the records on the server; points that failed are listed as removed.
import { useState } from 'react';
import { CheckCircle2, ClipboardList, Printer } from 'lucide-react';
import type { AskReceipt } from '@heard/shared';
import { api } from '../api';
import { useT } from '../i18n';

interface Point {
  text: string;
  receipts: AskReceipt[];
}
interface Card {
  student: string;
  strengths: Point[];
  changes: Point[];
  questions: string[];
  avoid: string[];
  removed: string[];
  unavailable?: boolean;
}

function Points({ items }: { items: Point[] }) {
  return (
    <ul className="m-points">
      {items.map((p) => (
        <li key={p.text}>
          {p.text}
          <span className="m-receipts">
            {p.receipts.map((r, i) => (
              <span key={i} className="receipt ok">
                <CheckCircle2 size={12} aria-hidden /> {r.week} · {r.area}: {r.value}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MeetingCardButton({ flagId }: { flagId: string }) {
  const t = useT();
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      setCard(await api<Card>('/mentor/meeting-card', { body: { flagId } }));
    } catch {
      setCard({ student: '', strengths: [], changes: [], questions: [], avoid: [], removed: [], unavailable: true });
    } finally {
      setBusy(false);
    }
  }

  function print() {
    document.body.classList.add('print-meeting');
    window.print();
    setTimeout(() => document.body.classList.remove('print-meeting'), 500);
  }

  if (!card) {
    return (
      <button className="btn block" disabled={busy} onClick={() => void load()}>
        <ClipboardList size={17} aria-hidden /> {busy ? t.preparing : t.prepareTalk}
      </button>
    );
  }
  if (card.unavailable) return <div className="card small muted">{t.meetingUnavailable}</div>;
  return (
    <section className="card meeting" aria-labelledby="meeting-title">
      <div className="row">
        <h2 id="meeting-title">
          {t.meetingTitle}: {card.student}
        </h2>
        <span className="spacer" />
        <button className="btn ghost no-print" onClick={print}>
          <Printer size={16} aria-hidden /> {t.print}
        </button>
      </div>
      {card.strengths.length > 0 && (
        <>
          <h3>{t.meetingStrengths}</h3>
          <Points items={card.strengths} />
        </>
      )}
      {card.changes.length > 0 && (
        <>
          <h3>{t.meetingChanges}</h3>
          <Points items={card.changes} />
        </>
      )}
      {card.questions.length > 0 && (
        <>
          <h3>{t.meetingQuestions}</h3>
          <ul className="m-points">
            {card.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
      {card.avoid.length > 0 && (
        <>
          <h3>{t.meetingAvoid}</h3>
          <ul className="m-points">
            {card.avoid.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        {t.meetingFootnote}
        {card.removed.length > 0 ? ` ${t.meetingRemoved.replace('{n}', String(card.removed.length))}` : ''}
      </p>
    </section>
  );
}
