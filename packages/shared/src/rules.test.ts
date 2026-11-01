import { describe, expect, it } from 'vitest';
import type { PulseLevel, PulseResponse } from './messages.js';
import { dropFromBaseline, evaluate, improvedAfterHelp, repeatStruggling, silent, wantsToTalk, type WeekPulse } from './rules.js';

type L = PulseLevel;
const resp = (week: string, s: L, m: L, h: L, f: L, extra: Partial<PulseResponse> = {}): WeekPulse => ({
  week,
  response: { pulseId: `p-${week}`, week, levels: { studies: s, money: m, health: h, home: f }, ...extra },
});
const none = (week: string): WeekPulse => ({ week, response: null });

describe('repeatStruggling', () => {
  it('fires when the same area is struggling two weeks running', () => {
    const hits = repeatStruggling([resp('W1', 2, 2, 2, 2), resp('W2', 2, 0, 2, 2), resp('W3', 1, 0, 2, 2, { note: 'fees late' })]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ rule: 'repeat_struggling', area: 'money', studentWords: 'fees late' });
  });
  it('does not fire across a missed week', () => {
    expect(repeatStruggling([resp('W1', 2, 0, 2, 2), none('W2'), resp('W3', 2, 0, 2, 2)])).toEqual([]);
  });
  it('does not fire on a single bad week', () => {
    expect(repeatStruggling([resp('W1', 2, 2, 2, 2), resp('W2', 2, 0, 2, 2)])).toEqual([]);
  });
});

describe('dropFromBaseline', () => {
  it('fires on good → struggling against a usual "good"', () => {
    const hits = dropFromBaseline([resp('W1', 2, 2, 2, 2), resp('W2', 2, 2, 2, 2), resp('W3', 2, 1, 2, 2), resp('W4', 2, 2, 0, 2)]);
    expect(hits.map((h) => h.area)).toEqual(['health']);
  });
  it('needs three earlier replies', () => {
    expect(dropFromBaseline([resp('W1', 2, 2, 2, 2), resp('W2', 2, 2, 2, 2), resp('W3', 0, 2, 2, 2)])).toEqual([]);
  });
  it('ignores ok → struggling (only one level)', () => {
    expect(dropFromBaseline([resp('W1', 1, 2, 2, 2), resp('W2', 1, 2, 2, 2), resp('W3', 1, 2, 2, 2), resp('W4', 0, 2, 2, 2)])).toEqual([]);
  });
});

describe('silent', () => {
  it('fires after two missed weeks if they replied before', () => {
    expect(silent([resp('W1', 2, 2, 2, 2), none('W2'), none('W3')])).toHaveLength(1);
  });
  it('does not fire for someone who never replied', () => {
    expect(silent([none('W1'), none('W2'), none('W3')])).toEqual([]);
  });
});

describe('wantsToTalk', () => {
  it('fires on the tap and carries their words', () => {
    expect(wantsToTalk([resp('W1', 2, 2, 2, 2, { wantsToTalk: true, note: 'miss home' })])[0]).toMatchObject({
      rule: 'wants_to_talk',
      studentWords: 'miss home',
    });
  });
});

describe('evaluate', () => {
  it('keeps one card per area when repeat and drop overlap', () => {
    const weeks = [resp('W1', 2, 2, 2, 2), resp('W2', 2, 2, 2, 2), resp('W3', 2, 2, 2, 2), resp('W4', 2, 0, 2, 2), resp('W5', 2, 0, 2, 2)];
    const hits = evaluate(weeks);
    expect(hits.filter((h) => h.area === 'money').map((h) => h.rule)).toEqual(['repeat_struggling']);
  });
  it('returns nothing for a steady student', () => {
    expect(evaluate([resp('W1', 2, 1, 2, 2), resp('W2', 2, 1, 2, 2), resp('W3', 1, 1, 2, 2)])).toEqual([]);
  });
});

describe('improvedAfterHelp', () => {
  const weeks = [resp('W1', 2, 2, 2, 2), resp('W2', 2, 0, 2, 2), resp('W3', 2, 0, 2, 2), resp('W4', 2, 2, 2, 2), resp('W5', 2, 2, 2, 2)];
  it('fires when the flagged area recovers after the help week', () => {
    const hit = improvedAfterHelp(weeks, 'W3', 'money');
    expect(hit).toMatchObject({ rule: 'improved', area: 'money' });
    expect(hit!.reason).toContain('average 0.0 in W2, W3, 2.0 in W4, W5');
  });
  it('needs two answered weeks after the help', () => {
    expect(improvedAfterHelp(weeks.slice(0, 4), 'W3', 'money')).toBeNull();
  });
  it('ignores small changes', () => {
    const flat = [resp('W1', 1, 1, 1, 1), resp('W2', 1, 1, 1, 1), resp('W3', 1, 2, 1, 1), resp('W4', 1, 2, 1, 1)];
    expect(improvedAfterHelp(flat, 'W2')).toBeNull(); // overall 1.0 → 1.25
  });
  it('uses all four areas when no area is given', () => {
    const w = [resp('W1', 1, 0, 1, 1), resp('W2', 1, 0, 1, 1), resp('W3', 2, 2, 2, 1), resp('W4', 2, 2, 2, 2)];
    expect(improvedAfterHelp(w, 'W2')?.area).toBeUndefined();
    expect(improvedAfterHelp(w, 'W2')).not.toBeNull(); // 0.75 → 1.875
  });
});
