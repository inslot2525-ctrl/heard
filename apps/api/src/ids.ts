import { randomInt } from 'node:crypto';

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

/** Human-friendly join code, e.g. "HSTA-7K2M". Uppercase, no look-alikes. */
export function newJoinCode(prefix: string) {
  return `${prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)}-${randomId(4).toUpperCase()}`;
}
