import { Hono } from 'hono';
import type { ApiEnvironment } from '../env';
import { createAuth } from './auth';
import { withDatabase } from '../db';
import { fail } from '../routes/errors';

export function createAuthRoutes(database: typeof withDatabase = withDatabase) {
  const routes = new Hono<ApiEnvironment>();
  // Better Auth owns session lookup/renewal and logout. Preserve its cookies.
  routes.all('/*', (c) => {
    c.header('Cache-Control', 'no-store');
    if (!c.env?.DATABASE_URL) fail(503, 'SERVICE_UNAVAILABLE', 'Authentication database is not configured.');
    return database(c.env, (db) => createAuth(c.env, db).handler(c.req.raw));
  });
  return routes;
}
export const authRoutes = createAuthRoutes();
