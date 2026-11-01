// Proof: how well do the flag rules catch planted problems, and how often does ordinary week-to-week
// wobble set them off? Generates synthetic cohorts (seeded, reproducible), plants known patterns,
// runs the SAME shared rules the API uses, and writes per-rule precision/recall to docs/PROOF.md.
//
//   pnpm --filter @heard/api proof            # writes docs/PROOF.md
//   pnpm --filter @heard/api proof -- --print # prints only
//
// Synthetic data only. This measures the rules against their own intent; it says nothing about
// real students, which only a pilot can show.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  evaluate,
  improvedAfterHelp,
  PULSE_AREAS,
  type PulseArea,
  type PulseLevel,
  type PulseResponse,
  type WeekPulse,
} from '@heard/shared';

const SEED = 20261101;
const STUDENTS = 2000; // per cohort
const WEEKS = 8;
const NOISE = [
  { name: 'calm', wobble: 0.1, missRate: 0.05 },
  { name: 'typical', wobble: 0.2, missRate: 0.1 },
  { name: 'noisy', wobble: 0.35, missRate: 0.2 },
];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const week = (i: number) => `2026-W${String(40 + i).padStart(2, '0')}`;
const clamp = (n: number) => Math.max(0, Math.min(2, n)) as PulseLevel;

type Planted = 'none' | 'repeat_struggling' | 'drop_from_baseline' | 'silent' | 'wants_to_talk';
const PLANTS: Planted[] = ['none', 'none', 'none', 'none', 'repeat_struggling', 'drop_from_baseline', 'silent', 'wants_to_talk'];

interface Student {
  weeks: WeekPulse[];
  planted: Planted;
  area?: PulseArea;
}

/** An ordinary student: a usual level per area, wobbling by one step some weeks, missing some replies. */
function ordinary(rnd: () => number, wobble: number, missRate: number, n = WEEKS) {
  const base = Object.fromEntries(PULSE_AREAS.map((a) => [a, rnd() < 0.6 ? 2 : 1])) as Record<PulseArea, PulseLevel>;
  const weeks: WeekPulse[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0 && rnd() < missRate) {
      weeks.push({ week: week(i), response: null });
      continue;
    }
    const levels = Object.fromEntries(
      PULSE_AREAS.map((a) => {
        const r = rnd();
        return [a, r < wobble * 0.8 ? clamp(base[a] - 1) : r < wobble ? clamp(base[a] + 1) : base[a]];
      }),
    ) as Record<PulseArea, PulseLevel>;
    const response: PulseResponse = { pulseId: `p${i}`, week: week(i), levels };
    weeks.push({ week: week(i), response });
  }
  return { weeks, base };
}

function setLevel(w: WeekPulse, area: PulseArea, level: PulseLevel) {
  w.response ??= { pulseId: `p-${w.week}`, week: w.week, levels: { studies: 1, money: 1, health: 1, home: 1 } };
  w.response.levels[area] = level;
}

function makeStudent(rnd: () => number, wobble: number, missRate: number): Student {
  const planted = PLANTS[Math.floor(rnd() * PLANTS.length)];
  const area = PULSE_AREAS[Math.floor(rnd() * PULSE_AREAS.length)];
  const { weeks } = ordinary(rnd, wobble, missRate);
  const last = weeks[WEEKS - 1];
  const prev = weeks[WEEKS - 2];
  switch (planted) {
    case 'repeat_struggling':
      setLevel(prev, area, 0);
      setLevel(last, area, 0);
      return { weeks, planted, area };
    case 'drop_from_baseline':
      // usually "good" in this area, then "struggling" this week (last week still fine)
      for (const w of weeks.slice(0, -1)) if (w.response && rnd() > wobble / 2) w.response.levels[area] = 2;
      if (prev.response?.levels[area] === 0) prev.response.levels[area] = 1;
      setLevel(last, area, 0);
      return { weeks, planted, area };
    case 'silent':
      prev.response = null;
      last.response = null;
      if (!weeks.slice(0, -2).some((w) => w.response)) setLevel(weeks[0], area, 1);
      return { weeks, planted };
    case 'wants_to_talk':
      last.response ??= { pulseId: 'p-last', week: last.week, levels: { studies: 1, money: 1, health: 1, home: 1 } };
      last.response.wantsToTalk = true;
      return { weeks, planted };
    default:
      return { weeks, planted };
  }
}

interface Score {
  tp: number;
  fp: number;
  fn: number;
}
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '–');
const precision = (s: Score) => s.tp / (s.tp + s.fp);
const recall = (s: Score) => s.tp / (s.tp + s.fn);

function runFlags(wobble: number, missRate: number, seed: number) {
  const rnd = mulberry32(seed);
  const rules: Exclude<Planted, 'none'>[] = ['repeat_struggling', 'drop_from_baseline', 'silent', 'wants_to_talk'];
  const score = Object.fromEntries(rules.map((r) => [r, { tp: 0, fp: 0, fn: 0 }])) as Record<(typeof rules)[number], Score>;
  let flaggedNone = 0;
  let none = 0;
  for (let i = 0; i < STUDENTS; i++) {
    const s = makeStudent(rnd, wobble, missRate);
    const hits = evaluate(s.weeks);
    if (s.planted === 'none') {
      none++;
      if (hits.length) flaggedNone++;
    }
    for (const r of rules) {
      const truth = s.planted === r;
      // area rules must name the planted area to count as a catch
      const hit = hits.some((h) => h.rule === r && (!truth || !s.area || h.area === s.area));
      if (truth && hit) score[r].tp++;
      else if (truth) score[r].fn++;
      else if (hit) score[r].fp++;
    }
  }
  return { score, flaggedNoneRate: flaggedNone / none };
}

function runImproved(wobble: number, missRate: number, seed: number) {
  // Students flagged for "struggling" in weeks 3–4, mentor helps in week 4. Half recover to "good"
  // in weeks 5–6 (planted); the rest carry on wobbling around "struggling"/"ok".
  const rnd = mulberry32(seed);
  const s: Score = { tp: 0, fp: 0, fn: 0 };
  for (let i = 0; i < STUDENTS; i++) {
    const area = PULSE_AREAS[Math.floor(rnd() * PULSE_AREAS.length)];
    const { weeks } = ordinary(rnd, wobble, missRate, 7);
    setLevel(weeks[3], area, 0);
    setLevel(weeks[4], area, 0);
    const recovered = rnd() < 0.5;
    for (const w of weeks.slice(5)) {
      if (rnd() < missRate) {
        w.response = null;
        continue;
      }
      const r = rnd();
      setLevel(w, area, recovered ? (r < wobble ? 1 : 2) : r < 0.5 ? 0 : r < 0.5 + wobble ? 2 : 1);
    }
    const hit = improvedAfterHelp(weeks, week(4), area) !== null;
    if (recovered && hit) s.tp++;
    else if (recovered) s.fn++;
    else if (hit) s.fp++;
  }
  return s;
}

const lines: string[] = [];
const out = (l = '') => lines.push(l);

out('# Proof: do the flag rules work?');
out();
out('Generated by `pnpm --filter @heard/api proof` (`apps/api/scripts/proof.ts`). Synthetic data only, seed');
out(`${SEED}, ${STUDENTS} students per cohort, ${WEEKS} weeks each. The script runs the same rule code the API uses`);
out('(`packages/shared/src/rules.ts`).');
out();
out('**How it works.** Every synthetic student has a usual level per area (60% "good", 40% "ok"). Each week');
out('the answer *wobbles* one step away from that with some probability, and some weeks get no reply. Half');
out('the students get a planted problem in the last two weeks (two "struggling" weeks in a row, a sudden drop');
out('from a usual "good", two weeks of silence, or "I\'d like to talk"). The rest are ordinary.');
out('A catch counts only when the flag names the right rule and, for area rules, the right area.');
out();
out('*Precision* is how many flags were real: a low number means mentors see false alarms. *Recall* is how');
out('many planted problems were caught: a low number means students are missed.');
out();
for (const [i, n] of NOISE.entries()) {
  const { score, flaggedNoneRate } = runFlags(n.wobble, n.missRate, SEED + i);
  out(`## ${n.name[0].toUpperCase()}${n.name.slice(1)} cohort: wobble ${pct(n.wobble)}, missed replies ${pct(n.missRate)}`);
  out();
  out('| Rule | Caught | Missed | False alarms | Precision | Recall |');
  out('|---|---:|---:|---:|---:|---:|');
  for (const [rule, s] of Object.entries(score)) out(`| ${rule} | ${s.tp} | ${s.fn} | ${s.fp} | ${pct(precision(s))} | ${pct(recall(s))} |`);
  const imp = runImproved(n.wobble, n.missRate, SEED + 100 + i);
  out(`| improved (after help) | ${imp.tp} | ${imp.fn} | ${imp.fp} | ${pct(precision(imp))} | ${pct(recall(imp))} |`);
  out();
  out(`Ordinary students (nothing planted) with at least one flag: **${pct(flaggedNoneRate)}**.`);
  out();
}
out('## What this does and does not show');
out();
out('- **Planted problems are caught.** Recall stays at or near 100% for the four inbox rules at every noise level.');
out('  "I\'d like to talk" and "silent" are close to true by construction (the rule *is* the definition); the');
out('  useful numbers are their false alarms.');
out('- **False alarms grow with noise.** The cost is "repeat struggling": two bad weeks in a row happen by chance');
out('  to students who wobble a lot. On a calm cohort about 1 in 100 ordinary students gets a flag; on a noisy one,');
out('  about 1 in 8. Every flag shows the mentor the week-by-week history, so a chance pair is easy to dismiss with');
out('  a reason, and dismissals are logged so the rule can be tuned in a pilot.');
out('- **"Improved after help" is deliberately strict.** It needs two answered weeks after the help and a clear rise');
out('  (at least +0.75, ending at 1.5 or higher). Under heavy noise it misses many real recoveries (recall about 57%),');
out('  because missing replies and wobble both eat into the rise. It is a "good news" signal, so missing one costs little; claiming');
out('  help worked when it did not would be worse.');
out('- **What this is not.** It checks the rules against their own intent on synthetic data. Whether a flag meant');
out('  a student really needed help can only be measured with real use, from mentors marking flags as acted on or');
out('  dismissed (both are logged).');

const md = lines.join('\n') + '\n';
if (process.argv.includes('--print')) {
  console.log(md);
} else {
  const path = fileURLToPath(new URL('../../../docs/PROOF.md', import.meta.url));
  writeFileSync(path, md);
  console.log(md);
  console.log(`wrote ${path}`);
}
