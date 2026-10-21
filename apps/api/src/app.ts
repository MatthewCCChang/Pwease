import { Hono } from 'hono';
import type { ErrorHandler } from 'hono';
import { cors } from 'hono/cors';
import { apiErrorSchema } from '@pwease/shared';
import type { ApiEnvironment } from './env';
import { healthRoutes } from './routes/health';
import { createAuthRoutes } from './auth';
import { webOrigin } from './auth/auth';
import { createUserRoutes, userRoutes } from './routes/users';
import { createWorkspaceRoutes } from './routes/workspaces';
import { createCardRoutes } from './routes/cards';
import { createStampRequestRoutes } from './routes/stamp-requests';
import { defaultDependencies } from './routes/helpers';
import type { RouteDependencies } from './routes/helpers';
import { RouteError } from './routes/errors';

export const handleError: ErrorHandler<ApiEnvironment> = (error, c) => {
  if (error instanceof RouteError) {
    return c.json(apiErrorSchema.parse({ error: { code: error.code, message: error.message } }), error.status);
  }
  return c.json(apiErrorSchema.parse({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  }), 500);
};

// Dependency injection is used only by tests; production always verifies Better Auth sessions.
export function createApp(deps: RouteDependencies = defaultDependencies) {
  const app = new Hono<ApiEnvironment>();
  app.use('/api/*', async (c, next) => cors({
    origin: webOrigin(c.env ?? {}) ?? '', credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })(c, next));
  app.route('/api', healthRoutes);
  app.route('/api/auth', createAuthRoutes(deps.withDatabase));
  app.route('/api', deps === defaultDependencies ? userRoutes : createUserRoutes(deps));
  app.route('/api', createWorkspaceRoutes(deps));
  app.route('/api', createCardRoutes(deps));
  app.route('/api', createStampRequestRoutes(deps));
  app.notFound((c) => c.json(apiErrorSchema.parse({ error: { code: 'NOT_FOUND', message: 'This endpoint does not exist.' } }), 404));
  app.onError(handleError);
  return app;
}
export const app = createApp();
