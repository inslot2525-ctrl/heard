import { describe, expect, it } from 'vitest';
import { checkOpener, draftOpener } from './openers.js';

describe('draftOpener', () => {
  it('drafts in the mentor’s language with the first name', () => {
    expect(draftOpener('repeat_struggling', 'money', 'Li Na', 'zh')).toBe('Li你好，谢谢你每周按时签到。看起来最近经济方面有些困难。这周我们能聊几分钟吗？直接在这里回复就可以。');
    expect(draftOpener('silent', '', 'Priya Patil', 'mr')).toContain('नमस्कार Priya');
  });
  it('falls back to English for languages without templates', () => {
    expect(draftOpener('wants_to_talk', '', 'Kavya R', 'ta')).toMatch(/^Hi Kavya, you asked to talk/);
  });
});

describe('checkOpener', () => {
  it('refuses labels in English, Hindi and Chinese', () => {
    expect(checkOpener('You seem depressed')).toBe('labels_or_diagnosis');
    expect(checkOpener('क्या आपको डिप्रेशन है?')).toBe('labels_or_diagnosis');
    expect(checkOpener('你是不是抑郁了？')).toBe('labels_or_diagnosis');
  });
  it('allows ordinary words like "score" and "discipline"', () => {
    expect(checkOpener('Your exam score is fine, and your discipline shows. Shall we talk?')).toBeNull();
  });
});
