import { Hono } from 'hono';
import type { ErrorHandler } from 'hono';
import { apiErrorSchema } from '@pwease/shared';
import type { ApiEnvironment } from './env';
import { healthRoutes } from './routes/health';
import { authRoutes } from './auth';
import { businessRoutes } from './routes/business';

export const app = new Hono<ApiEnvironment>();

app.route('/api', healthRoutes);
app.route('/api/auth', authRoutes);
app.route('/api', businessRoutes);

app.notFound((c) => c.json(apiErrorSchema.parse({
  error: { code: 'NOT_FOUND', message: 'This endpoint does not exist.' },
}), 404));

export const handleError: ErrorHandler<ApiEnvironment> = (_error, c) => c.json(apiErrorSchema.parse({
  error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
}), 500);

app.onError(handleError);
