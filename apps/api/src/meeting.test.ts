import { describe, expect, it } from 'vitest';
import type { FactSheet } from './ask.js';
import { parseMeeting } from './meeting.js';

const sheet: FactSheet = {
  text: '',
  students: [{ id: 's1', name: 'Priya Patil' }],
  facts: new Map([
    ['priya patil|2026-W44|health', 'good'],
    ['priya patil|2026-W44|money', 'struggling'],
  ]),
};
const R = (area: string, value: string) => ({ student: 'Priya Patil', week: '2026-W44', area, value });

describe('meeting card fact-check', () => {
  it('keeps points whose receipts all match, removes the rest', () => {
    const card = parseMeeting(
      sheet,
      'Priya Patil',
      JSON.stringify({
        strengths: [
          { text: 'Health has been good.', receipts: [R('health', 'good')] },
          { text: 'Studies are excellent.', receipts: [R('studies', 'good')] }, // not in the records
          { text: 'Always cheerful.', receipts: [] }, // no receipt
        ],
        changes: [{ text: 'Money became hard this week.', receipts: [R('money', 'struggling')] }],
        questions: ['How are things going with fees?', 'What would help most right now?'],
        avoid: ['Lecturing about budgeting'],
      }),
    );
    expect(card!.strengths.map((p) => p.text)).toEqual(['Health has been good.']);
    expect(card!.changes).toHaveLength(1);
    expect(card!.removed).toEqual(['Studies are excellent.', 'Always cheerful.']);
    expect(card!.questions).toHaveLength(2);
    expect(card!.avoid).toEqual(['Lecturing about budgeting']);
  });

  it('returns null for junk', () => {
    expect(parseMeeting(sheet, 'Priya Patil', 'sorry')).toBeNull();
  });
});
