import { describe, expect, it } from 'vitest';
import { ALL_LANGUAGES, FEATURED, isLanguage, languageName, uiLangFor } from './languages.js';

describe('languages', () => {
  it('has 211 chat languages and every featured one is among them', () => {
    expect(ALL_LANGUAGES).toHaveLength(211);
    for (const f of FEATURED) expect(isLanguage(f.code), f.code).toBe(true);
  });
  it('excludes languages Nexconn only translates to and from Chinese', () => {
    for (const c of ['zh-tw', 'mn', 'yue']) expect(isLanguage(c)).toBe(false);
  });
  it('maps chat languages to UI languages', () => {
    expect(uiLangFor('zh')).toBe('zh');
    expect(uiLangFor('ta')).toBe('en');
    expect(languageName('ta')).toBe('தமிழ்');
    expect(languageName('ace')).toBe('Achinese');
  });
});
