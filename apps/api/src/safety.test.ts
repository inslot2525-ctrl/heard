import { describe, expect, it } from 'vitest';
import { matchSafety } from './safety.js';

describe('matchSafety', () => {
  it.each([
    ['I just want to die', 'self_harm'],
    ['sometimes I think about Suicide', 'self_harm'],
    ['मला आता जगायचं नाही', 'self_harm'],
    ['मैं जीना नहीं चाहता', 'self_harm'],
    ['我真的不想活了', 'self_harm'],
    ['seniors are ragging us at night', 'ragging'],
    ['हॉस्टेलमध्ये रॅगिंग होते', 'ragging'],
  ])('%s → %s', (text, kind) => {
    expect(matchSafety(text)?.kind).toBe(kind);
  });

  it.each(['I died laughing at that video', 'deadline is killing me', 'the exam was a killer', 'मला घरची खूप आठवण येते', '老师您好'])(
    'ignores ordinary text: %s',
    (text) => {
      expect(matchSafety(text)).toBeNull();
    },
  );
});
