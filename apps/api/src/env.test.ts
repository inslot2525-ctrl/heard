import { describe, expect, it } from 'vitest';
import { parseOrigins } from './env.js';

describe('parseOrigins', () => {
  it('adds https:// to bare hosts (Render passes hosts) and trims slashes', () => {
    expect(parseOrigins('heard-web.onrender.com')).toEqual(['https://heard-web.onrender.com']);
    expect(parseOrigins('http://localhost:5173/, heard-web.onrender.com')).toEqual(['http://localhost:5173', 'https://heard-web.onrender.com']);
  });
});
