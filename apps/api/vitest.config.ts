import { defineConfig } from 'vitest/config';

// Each API test starts an in-memory Postgres (PGlite); under a parallel full run that can take
// several seconds, so the default 5 s per test is too tight.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
