import { describe, expect, it } from 'vitest';
import { isoWeek, lastWeeks } from './weeks.js';

describe('isoWeek', () => {
  it.each([
    ['2026-10-31', '2026-W44'], // Saturday
    ['2026-11-02', '2026-W45'], // Monday starts a new week
    ['2026-11-01', '2026-W44'], // Sunday is the end of the week
    ['2027-01-01', '2026-W53'], // 2026 has 53 ISO weeks
    ['2026-12-31', '2026-W53'],
    ['2021-01-03', '2020-W53'],
    ['2025-12-29', '2026-W01'], // Monday belonging to next year's week 1
  ])('%s → %s', (date, week) => {
    expect(isoWeek(new Date(`${date}T12:00:00Z`))).toBe(week);
  });
});

describe('lastWeeks', () => {
  it('returns consecutive weeks, oldest first', () => {
    expect(lastWeeks(3, new Date('2026-11-04T12:00:00Z'))).toEqual(['2026-W43', '2026-W44', '2026-W45']);
  });
  it('crosses year boundaries', () => {
    expect(lastWeeks(2, new Date('2027-01-06T12:00:00Z'))).toEqual(['2026-W53', '2027-W01']);
  });
});
