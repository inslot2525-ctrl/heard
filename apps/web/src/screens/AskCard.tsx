// Ask Heard's answer in chat: the answer, then each receipt. Code verified the receipts against the
// records: verified ones link to the student's journey; anything else is shown as unverified.
import { CheckCircle2, CircleAlert } from 'lucide-react';
import type { AskAnswer } from '@heard/shared';
import { useT } from '../i18n';
import { areaLabel } from './Register';
import { href } from '../router';

export function AskCard({ a }: { a: AskAnswer }) {
  const t = useT();
  if (!a?.answer) return <div className="bubble muted">[answer]</div>;
  return (
    <div className="mcard ask">
      {a.question && <div className="small muted">“{a.question}”</div>}
      <div className="ask-answer">{a.answer}</div>
      {a.receipts?.length > 0 && (
        <div className="receipts">
          <div className="label">{t.receipts}</div>
          {a.receipts.map((r, i) =>
            r.verified && r.studentId ? (
              <a key={i} className="receipt ok" href={href('student', r.studentId)}>
                <CheckCircle2 size={14} aria-hidden /> {r.student} · {r.week} · {areaLabel(t, r.area)}: <b>{r.value}</b>
              </a>
            ) : (
              <span key={i} className="receipt bad" title={t.receiptUnverified}>
                <CircleAlert size={14} aria-hidden /> {r.student} · {r.week} · {areaLabel(t, r.area)}: {r.value} · {t.receiptUnverified}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Starter questions shown in an empty Ask Heard chat. */
export function AskSuggestions({ onPick }: { onPick: (q: string) => void }) {
  const t = useT();
  return (
    <div className="ask-suggest">
      <div className="small muted">{t.askTry}</div>
      {[t.askQ1, t.askQ2, t.askQ3].map((q) => (
        <button key={q} type="button" className="chip" onClick={() => onPick(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}
