import { describe, expect, it } from 'vitest';
import { needsTranslation, scriptOf, useLlmTranslation } from './languages.js';

describe('script detection', () => {
  it('finds the main script', () => {
    expect(scriptOf('हो सर, आज बोलूया का?')).toBe('devanagari');
    expect(scriptOf('老师您好')).toBe('han');
    expect(scriptOf('dont worry life is tough')).toBe('latin');
    expect(scriptOf('👍 123')).toBeNull();
    expect(scriptOf('ok सर, उद्या भेटूया')).toBe('devanagari'); // mixed: most letters win
  });

  it('decides when to auto-translate', () => {
    // Marathi text from someone who picked English, read by an English speaker → translate
    expect(needsTranslation('हो सर, आज बोलूया का?', 'en', 'en')).toBe(true);
    // English text, both English → no
    expect(needsTranslation('see you at dinner', 'en', 'en')).toBe(false);
    // Different chosen languages → yes, even in the same script (Hindi ↔ Marathi)
    expect(needsTranslation('मैं ठीक हूँ', 'mr', 'hi')).toBe(true);
    // English text read by a Marathi speaker → yes
    expect(needsTranslation('see you at dinner', 'mr')).toBe(true);
    // Emoji only → no
    expect(needsTranslation('👍', 'mr', 'mr')).toBe(false);
  });
});

describe('which translator', () => {
  it('uses Gemini for Indian-script text even when the sender picked English', () => {
    expect(useLlmTranslation('en', 'en', 'मला आता जगायचं नाही')).toBe(true);
    expect(useLlmTranslation('en', 'zh', 'see you')).toBe(false);
    expect(useLlmTranslation('zh', 'en', '老师您好')).toBe(false); // Nexconn does zh ↔ en well
    expect(useLlmTranslation('en', 'mr', 'see you')).toBe(true);
  });
});
