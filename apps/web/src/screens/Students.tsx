// Mentor: my students, and one student's journey (charts per area, their words, evidence flags).
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, MessageCircle, Quote, Search } from 'lucide-react';
import { languageName } from '@heard/shared';
import { api, type Level } from '../api';
import { useT, type Strings } from '../i18n';
import { href } from '../router';
import { RulePill } from './MentorHome';
import { HelpLog } from './HelpLog';
import { NoteText, ThemeChips } from './NoteText';
import { HostelRecord } from './Register';
import { useMe } from '../App';

type Area = 'studies' | 'money' | 'health' | 'home';
const AREAS: Area[] = ['studies', 'money', 'health', 'home'];

interface StudentRow {
  id: string;
  name: string;
  lang: string;
  hostel: string | null;
  latest: ({ week: string } & Record<Area, Level>) | null;
  answeredLast4: number;
  openFlags: string[];
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function StudentsPage() {
  const t = useT();
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    api<StudentRow[]>('/students').then(setRows).catch(() => setRows([]));
  }, []);
  const shown = useMemo(() => (rows ?? []).filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  return (
    <div className="page">
      <div className="row">
        <h1 className="page-title">{t.students}</h1>
        <span className="spacer" />
        <label className="search">
          <Search size={16} aria-hidden />
          <input type="text" placeholder={t.searchStudents} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.searchStudents} />
        </label>
      </div>
      {!rows && <div className="muted">…</div>}
      <div className="list">
        {shown.map((s) => (
          <a key={s.id} href={href('student', s.id)}>
            <span className="avatar">{initials(s.name)}</span>
            <span className="item-main">
              <span className="item-title">{s.name}</span>
              <span className="item-sub">
                {[s.hostel, languageName(s.lang), `${s.answeredLast4}/4 ${t.weeksAnswered}`].filter(Boolean).join(' · ')}
              </span>
            </span>
            {s.latest && (
              <span className="dots" aria-label={`${t.checkInTitle} ${s.latest.week}`}>
                {AREAS.map((a) => (
                  <span key={a} className="dot" data-level={s.latest![a]} title={t[a]} />
                ))}
              </span>
            )}
            <span className="pills">
              {s.openFlags.slice(0, 2).map((r) => (
                <RulePill key={r} rule={r} />
              ))}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

interface Journey {
  student: { id: string; name: string; lang: string; hostel: string | null };
  weeks: ({ week: string; note: string | null; wantsToTalk: boolean } & Record<Area, Level | null>)[];
  flags: { id: string; rule: string; area: string; week: string; reason: string; status: string; openerSent: string | null; dismissReason: string | null }[];
  words: { week: string; text: string; themes: string[] }[];
  interventions: { id: string; kind: string; note: string | null; week: string; flagId: string | null }[];
}

const AREA_COLOR: Record<Area, string> = { studies: '#1d4ed8', money: '#c63b3b', health: '#1e8e4e', home: '#6b4bc8' };

function levelLabel(t: Strings, v: number | null) {
  return v === null ? t.noReply : [t.struggling, t.ok, t.good][v];
}

function AreaChart({ area, data, flagWeeks, helpWeeks, t }: { area: Area; data: Journey['weeks']; flagWeeks: string[]; helpWeeks: string[]; t: Strings }) {
  const rows = data.map((w) => ({ week: w.week.slice(-3), value: w[area] }));
  return (
    <section className="card chart-card">
      <h2>{t[area]}</h2>
      <div style={{ width: '100%', height: 150 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#e6eaf1" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={(v: number) => ['✕', '–', '✓'][v]} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip formatter={(v) => levelLabel(t, v as number | null)} labelFormatter={(l) => `${l}`} />
            {flagWeeks.map((w) => (
              <ReferenceLine key={`f${w}`} x={w.slice(-3)} stroke="#c63b3b" strokeDasharray="4 3" />
            ))}
            {helpWeeks.map((w) => (
              <ReferenceLine key={`h${w}`} x={w.slice(-3)} stroke="#1e8e4e" strokeWidth={2} label={{ value: 'help', position: 'insideTopRight', fontSize: 9, fill: '#1e8e4e' }} />
            ))}
            <Line type="monotone" dataKey="value" stroke={AREA_COLOR[area]} strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function StudentScreen({ id }: { id: string }) {
  const t = useT();
  const { me } = useMe();
  const [j, setJ] = useState<Journey | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    api<Journey>(`/students/${id}/journey`).then(setJ).catch(() => setMissing(true));
  }, [id]);
  if (missing) return <div className="page muted">{t.error}</div>;
  if (!j) return <div className="page muted">…</div>;
  const answered = j.weeks.filter((w) => w.studies !== null).length;
  const flagWeeksByArea = (a: Area) => j.flags.filter((f) => f.area === a || f.area === '').map((f) => f.week);
  return (
    <div className="page">
      <a className="back-link" href={href('students')}>
        <ArrowLeft size={16} aria-hidden /> {t.students}
      </a>
      <section className="card profile">
        <span className="avatar lg">{initials(j.student.name)}</span>
        <div className="item-main">
          <div className="profile-name">{j.student.name}</div>
          <div className="small muted">{[j.student.hostel, languageName(j.student.lang), `${answered}/${j.weeks.length} ${t.weeksAnswered}`].filter(Boolean).join(' · ')}</div>
        </div>
        <a className="btn primary" href={href('chat', 'direct', j.student.id)}>
          <MessageCircle size={16} aria-hidden /> {t.chats}
        </a>
      </section>

      <div className="journey">
        <div className="charts">
          {AREAS.map((a) => (
            <AreaChart key={a} area={a} data={j.weeks} flagWeeks={flagWeeksByArea(a).filter((w) => !j.flags.some((f) => f.rule === 'improved' && f.week === w))} helpWeeks={[...new Set(j.interventions.map((h) => h.week))]} t={t} />
          ))}
        </div>
        <aside className="side">
          <HelpLog studentId={j.student.id} items={j.interventions} onLogged={(row) => setJ((old) => (old ? { ...old, interventions: [row, ...old.interventions] } : old))} />
          <section className="card">
            <h2>
              <Quote size={16} aria-hidden /> {t.studentWords}
            </h2>
            {j.words.length === 0 && <p className="small muted">{t.noWordsYet}</p>}
            {j.words.map((w) => (
              <div key={w.week} className="word">
                <NoteText text={w.text} lang={me.user.lang} />
                <div className="row small muted" style={{ marginTop: '0.25rem' }}>
                  {w.week} <ThemeChips themes={w.themes} />
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>

      <HostelRecord studentId={j.student.id} />

      <section className="card">
        <h2>
          {t.evidenceFlags} ({j.flags.length})
        </h2>
        <p className="hint">{t.evidenceHint}</p>
        {j.flags.length === 0 && <p className="small muted">{t.inboxEmpty}</p>}
        {j.flags.map((f) => (
          <a key={f.id} className="evidence" href={href('flag', f.id)}>
            <div className="row">
              <RulePill rule={f.rule} />
              <span className="small muted">{f.week}</span>
              <span className="spacer" />
              <span className={`status status-${f.status}`}>{t[`status_${f.status}` as keyof Strings] ?? f.status}</span>
            </div>
            <div>{f.reason}</div>
            {f.openerSent && <div className="small muted">↳ {f.openerSent}</div>}
          </a>
        ))}
      </section>
    </div>
  );
}
