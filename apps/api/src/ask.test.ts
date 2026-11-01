import { describe, expect, it } from 'vitest';
import { parseAsk, verifyReceipts, type FactSheet } from './ask.js';

const sheet: FactSheet = {
  text: '',
  students: [{ id: 's1', name: 'Priya Patil' }],
  facts: new Map([
    ['priya patil|2026-W44|money', 'struggling'],
    ['priya patil|2026-W44|checkin', 'answered'],
    ['priya patil|2026-W43|checkin', 'no reply'],
  ]),
};

describe('Ask Heard receipts', () => {
  it('parses the model reply', () => {
    const p = parseAsk('```json\n{"answer":"Priya struggled with money.","receipts":[{"student":"Priya Patil","week":"2026-W44","area":"money","value":"struggling"}]}\n```');
    expect(p?.answer).toBe('Priya struggled with money.');
    expect(p?.receipts).toHaveLength(1);
    expect(parseAsk('no json here')).toBeNull();
  });

  it('verifies only receipts that match the records exactly', () => {
    const r = verifyReceipts(sheet, [
      { student: 'priya patil', week: '2026-W44', area: 'money', value: 'struggling' }, // case-insensitive name: ok
      { student: 'Priya Patil', week: '2026-W44', area: 'money', value: 'good' }, // wrong value
      { student: 'Rohan Yadav', week: '2026-W44', area: 'money', value: 'struggling' }, // not my student
      { student: 'Priya Patil', week: '2026-W43', area: 'checkin', value: 'no reply' },
      { student: 'Priya Patil', week: '2026-W40', area: 'money', value: 'struggling' }, // week not in sheet
    ]);
    expect(r.map((x) => x.verified)).toEqual([true, false, false, true, false]);
    expect(r[0].studentId).toBe('s1');
    expect(r[2].studentId).toBeNull();
  });
});
