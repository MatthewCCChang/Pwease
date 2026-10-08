import { Hono } from 'hono';
// import { apiErrorSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { auth } from './auth';

export const authRoutes = new Hono<ApiEnvironment>();

// Replace this boundary with Better Auth's handler once providers and its schema exist.
authRoutes.all('/*', (c) => auth.handler(c.req.raw));
