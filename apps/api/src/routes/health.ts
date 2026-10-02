import { Hono } from 'hono';
import { healthResponseSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';

export const healthRoutes = new Hono<ApiEnvironment>();

healthRoutes.get('/health', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(healthResponseSchema.parse({
    status: 'ok',
    service: 'pwease-api',
    version: '0.1.0',
  }));
});
