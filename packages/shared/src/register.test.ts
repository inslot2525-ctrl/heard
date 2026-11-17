import { describe, expect, it } from 'vitest';
import { addMonths, cleanValue, evaluateRegister, lastMonths, perceptionGap, sixMonthReview, targetMet, type RegisterRow } from './register.js';

const row = (month: string, v: Partial<RegisterRow> = {}): RegisterRow => ({ month, attendance: 90, academics: 80, duties: 90, activities: 12, conduct: 0, ...v });
const months = lastMonths(6, '2026-11'); // Jun..Nov

describe('months', () => {
  it('steps across years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(lastMonths(3, '2026-02')).toEqual(['2025-12', '2026-01', '2026-02']);
  });
  it('cleans values', () => {
    expect(cleanValue('attendance', '85%')).toBe(85);
    expect(cleanValue('attendance', 140)).toBe(100);
    expect(cleanValue('conduct', 'x')).toBeNull();
    expect(cleanValue('activities', '')).toBeNull();
  });
});

describe('register rules', () => {
  it('a steady student never flags', () => {
    expect(evaluateRegister(months.map((m) => row(m)), '2026-11')).toEqual([]);
  });
  it('catches a three-month decline, not a small one', () => {
    const att = [92, 92, 88, 80, 72, 61];
    const hits = evaluateRegister(months.map((m, i) => row(m, { attendance: att[i] })), '2026-11');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ rule: 'register_decline', metric: 'attendance' });
    expect(hits[0].reason).toContain('88% → 80% → 72% → 61%');
    const small = [92, 92, 90, 88, 86, 84];
    expect(evaluateRegister(months.map((m, i) => row(m, { attendance: small[i] })), '2026-11')).toEqual([]);
  });
  it('catches a sudden drop against their own usual', () => {
    const act = [12, 13, 12, 12, 14, 3];
    const hits = evaluateRegister(months.map((m, i) => row(m, { activities: act[i] })), '2026-11');
    expect(hits.map((h) => [h.rule, h.metric])).toEqual([['register_drop', 'activities']]);
  });
  it('conduct: a one-off never flags; repeats or 3 in a month do', () => {
    const one = months.map((m, i) => row(m, { conduct: i === 5 ? 1 : 0 }));
    expect(evaluateRegister(one, '2026-11')).toEqual([]);
    const repeat = months.map((m, i) => row(m, { conduct: i >= 4 ? 1 : 0 }));
    expect(evaluateRegister(repeat, '2026-11')[0]).toMatchObject({ rule: 'conduct_concern' });
    const burst = months.map((m, i) => row(m, { conduct: i === 5 ? 3 : 0 }));
    expect(evaluateRegister(burst, '2026-11')[0].reason).toContain('3 conduct incidents');
  });
  it('skips a metric the hostel does not record', () => {
    expect(evaluateRegister(months.map((m) => row(m, { duties: null })), '2026-11')).toEqual([]);
  });
});

describe('perception gap and targets', () => {
  it('only for studies-related metrics when they mostly said "good"', () => {
    expect(perceptionGap('attendance', [2, 2, 1, null])).toContain('"good" 2 of 3');
    expect(perceptionGap('attendance', [0, 1, 0])).toBeNull();
    expect(perceptionGap('conduct', [2, 2])).toBeNull();
  });
  it('targets respect direction', () => {
    expect(targetMet('attendance', 75, 80)).toBe(true);
    expect(targetMet('conduct', 0, 1)).toBe(false);
    expect(targetMet('activities', 12, null)).toBeNull();
  });
});

describe('six-month review', () => {
  it('a steady student: continue', () => {
    expect(sixMonthReview(months.map((m) => row(m)), '2026-11').suggestion).toBe('continue');
  });
  it('never goes beyond "discuss at review", even with everything bad', () => {
    const bad = months.map((m) => row(m, { attendance: 30, academics: 30, duties: 20, activities: 0, conduct: 3 }));
    const r = sixMonthReview(bad, '2026-11');
    expect(r.suggestion).toBe('discuss_at_review');
    expect(r.items.find((i) => i.criterion === 'conduct')?.level).toBe('concern');
  });
  it('one concern: continue with support; missing data is not a concern about the student', () => {
    const r = sixMonthReview(months.map((m) => row(m, { attendance: 50 })), '2026-11');
    expect(r.suggestion).toBe('continue_with_support');
    const empty = sixMonthReview([], '2026-11');
    expect(empty.items.filter((i) => i.level === 'no_data').length).toBe(4);
    expect(empty.suggestion).toBe('not_enough_records');
  });
});
