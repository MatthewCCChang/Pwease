import { Hono } from 'hono';
import { apiErrorSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';

export const authRoutes = new Hono<ApiEnvironment>();

// Replace this boundary with Better Auth's handler once providers and its schema exist.
authRoutes.all('/*', (c) => c.json(apiErrorSchema.parse({
  error: { code: 'NOT_IMPLEMENTED', message: 'Apple/Google sign-in and sessions are not implemented.' },
}), 501));
