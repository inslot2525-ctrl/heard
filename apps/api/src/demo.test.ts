import { evaluate, lastWeeks, type WeekPulse } from '@heard/shared';
import { describe, expect, it } from 'vitest';
import { DEMO_EXPECTED_FLAGS, DEMO_STUDENTS, demoPulses } from './demo.js';

const today = new Date('2026-11-18T12:00:00Z');

function historyFor(studentId: string): WeekPulse[] {
  const pulses = demoPulses(today).filter((p) => p.studentId === studentId);
  return lastWeeks(6, today).map((week) => {
    const p = pulses.find((x) => x.week === week);
    return {
      week,
      response: p
        ? { pulseId: `${studentId}-${week}`, week, levels: { studies: p.studies, money: p.money, health: p.health, home: p.home }, note: p.note, wantsToTalk: p.wantsToTalk }
        : null,
    };
  });
}

describe('demo campus data', () => {
  it('has 21 students with unique Nexconn-safe IDs', () => {
    expect(DEMO_STUDENTS).toHaveLength(21);
    const ids = DEMO_STUDENTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(21);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('flags exactly the four story students, each with its intended rule', () => {
    for (const s of DEMO_STUDENTS) {
      const rules = evaluate(historyFor(s.id)).map((h) => h.rule);
      const expected = DEMO_EXPECTED_FLAGS[s.id];
      if (expected) expect(rules, s.id).toEqual([expected]);
      else expect(rules, s.id).toEqual([]);
    }
  });

  it('puts the note on the latest reply only', () => {
    const priya = demoPulses(today).filter((p) => p.studentId === 'demopriya');
    expect(priya.at(-1)!.note).toBeTruthy();
    expect(priya.slice(0, -1).every((p) => !p.note)).toBe(true);
  });
});

describe('demo register', () => {
  it('only the two register stories trip a register rule', async () => {
    const { evaluateRegister, monthOf } = await import('@heard/shared');
    const { demoRegister } = await import('./demo.js');
    const today = new Date('2026-11-17T10:00:00Z');
    const rows = demoRegister(today);
    const byStudent = new Map<string, typeof rows>();
    for (const r of rows) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
    const hits = [...byStudent].flatMap(([id, rs]) => evaluateRegister(rs, monthOf(today)).map((h) => `${id}:${h.rule}:${h.metric}`));
    expect(hits.sort()).toEqual(['demorahul:register_decline:attendance', 'demoyash:conduct_concern:conduct']);
  });
});
