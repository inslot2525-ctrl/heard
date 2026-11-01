// One flag: the evidence (rule in plain words, 6-week bars, the student's own words), then the
// mentor's opener. The mentor edits and sends it as themselves, or dismisses with a reason.
import { useEffect, useState } from 'react';
import { api, ApiError, type Flag } from '../api';
import { useT } from '../i18n';
import { go, href } from '../router';
import { ruleLabel } from './MentorHome';
import { checkTone, TonePanel, type ToneResult } from './ToneGuard';
import { MeetingCardButton } from './MeetingCard';

export function FlagScreen({ flagId }: { flagId: string }) {
  const t = useT();
  const [flag, setFlag] = useState<Flag | null>(null);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [dismissing, setDismissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tone, setTone] = useState<ToneResult | null>(null);

  /** Opener with Tone Guard: the drafted text was already checked, edits get checked again. */
  async function sendOpener(skipTone = false) {
    if (!skipTone && text.trim() !== (flag?.openerDraft ?? '').trim()) {
      setBusy(true);
      const r = await checkTone(text.trim());
      setBusy(false);
      if (!r.ok) return setTone(r);
    }
    setTone(null);
    await act('opener', { text });
  }

  useEffect(() => {
    api<Flag>(`/flags/${flagId}`).then((f) => {
      setFlag(f);
      setText(f.openerSent ?? f.openerDraft ?? '');
    });
  }, [flagId]);

  async function act(path: string, body: object) {
    setBusy(true);
    setErr(null);
    try {
      const f = await api<Flag>(`/flags/${flagId}/${path}`, { body });
      setFlag((old) => (old ? { ...old, ...f } : old));
      if (path === 'opener') go('chat', 'direct', flag!.studentId);
      if (path === 'dismiss' || path === 'resolve') go();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setErr(
        code === 'labels_or_diagnosis'
          ? 'Please don’t use labels or diagnoses (like “depressed” or “at risk”). Describe what you noticed instead.'
          : code === 'reason_required'
            ? 'Add a short reason.'
            : t.error,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!flag) return <div className="page muted">…</div>;
  const closed = flag.status === 'resolved' || flag.status === 'dismissed';
  const history = flag.evidence.history;

  return (
    <>
      <header className="topbar">
        <a className="btn ghost" href={href()} aria-label={t.back}>←</a>
        <h1>
          {flag.student.name}
          <span className="sub">{ruleLabel(flag.rule)} · {flag.week}</span>
        </h1>
        <a className="btn ghost" href={href('chat', 'direct', flag.studentId)}>{t.chats}</a>
      </header>
      <main className="page">
        <section className="card">
          <p className="flag-reason" style={{ marginTop: 0 }}>{flag.reason}</p>
          {history && (
            <>
              <div className="small muted">{t.lastWeeks}{flag.area ? ` · ${t[flag.area]}` : ''}</div>
              <div className="spark" aria-label={history.map((h) => `${h.week}: ${h.level === null ? t.noReply : [t.struggling, t.ok, t.good][h.level]}`).join(', ')}>
                {history.map((h) => (
                  <div key={h.week} className="bar" data-level={h.level ?? 'none'} title={`${h.week}`} />
                ))}
              </div>
              <div className="spark-weeks">
                {history.map((h) => (
                  <span key={h.week}>{h.week.slice(-3)}</span>
                ))}
              </div>
            </>
          )}
          {flag.evidence.studentWords && (
            <>
              <div className="small muted" style={{ marginTop: '0.75rem' }}>{t.studentWords}</div>
              <div className="quote">{flag.evidence.studentWords}</div>
            </>
          )}
        </section>

        {!closed && <MeetingCardButton flagId={flag.id} />}

        {flag.status === 'contacted' && flag.openerSent && (
          <section className="card">
            <div className="small muted">{t.sentOpener}</div>
            <div className="quote">{flag.openerSent}</div>
          </section>
        )}

        {!closed && flag.status === 'open' && (
          <section className="card">
            <div className="field">
              <label htmlFor="opener">{t.openerLabel}</label>
              <textarea id="opener" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            {err && <p className="error" role="alert">{err}</p>}
            {tone && (
              <TonePanel
                result={tone}
                onUse={(sug) => {
                  setText(sug);
                  setTone(null);
                }}
                onEdit={() => setTone(null)}
                onSendAnyway={() => void sendOpener(true)}
              />
            )}
            <button className="btn primary block" disabled={busy || !text.trim()} onClick={() => void sendOpener()}>
              {t.sendOpener}
            </button>
          </section>
        )}

        {!closed && (
          <section className="card">
            {!dismissing ? (
              <div className="row">
                <button className="btn" disabled={busy} onClick={() => void act('resolve', {})}>{t.resolve}</button>
                <span className="spacer" />
                <button className="btn ghost danger" onClick={() => setDismissing(true)}>{t.dismiss}</button>
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="reason">{t.dismissReason}</label>
                  <input id="reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                {err && <p className="error" role="alert">{err}</p>}
                <div className="row">
                  <button className="btn ghost" onClick={() => setDismissing(false)}>{t.back}</button>
                  <span className="spacer" />
                  <button className="btn danger" disabled={busy || !reason.trim()} onClick={() => void act('dismiss', { reason })}>{t.dismiss}</button>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </>
  );
}
