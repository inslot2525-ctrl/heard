// One database API for both environments:
// - DATABASE_URL set → Postgres (Neon in production) through postgres.js
// - otherwise → PGlite (embedded Postgres) in apps/api/.pglite, or in memory for tests

import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));
const LOCAL_DIR = fileURLToPath(new URL('../../.pglite', import.meta.url));

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

/** `memory` = throwaway in-memory database (tests). */
export async function openDb(opts: { url?: string; memory?: boolean } = {}): Promise<DbHandle> {
  if (opts.url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const sql = postgres(opts.url, { max: 5, prepare: false });
    const db = drizzle(sql, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return { db: db as unknown as Db, close: () => sql.end() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const client = new PGlite(opts.memory ? undefined : LOCAL_DIR);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, close: () => client.close() };
}
