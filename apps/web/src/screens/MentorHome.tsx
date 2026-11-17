import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api, type Flag } from '../api';
import { onMessage } from '../chat-client';
import { useT } from '../i18n';
import { href } from '../router';
import { useMe } from '../App';
import { NoteLine } from './NoteText';

export function MentorHome() {
  const t = useT();
  return (
    <div className="page">
      <h1 className="page-title">{t.inbox}</h1>
      <p className="muted" style={{ margin: 0 }}>{t.inboxIntro}</p>
      <Inbox />
    </div>
  );
}

const RULE_LABEL: Record<string, string> = {
  repeat_struggling: 'Struggling two weeks running',
  drop_from_baseline: 'Sudden drop',
  silent: 'Gone quiet',
  wants_to_talk: 'Asked to talk',
  asked_for_help: 'Asked the assistant for help',
  safety: 'URGENT: may not be safe',
  safety_ragging: 'URGENT: reported ragging',
  improved: 'Improved after help',
  register_decline: 'Register: steady decline',
  register_drop: 'Register: sudden drop',
  conduct_concern: 'Register: conduct',
};

/** Colour family per rule (same idea as the team's earlier evidence-flag colours). */
const RULE_TONE: Record<string, string> = {
  repeat_struggling: 'decline',
  drop_from_baseline: 'sudden',
  silent: 'missing',
  wants_to_talk: 'talk',
  asked_for_help: 'talk',
  safety: 'urgent',
  safety_ragging: 'urgent',
  improved: 'improved',
  register_decline: 'decline',
  register_drop: 'sudden',
  conduct_concern: 'missing',
};

export function ruleLabel(rule: string) {
  return RULE_LABEL[rule] ?? rule;
}

export function RulePill({ rule }: { rule: string }) {
  return <span className={`rule-pill tone-${RULE_TONE[rule] ?? 'talk'}`}>{ruleLabel(rule)}</span>;
}

function Inbox() {
  const t = useT();
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const load = () => api<Flag[]>('/flags').then(setFlags).catch(() => setFlags([]));
  useEffect(() => {
    void load();
    // A new FlagCard in chat means the inbox changed.
    return onMessage((m) => {
      if (m.type === 'SA:FlagCard') void load();
    });
  }, []);

  if (!flags) return <div className="muted">…</div>;
  if (!flags.length) return <div className="card center muted">{t.inboxEmpty}</div>;
  const urgent = (f: Flag) => f.rule.startsWith('safety');
  const open = flags.filter((f) => f.status === 'open').sort((a, b) => Number(urgent(b)) - Number(urgent(a)));
  const contacted = flags.filter((f) => f.status === 'contacted');
  return (
    <>
      {open.length > 0 && (
        <div className="section-title">
          {t.needsYou} · {open.length}
        </div>
      )}
      {open.map((f) => (
        <EvidenceCard key={f.id} f={f} />
      ))}
      {contacted.length > 0 && <div className="section-title">{t.contacted}</div>}
      {contacted.map((f) => (
        <EvidenceCard key={f.id} f={f} />
      ))}
    </>
  );
}

/** One flag as an evidence card: who, which rule, the plain reason, their words. */
function EvidenceCard({ f }: { f: Flag }) {
  const { me } = useMe();
  const lang = me.user.lang;
  const isUrgent = f.rule.startsWith('safety');
  return (
    <a className={`card evidence-card${isUrgent ? ' urgent' : ''}`} href={href('flag', f.id)}>
      <span className="avatar">{f.student.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</span>
      <span className="item-main">
        <span className="row" style={{ gap: '0.5rem' }}>
          <span className="item-title" style={{ display: 'inline' }}>{f.student.name}</span>
          <RulePill rule={f.rule} />
          <span className="small muted">{f.week}</span>
        </span>
        <span className="evidence-reason">{f.reason}</span>
        {f.evidence.studentWords && <NoteLine text={f.evidence.studentWords} lang={lang} />}
        {f.evidence.perceptionGap && <span className="gap-line">↔ {f.evidence.perceptionGap}</span>}
      </span>
      <ChevronRight size={18} className="muted" aria-hidden />
    </a>
  );
}
