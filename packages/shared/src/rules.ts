// Flag rules. Pure functions, no I/O, no LLM. Each rule explains itself in plain English.
// Input: one student's pulse history, oldest first, one entry per week (null = no reply that week).

import { PULSE_AREAS, type PulseArea, type PulseLevel, type PulseResponse } from './messages.js';

export interface WeekPulse {
  week: string;
  response: PulseResponse | null;
}

export interface FlagHit {
  rule: RuleId;
  area?: PulseArea;
  reason: string;
  history?: { week: string; level: PulseLevel | null }[];
  studentWords?: string;
}

export type RuleId = 'repeat_struggling' | 'drop_from_baseline' | 'silent' | 'wants_to_talk';

const AREA_LABEL: Record<PulseArea, string> = {
  studies: 'studies',
  money: 'money',
  health: 'health',
  home: 'home / family',
};

const LEVEL_LABEL: Record<PulseLevel, string> = { 2: 'good', 1: 'ok', 0: 'struggling' };

function areaHistory(weeks: WeekPulse[], area: PulseArea) {
  return weeks.slice(-6).map((w) => ({ week: w.week, level: w.response ? w.response.levels[area] : null }));
}

/** "Struggling" on the same area in each of the last 2 replied weeks, which must be consecutive weeks. */
export function repeatStruggling(weeks: WeekPulse[]): FlagHit[] {
  const lastTwo = weeks.slice(-2);
  if (lastTwo.length < 2 || lastTwo.some((w) => !w.response)) return [];
  return PULSE_AREAS.filter((a) => lastTwo.every((w) => w.response!.levels[a] === 0)).map((area) => ({
    rule: 'repeat_struggling',
    area,
    reason: `Said "struggling" with ${AREA_LABEL[area]} two weeks in a row (${lastTwo.map((w) => w.week).join(', ')}).`,
    history: areaHistory(weeks, area),
    studentWords: weeks.at(-1)!.response!.note,
  }));
}

/**
 * Latest reply is 2 levels below the student's own usual level (good → struggling).
 * Baseline = most common level over earlier replies; needs at least 3 earlier replies.
 */
export function dropFromBaseline(weeks: WeekPulse[]): FlagHit[] {
  const latest = weeks.at(-1)?.response;
  if (!latest) return [];
  const earlier = weeks.slice(0, -1).filter((w) => w.response);
  if (earlier.length < 3) return [];
  const hits: FlagHit[] = [];
  for (const area of PULSE_AREAS) {
    const counts = [0, 0, 0];
    for (const w of earlier) counts[w.response!.levels[area]]++;
    // ties resolve to the higher level, so a drop is only reported against a clearly usual "good"
    const baseline = ([2, 1, 0] as PulseLevel[]).reduce((best, l) => (counts[l] > counts[best] ? l : best), 2 as PulseLevel);
    if (baseline - latest.levels[area] >= 2) {
      hits.push({
        rule: 'drop_from_baseline',
        area,
        reason: `${AREA_LABEL[area][0].toUpperCase()}${AREA_LABEL[area].slice(1)} is usually "${LEVEL_LABEL[baseline]}" for this student; this week it was "${LEVEL_LABEL[latest.levels[area]]}".`,
        history: areaHistory(weeks, area),
        studentWords: latest.note,
      });
    }
  }
  return hits;
}

/** No reply for the last 2 weeks, after having replied at least once before. */
export function silent(weeks: WeekPulse[]): FlagHit[] {
  const lastTwo = weeks.slice(-2);
  if (lastTwo.length < 2 || lastTwo.some((w) => w.response)) return [];
  if (!weeks.slice(0, -2).some((w) => w.response)) return [];
  return [{ rule: 'silent', reason: `No check-in reply for 2 weeks (${lastTwo.map((w) => w.week).join(', ')}), after replying before.` }];
}

/** Student tapped "I'd like to talk" this week. */
export function wantsToTalk(weeks: WeekPulse[]): FlagHit[] {
  const latest = weeks.at(-1)?.response;
  if (!latest?.wantsToTalk) return [];
  return [{ rule: 'wants_to_talk', reason: 'Asked to talk to their mentor.', studentWords: latest.note }];
}

/**
 * Run every rule. When one area triggers both "repeat" and "drop", keep only "repeat",
 * so the mentor sees one card per problem.
 */
export function evaluate(weeks: WeekPulse[]): FlagHit[] {
  const repeat = repeatStruggling(weeks);
  const repeatAreas = new Set(repeat.map((h) => h.area));
  return [
    ...wantsToTalk(weeks),
    ...repeat,
    ...dropFromBaseline(weeks).filter((h) => !repeatAreas.has(h.area)),
    ...silent(weeks),
  ];
}
