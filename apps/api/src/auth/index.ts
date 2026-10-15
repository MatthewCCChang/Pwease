import { Hono } from 'hono';
import type { ApiEnvironment } from '../env';
import { createAuth } from './auth';
import { withDatabase } from '../db';
import { fail } from '../routes/errors';
export const authRoutes = new Hono<ApiEnvironment>();
authRoutes.all('/*', (c) => {
  if (!c.env?.DATABASE_URL) fail(503, 'SERVICE_UNAVAILABLE', 'Authentication database is not configured.');
  return withDatabase(c.env, (db) => createAuth(c.env, db).handler(c.req.raw));
});
