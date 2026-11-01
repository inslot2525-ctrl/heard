import { describe, expect, it } from 'vitest';
import { parseThemes } from './themes.js';

describe('theme tags', () => {
  it('keeps only known themes, at most 3, no duplicates', () => {
    expect(parseThemes('{"themes":["fees_money","homesick","fees_money"]}')).toEqual(['fees_money', 'homesick']);
    expect(parseThemes('{"themes":["depressed","fees_money","exams_studies","family","other"]}')).toEqual(['fees_money', 'exams_studies', 'family']);
    expect(parseThemes('nothing')).toEqual([]);
  });
});
