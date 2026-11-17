// Hostel register UI.
//  - RegisterSheet (warden): one month's records for the campus, typed in or read from a photo of the
//    paper register. A photo only fills the table; nothing is saved until the warden checks and saves.
//  - RegisterBars: a metric's last months, used on flag cards.
//  - HostelRecord (mentor): a student's six months, targets, and the advisory six-month review.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ClipboardList, Save, Target } from 'lucide-react';
import { METRICS, METRIC_INFO, monthLabel, monthOf, addMonths, type Metric, type ReviewItem, type ReviewSuggestion } from '@heard/shared';
import { api, ApiError } from '../api';
import { useT, type Strings } from '../i18n';

export function metricLabel(t: Strings, m: string) {
  return (t[`metric_${m}` as keyof Strings] as string | undefined) ?? m;
}

function fmt(m: Metric, v: number | null) {
  if (v === null) return '–';
  return METRIC_INFO[m].unit === 'pct' ? `${v}%` : String(v);
}

/** Receipt area for display: "register_attendance" → "Attendance (register)". */
export function areaLabel(t: Strings, area: string) {
  if (area.startsWith('register_')) return `${metricLabel(t, area.slice(9))} (${t.registerShort})`;
  return (t[area as keyof Strings] as string | undefined) ?? area;
}

// ---- small chart for flag cards --------------------------------------------------------------------

export function RegisterBars({ metric, history }: { metric: string; history: { month: string; value: number | null }[] }) {
  const t = useT();
  const info = METRIC_INFO[metric as Metric];
  if (!info) return null;
  return (
    <div className="reg-bars" aria-label={`${metricLabel(t, metric)}: ${history.map((h) => `${monthLabel(h.month)} ${fmt(metric as Metric, h.value)}`).join(', ')}`}>
      {history.map((h) => {
        const pct = h.value === null ? 0 : Math.max(4, Math.round((h.value / (info.unit === 'pct' ? 100 : Math.max(10, ...history.map((x) => x.value ?? 0)))) * 100));
        return (
          <div key={h.month} className="reg-bar-col">
            <span className="reg-val">{fmt(metric as Metric, h.value)}</span>
            <span className="reg-track">
              <span className={`reg-bar${metric === 'conduct' && (h.value ?? 0) > 0 ? ' bad' : ''}`} style={{ height: `${pct}%` }} />
            </span>
            <span className="reg-month">{monthLabel(h.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- target form (mentor) ------------------------------------------------------------------------------

export function TargetForm({ studentId, metric, flagId, onSet }: { studentId: string; metric?: string; flagId?: string; onSet?: () => void }) {
  const t = useT();
  const next = addMonths(monthOf(new Date()), 1);
  const [m, setM] = useState<Metric>((metric as Metric) ?? 'attendance');
  const [goal, setGoal] = useState<string>('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setErr('');
    try {
      await api(`/register/students/${studentId}/targets`, { body: { metric: m, month: next, goal: Number(goal), flagId } });
      setDone(true);
      onSet?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.code : t.error);
    }
  }
  if (done) return <p className="small ok-text">✓ {t.targetSaved}</p>;
  return (
    <div className="target-form">
      <div className="row small" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
        <Target size={16} aria-hidden />
        <span>{t.targetFor}</span>
        {!metric && (
          <select value={m} onChange={(e) => setM(e.target.value as Metric)} aria-label={t.metric}>
            {METRICS.map((x) => (
              <option key={x} value={x}>
                {metricLabel(t, x)}
              </option>
            ))}
          </select>
        )}
        {metric && <strong>{metricLabel(t, m)}</strong>}
        <span>
          {monthLabel(next)}: {METRIC_INFO[m].higherIsBetter ? t.atLeast : t.atMost}
        </span>
        <input type="number" min={0} max={METRIC_INFO[m].max} value={goal} onChange={(e) => setGoal(e.target.value)} style={{ width: '5rem' }} aria-label={t.goal} />
        <span className="muted">{METRIC_INFO[m].unit === 'pct' ? '%' : ''}</span>
        <button className="btn small" disabled={goal === ''} onClick={() => void save()}>
          {t.setTarget}
        </button>
      </div>
      <p className="hint">{t.targetHint}</p>
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

// ---- warden: the month's sheet ----------------------------------------------------------------------------

interface SheetStudent {
  id: string;
  name: string;
  hostelId: string | null;
  hostel: string | null;
  row: (Record<Metric, number | null> & { remarks: string | null; source: string }) | null;
}
interface Sheet {
  month: string;
  hostels: { id: string; name: string }[];
  students: SheetStudent[];
}
interface Scanned {
  name: string;
  studentId: string | null;
  match: 'exact' | 'close' | 'none';
  values: Record<Metric, number | null>;
  remarks: string | null;
}
type Draft = Record<string, Partial<Record<Metric | 'remarks', string>>>;

function toB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function RegisterSheet() {
  const t = useT();
  const [month, setMonth] = useState(monthOf(new Date()));
  const [hostelId, setHostelId] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [fromPhoto, setFromPhoto] = useState<Set<string>>(new Set());
  const [unmatched, setUnmatched] = useState<Scanned[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSheet(null);
    setDraft({});
    setFromPhoto(new Set());
    setUnmatched([]);
    setStatus('');
    api<Sheet>(`/register?month=${month}${hostelId ? `&hostelId=${hostelId}` : ''}`)
      .then(setSheet)
      .catch(() => setStatus(t.error));
  }, [month, hostelId, t.error]);

  const value = (s: SheetStudent, k: Metric | 'remarks') => draft[s.id]?.[k] ?? (s.row ? String(s.row[k] ?? '') : '');
  const set = (id: string, k: Metric | 'remarks', v: string) => setDraft((d) => ({ ...d, [id]: { ...d[id], [k]: v } }));
  const changed = useMemo(() => Object.keys(draft), [draft]);

  async function readPhoto(f: File) {
    setBusy(true);
    setStatus(t.readingPhoto);
    try {
      const data = await toB64(f);
      const r = await api<{ rows: Scanned[] }>('/register/scan', { body: { month, hostelId: hostelId || undefined, image: { mimeType: f.type || 'image/jpeg', data } } });
      const next: Draft = { ...draft };
      const marked = new Set(fromPhoto);
      for (const row of r.rows) {
        if (!row.studentId) continue;
        next[row.studentId] = { ...next[row.studentId], ...Object.fromEntries(METRICS.map((m) => [m, row.values[m] === null ? '' : String(row.values[m])])), remarks: row.remarks ?? '' };
        marked.add(row.studentId);
      }
      setDraft(next);
      setFromPhoto(marked);
      setUnmatched(r.rows.filter((x) => !x.studentId));
      setStatus(t.photoRead.replace('{n}', String(marked.size)));
    } catch (e) {
      setStatus(e instanceof ApiError && e.code === 'image_too_large' ? t.photoTooLarge : t.photoFailed);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  }

  async function save() {
    if (!sheet) return;
    setBusy(true);
    try {
      const rows = changed.map((id) => {
        const s = sheet.students.find((x) => x.id === id)!;
        return { studentId: id, ...Object.fromEntries(METRICS.map((m) => [m, value(s, m)])), remarks: value(s, 'remarks') };
      });
      const r = await api<{ saved: number; flagged: number; targetsMet: number }>('/register', { method: 'PUT', body: { month, rows, source: fromPhoto.size ? 'photo' : 'manual' } });
      setStatus(t.registerSaved.replace('{n}', String(r.saved)).replace('{f}', String(r.flagged)));
      const fresh = await api<Sheet>(`/register?month=${month}${hostelId ? `&hostelId=${hostelId}` : ''}`);
      setSheet(fresh);
      setDraft({});
      setFromPhoto(new Set());
      setUnmatched([]);
    } catch {
      setStatus(t.error);
    } finally {
      setBusy(false);
    }
  }

  const months = Array.from({ length: 6 }, (_, i) => addMonths(monthOf(new Date()), -i));
  return (
    <div className="page wide-page">
      <div className="row" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
        <h1 className="page-title">
          <ClipboardList size={22} aria-hidden /> {t.registerTitle}
        </h1>
        <span className="spacer" />
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t.month}>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)} {m.slice(0, 4)}
            </option>
          ))}
        </select>
        <select value={hostelId} onChange={(e) => setHostelId(e.target.value)} aria-label={t.hostel}>
          <option value="">{t.allHostels}</option>
          {sheet?.hostels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>
      <p className="hint">{t.registerHint}</p>

      <section className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: '0.6rem' }}>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && void readPhoto(e.target.files[0])} />
          <button className="btn" disabled={busy} onClick={() => file.current?.click()}>
            <Camera size={16} aria-hidden /> {t.readPhoto}
          </button>
          <span className="spacer" />
          <span className="small muted">{status}</span>
          <button className="btn primary" disabled={busy || !changed.length} onClick={() => void save()}>
            <Save size={16} aria-hidden /> {t.save} {changed.length ? `(${changed.length})` : ''}
          </button>
        </div>
        {fromPhoto.size > 0 && <p className="hint photo-hint">{t.photoCheck}</p>}
        {unmatched.length > 0 && (
          <p className="small error">
            {t.unmatched}: {unmatched.map((u) => u.name).join(', ')}
          </p>
        )}
      </section>

      {!sheet && <div className="muted">…</div>}
      {sheet && (
        <div className="table-wrap">
          <table className="reg-table">
            <thead>
              <tr>
                <th>{t.student}</th>
                {METRICS.map((m) => (
                  <th key={m}>
                    {metricLabel(t, m)}
                    <span className="unit">{METRIC_INFO[m].unit === 'pct' ? '%' : METRIC_INFO[m].unit === 'days' ? t.unitDays : t.unitCount}</span>
                  </th>
                ))}
                <th>{t.remarks}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.students.map((s) => (
                <tr key={s.id} className={fromPhoto.has(s.id) ? 'from-photo' : draft[s.id] ? 'edited' : ''}>
                  <td>
                    <div className="item-title">{s.name}</div>
                    <div className="small muted">{s.hostel}</div>
                  </td>
                  {METRICS.map((m) => (
                    <td key={m}>
                      <input inputMode="numeric" value={value(s, m)} onChange={(e) => set(s.id, m, e.target.value)} aria-label={`${s.name} ${metricLabel(t, m)}`} />
                    </td>
                  ))}
                  <td>
                    <input className="remarks" value={value(s, 'remarks')} onChange={(e) => set(s.id, 'remarks', e.target.value)} aria-label={`${s.name} ${t.remarks}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sheet.students.length === 0 && <p className="small muted">{t.noStudentsYet}</p>}
        </div>
      )}
    </div>
  );
}

// ---- mentor: one student's hostel record ----------------------------------------------------------

interface RecordView {
  month: string;
  months: string[];
  rows: ({ month: string; remarks?: string | null } & Record<Metric, number | null>)[];
  targets: { id: string; metric: string; month: string; goal: number; value: number | null; met: boolean | null }[];
  review: { items: ReviewItem[]; suggestion: ReviewSuggestion; rule: string };
  decisions: { id: string; month: string; decision: string; reason: string; suggestionShown: string; createdAt: string }[];
}

export function HostelRecord({ studentId }: { studentId: string }) {
  const t = useT();
  const [v, setV] = useState<RecordView | null>(null);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const load = () =>
    api<RecordView>(`/register/students/${studentId}`)
      .then(setV)
      .catch(() => setV(null));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);
  if (!v) return null;
  if (!v.rows.length)
    return (
      <section className="card">
        <h2>
          <ClipboardList size={16} aria-hidden /> {t.hostelRecord}
        </h2>
        <p className="small muted">{t.noRecords}</p>
      </section>
    );

  async function decide() {
    setErr('');
    try {
      await api(`/register/students/${studentId}/review`, { body: { month: v!.month, decision, reason } });
      setDecision('');
      setReason('');
      await load();
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'reason_required' ? t.reasonRequired : t.error);
    }
  }

  return (
    <>
      <section className="card">
        <h2>
          <ClipboardList size={16} aria-hidden /> {t.hostelRecord}
        </h2>
        <div className="table-wrap">
          <table className="reg-table compact">
            <thead>
              <tr>
                <th />
                {v.months.map((m) => (
                  <th key={m}>{monthLabel(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m}>
                  <th scope="row">{metricLabel(t, m)}</th>
                  {v.months.map((mo) => {
                    const val = v.rows.find((r) => r.month === mo)?.[m] ?? null;
                    return (
                      <td key={mo} className={m === 'conduct' && (val ?? 0) > 0 ? 'bad' : ''}>
                        {fmt(m, val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {v.rows.at(-1)?.remarks && <p className="small"><span className="muted">{t.remarks}:</span> {v.rows.at(-1)!.remarks}</p>}

        <h3 className="sub-h">{t.targets}</h3>
        {v.targets.map((x) => (
          <div key={x.id} className="small target-row">
            <Target size={14} aria-hidden /> {metricLabel(t, x.metric)} · {monthLabel(x.month)}: {METRIC_INFO[x.metric as Metric]?.higherIsBetter ? '≥' : '≤'} {fmt(x.metric as Metric, x.goal)}{' '}
            <span className={x.met === true ? 'ok-text' : x.met === false ? 'error' : 'muted'}>
              {x.met === true ? `✓ ${t.targetMet} (${fmt(x.metric as Metric, x.value)})` : x.met === false ? `${t.targetNotMet} (${fmt(x.metric as Metric, x.value)})` : t.targetPending}
            </span>
          </div>
        ))}
        <TargetForm studentId={studentId} onSet={() => void load()} />
      </section>

      <section className="card">
        <h2>{t.reviewTitle}</h2>
        <p className="hint">{t.reviewHint}</p>
        {v.review.items.map((i) => (
          <div key={i.criterion} className="review-item">
            <span className={`level level-${i.level}`}>{t[`level_${i.level}` as keyof Strings] as string}</span>
            <strong>{t[`criterion_${i.criterion}` as keyof Strings] as string}</strong>
            <span className="small muted">{i.evidence}</span>
          </div>
        ))}
        <div className="suggestion">
          <span className="small muted">{t.suggestion}</span> <strong>{t[`suggest_${v.review.suggestion}` as keyof Strings] as string}</strong>
          <div className="small muted">{v.review.rule}</div>
        </div>
        <div className="field" style={{ marginTop: '0.8rem' }}>
          <label>{t.yourDecision}</label>
          <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
            {(['continue', 'continue_with_support', 'refer'] as const).map((d) => (
              <button key={d} className={`btn small${decision === d ? ' primary' : ''}`} onClick={() => setDecision(d)}>
                {t[`decision_${d}` as keyof Strings] as string}
              </button>
            ))}
          </div>
          {decision && (
            <>
              <textarea rows={3} placeholder={t.decisionReason} value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: '0.5rem' }} />
              <button className="btn primary small" style={{ marginTop: '0.4rem' }} onClick={() => void decide()}>
                {t.recordDecision}
              </button>
            </>
          )}
          {err && <p className="error small">{err}</p>}
        </div>
        {v.decisions.map((d) => (
          <div key={d.id} className="small decision-row">
            {monthLabel(d.month)}: <strong>{t[`decision_${d.decision}` as keyof Strings] as string}</strong> · {d.reason}{' '}
            <span className="muted">
              ({t.suggestionWas} {t[`suggest_${d.suggestionShown}` as keyof Strings] as string})
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
