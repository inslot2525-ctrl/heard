import { defineConfig } from 'drizzle-kit';

// `pnpm --filter @heard/api db:generate` writes SQL migrations to ./drizzle after schema changes.
// Migrations run automatically when the API starts (src/db/client.ts).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
