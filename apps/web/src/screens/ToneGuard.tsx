// Tone Guard for mentors: before a message goes out, check its wording. If something reads as
// judgemental, show why and a kinder rewrite; the mentor picks "use suggestion", edits, or sends anyway.
import { api } from '../api';
import { useT } from '../i18n';

export interface ToneResult {
  ok: boolean;
  issues: string[];
  suggestion?: string;
  checked: boolean;
}

/** Never throws: if the check can't run, the message is treated as fine. */
export async function checkTone(text: string): Promise<ToneResult> {
  try {
    return await api<ToneResult>('/tone', { body: { text } });
  } catch {
    return { ok: true, issues: [], checked: false };
  }
}

export function TonePanel({ result, onUse, onSendAnyway, onEdit }: { result: ToneResult; onUse: (s: string) => void; onSendAnyway: () => void; onEdit: () => void }) {
  const t = useT();
  return (
    <div className="tone" role="alert">
      <div className="t">{t.toneTitle}</div>
      {result.issues.length > 0 && (
        <ul>
          {result.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      {result.suggestion && (
        <>
          <div className="small muted">{t.toneSuggestion}</div>
          <div className="quote">{result.suggestion}</div>
        </>
      )}
      <div className="row" style={{ marginTop: '0.5rem' }}>
        {result.suggestion && (
          <button type="button" className="btn primary" onClick={() => onUse(result.suggestion!)}>
            {t.toneUse}
          </button>
        )}
        <button type="button" className="btn" onClick={onEdit}>
          {t.toneEdit}
        </button>
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onSendAnyway}>
          {t.toneSendAnyway}
        </button>
      </div>
    </div>
  );
}
