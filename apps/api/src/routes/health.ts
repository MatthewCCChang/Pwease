import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { databaseHealthResponseSchema, healthResponseSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { withDatabase } from '../db';
import { fail } from './errors';

export function createHealthRoutes(database: typeof withDatabase = withDatabase) {
  const routes = new Hono<ApiEnvironment>();

  routes.get('/health', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json(healthResponseSchema.parse({
      status: 'ok',
      service: 'pwease-api',
      version: '0.1.0',
    }));
  });

  routes.get('/db', async (c) => {
    c.header('Cache-Control', 'no-store');
    if (!c.env?.DATABASE_URL) {
      fail(503, 'SERVICE_UNAVAILABLE', 'The database is not configured.');
    }
    try {
      await database(c.env, async (db) => {
        await db.execute(sql`select 1`);
      });
    } catch {
      fail(503, 'SERVICE_UNAVAILABLE', 'The database is unavailable.');
    }
    return c.json(databaseHealthResponseSchema.parse({
      status: 'ok',
      service: 'pwease-db',
      version: '0.1.0',
    }));
  });

  return routes;
}

export const healthRoutes = createHealthRoutes();
