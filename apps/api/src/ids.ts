import { createHash, randomInt } from 'node:crypto';

// Nexconn IDs allow letters and digits only. Lowercase + digits, no look-alikes (0/o, 1/l).
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function randomId(length = 10) {
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** e.g. newId('u') → "u7hk2mxq9ra" */
export function newId(prefix: string, length = 10) {
  return prefix + randomId(length);
}

/**
 * Personal login code, e.g. "K7MQ-2XHD-9RTP". 12 symbols from a 32-letter alphabet = 60 bits:
 * not guessable, especially with the login rate limit. Only its hash is stored.
 */
export function newLoginCode() {
  const raw = randomId(12).toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

export function normalizeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashLoginCode(code: string) {
  return createHash('sha256').update(`heard-login:${normalizeCode(code)}`).digest('hex');
}

/** Human-friendly join code, e.g. "HSTA-7K2M". Uppercase, no look-alikes. */
export function newJoinCode(prefix: string) {
  return `${prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)}-${randomId(4).toUpperCase()}`;
}
