import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { Bindings } from '../env';
import * as schema from './schema';

function createDatabase(pool: Pool) {
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type QueryDatabase = Database | Transaction;

export async function withDatabase<T>(
  env: Pick<Bindings, 'DATABASE_URL'>,
  run: (database: Database) => Promise<T>,
): Promise<T> {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    return await run(createDatabase(pool));
  } finally {
    await pool.end();
  }
}
