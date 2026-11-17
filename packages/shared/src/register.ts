// Hostel register: the monthly record a warden keeps for each student (attendance, academics,
// hostel duties, activities, conduct). Pure functions, no I/O, no LLM, like rules.ts.
// Works for any hostel: every metric is optional, and a hostel that doesn't track one leaves it empty.
// Nothing here scores a student or suggests removing them; the mentor always decides.

import type { PulseLevel } from './messages.js';

/** Month key: "2026-11". */
export type Month = string;

export const METRICS = ['attendance', 'academics', 'duties', 'activities', 'conduct'] as const;
export type Metric = (typeof METRICS)[number];

/** How each metric is recorded. Percentages are 0–100; activities are days in the month; conduct is incidents. */
export const METRIC_INFO: Record<Metric, { unit: 'pct' | 'days' | 'count'; label: string; max: number; higherIsBetter: boolean }> = {
  attendance: { unit: 'pct', label: 'class attendance', max: 100, higherIsBetter: true },
  academics: { unit: 'pct', label: 'test / assignment marks', max: 100, higherIsBetter: true },
  duties: { unit: 'pct', label: 'hostel duties done', max: 100, higherIsBetter: true },
  activities: { unit: 'days', label: 'days of sports / clubs / activities', max: 31, higherIsBetter: true },
  conduct: { unit: 'count', label: 'conduct incidents', max: 31, higherIsBetter: false },
};

/** One student's register row for one month. `null` = not recorded. */
export interface RegisterRow {
  month: Month;
  attendance: number | null;
  academics: number | null;
  duties: number | null;
  activities: number | null;
  conduct: number | null;
  remarks?: string | null;
}

export type RegisterRuleId = 'register_decline' | 'register_drop' | 'conduct_concern';

export interface RegisterHit {
  rule: RegisterRuleId;
  metric: Metric;
  month: Month;
  reason: string;
  history: { month: Month; value: number | null }[];
}

// ---- months ----------------------------------------------------------------------------------------

export function monthOf(date: Date): Month {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return monthOf(d);
}

/** The last `n` months ending with `month`, oldest first. */
export function lastMonths(n: number, month: Month): Month[] {
  return Array.from({ length: n }, (_, i) => addMonths(month, i - (n - 1)));
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (m: Month) => MONTH_NAMES[Number(m.slice(5)) - 1] ?? m;

/** Clamp and round a value to its metric's range; anything unreadable becomes null. */
export function cleanValue(metric: Metric, v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(METRIC_INFO[metric].max, Math.round(n));
}

// ---- rules -----------------------------------------------------------------------------------------

/** Rule thresholds, in the metric's own unit. */
export const REGISTER_RULES = {
  /** Fell three months in a row, by at least this much in total (pct points, or days for activities). */
  declineMin: { pct: 15, days: 6 },
  /** This month is this far below the student's own average of the 3 months before. */
  dropMin: { pct: 20, days: 8 },
  /** Conduct: incidents in 2 of the last 3 months, or 3+ in one month. A one-off never flags. */
  conductRepeatMonths: 2,
  conductOneMonth: 3,
} as const;

const fmt = (metric: Metric, v: number) => (METRIC_INFO[metric].unit === 'pct' ? `${v}%` : `${v}`);

function series(rows: RegisterRow[], metric: Metric, months: Month[]) {
  return months.map((month) => ({ month, value: rows.find((r) => r.month === month)?.[metric] ?? null }));
}

/**
 * Run the register rules for `month` over a student's rows (any order). At most one hit per metric:
 * a steady decline wins over a sudden drop, so the mentor sees one card per problem.
 */
export function evaluateRegister(rows: RegisterRow[], month: Month): RegisterHit[] {
  const hits: RegisterHit[] = [];
  const months = lastMonths(6, month);
  for (const metric of METRICS) {
    const info = METRIC_INFO[metric];
    const hist = series(rows, metric, months);
    const cur = hist.at(-1)!.value;
    if (cur === null) continue;

    if (metric === 'conduct') {
      const last3 = hist.slice(-3).map((h) => h.value ?? 0);
      const monthsWith = last3.filter((v) => v > 0).length;
      if (cur > 0 && (monthsWith >= REGISTER_RULES.conductRepeatMonths || cur >= REGISTER_RULES.conductOneMonth)) {
        hits.push({
          rule: 'conduct_concern',
          metric,
          month,
          reason:
            cur >= REGISTER_RULES.conductOneMonth
              ? `${cur} conduct incidents recorded in ${monthLabel(month)}.`
              : `Conduct incidents recorded in ${monthsWith} of the last 3 months (${hist.slice(-3).map((h) => `${monthLabel(h.month)} ${h.value ?? '–'}`).join(', ')}).`,
          history: hist,
        });
      }
      continue;
    }

    const unit = info.unit === 'days' ? 'days' : 'pct';
    const last4 = hist.slice(-4).map((h) => h.value);
    if (last4.every((v) => v !== null)) {
      const v = last4 as number[];
      const falling = v[1] < v[0] && v[2] < v[1] && v[3] < v[2];
      if (falling && v[0] - v[3] >= REGISTER_RULES.declineMin[unit]) {
        hits.push({
          rule: 'register_decline',
          metric,
          month,
          reason: `${info.label[0].toUpperCase()}${info.label.slice(1)} fell three months in a row: ${v.map((x) => fmt(metric, x)).join(' → ')} (${hist.slice(-4).map((h) => monthLabel(h.month)).join('–')}).`,
          history: hist,
        });
        continue;
      }
    }
    const before = hist.slice(-4, -1).map((h) => h.value).filter((x): x is number => x !== null);
    if (before.length >= 2) {
      const avg = before.reduce((a, b) => a + b, 0) / before.length;
      if (avg - cur >= REGISTER_RULES.dropMin[unit]) {
        hits.push({
          rule: 'register_drop',
          metric,
          month,
          reason: `${info.label[0].toUpperCase()}${info.label.slice(1)} was ${fmt(metric, cur)} in ${monthLabel(month)}, against a usual ${fmt(metric, Math.round(avg))} for this student.`,
          history: hist,
        });
      }
    }
  }
  return hits;
}

// ---- perception gap --------------------------------------------------------------------------------

/**
 * When the register shows a problem with studies but the student's own check-ins that month say
 * "good", say so plainly. It is a conversation starter, never a verdict on who is right.
 */
export function perceptionGap(metric: Metric, studiesLevels: (PulseLevel | null)[]): string | null {
  if (metric !== 'attendance' && metric !== 'academics') return null;
  const answered = studiesLevels.filter((l): l is PulseLevel => l !== null);
  if (!answered.length) return null;
  const good = answered.filter((l) => l === 2).length;
  if (good / answered.length < 0.5) return null;
  return `In their own check-ins this month, they rated studies "good" ${good} of ${answered.length} times. Worth asking how it looks from their side.`;
}

// ---- targets ---------------------------------------------------------------------------------------

/** Did the month's value reach the target? null = not recorded yet. */
export function targetMet(metric: Metric, goal: number, value: number | null): boolean | null {
  if (value === null) return null;
  return METRIC_INFO[metric].higherIsBetter ? value >= goal : value <= goal;
}

// ---- six-month review ------------------------------------------------------------------------------

export type ReviewLevel = 'ok' | 'watch' | 'concern' | 'no_data';
export type ReviewCriterion = 'attendance' | 'academics' | 'participation' | 'conduct' | 'records';
export type ReviewSuggestion = 'continue' | 'continue_with_support' | 'discuss_at_review' | 'not_enough_records';

export interface ReviewItem {
  criterion: ReviewCriterion;
  level: ReviewLevel;
  evidence: string;
}

const avgOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Six-month review, advisory only. Each criterion is OK / Watch / Concern with the numbers behind it.
 * The strongest suggestion is "discuss at the review meeting": the app never suggests removing a student.
 */
export function sixMonthReview(rows: RegisterRow[], month: Month): { items: ReviewItem[]; suggestion: ReviewSuggestion; rule: string } {
  const months = lastMonths(6, month);
  const got = (m: Metric) => series(rows, m, months).map((h) => h.value).filter((v): v is number => v !== null);
  const pctItem = (criterion: ReviewCriterion, m: Metric): ReviewItem => {
    const v = got(m);
    if (!v.length) return { criterion, level: 'no_data', evidence: 'Not recorded.' };
    const a = Math.round(avgOf(v));
    const low = Math.min(...v);
    const level: ReviewLevel = a >= 75 && low >= 60 ? 'ok' : a >= 60 ? 'watch' : 'concern';
    return { criterion, level, evidence: `Average ${a}% over ${v.length} month(s), lowest ${low}%.` };
  };

  const duties = got('duties');
  const acts = got('activities');
  let participation: ReviewItem;
  if (!duties.length && !acts.length) participation = { criterion: 'participation', level: 'no_data', evidence: 'Not recorded.' };
  else {
    const d = duties.length ? Math.round(avgOf(duties)) : null;
    const a = acts.length ? Math.round(avgOf(acts)) : null;
    const weak = (d !== null && d < 60) || (a !== null && a < 4);
    const fine = (d === null || d >= 75) && (a === null || a >= 8);
    participation = {
      criterion: 'participation',
      level: fine ? 'ok' : weak ? 'concern' : 'watch',
      evidence: [d !== null ? `duties ${d}% on average` : null, a !== null ? `${a} activity days a month on average` : null].filter(Boolean).join('; ') + '.',
    };
  }

  const c = got('conduct');
  const total = c.reduce((s, x) => s + x, 0);
  const monthsWith = c.filter((x) => x > 0).length;
  const conduct: ReviewItem = !c.length
    ? { criterion: 'conduct', level: 'no_data', evidence: 'Not recorded.' }
    : { criterion: 'conduct', level: total === 0 ? 'ok' : monthsWith >= 2 || total >= 3 ? 'concern' : 'watch', evidence: `${total} incident(s) in ${monthsWith} of ${c.length} recorded month(s).` };

  const recorded = months.filter((m) => rows.some((r) => r.month === m)).length;
  const records: ReviewItem = { criterion: 'records', level: recorded >= 5 ? 'ok' : recorded >= 3 ? 'watch' : 'concern', evidence: `${recorded} of 6 months recorded.` };

  const items = [pctItem('attendance', 'attendance'), pctItem('academics', 'academics'), participation, conduct, records];
  if (recorded < 3) return { items, suggestion: 'not_enough_records', rule: 'Fewer than 3 of 6 months recorded: not enough to suggest anything.' };
  const concerns = items.filter((i) => i.level === 'concern' && i.criterion !== 'records').length;
  const watches = items.filter((i) => i.level === 'watch' || (i.level === 'concern' && i.criterion === 'records')).length;
  if (concerns >= 2) return { items, suggestion: 'discuss_at_review', rule: '2 or more criteria at "concern": discuss at the review meeting.' };
  if (concerns === 1 || watches >= 2) return { items, suggestion: 'continue_with_support', rule: '1 concern or 2+ "watch": continue with a support plan.' };
  return { items, suggestion: 'continue', rule: 'No concerns and at most one "watch": continue.' };
}
