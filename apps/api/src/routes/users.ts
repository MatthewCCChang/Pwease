import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { updateProfileSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { user } from '../db/schema';
import { body, defaultDependencies, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

export function createUserRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.get('/me', protectedHandler(deps, async (c, db, userId) => {
    const [profile] = await db.select().from(user).where(eq(user.id, userId));
    if (!profile) fail(401, 'UNAUTHORIZED', 'Your user account no longer exists.');
    return c.json(profile);
  }));
  routes.patch('/me', protectedHandler(deps, async (c, db, userId) => {
    const input = await body(c, updateProfileSchema);
    const [profile] = await db.update(user).set(input).where(eq(user.id, userId)).returning();
    if (!profile) fail(401, 'UNAUTHORIZED', 'Your user account no longer exists.');
    return c.json(profile);
  }));
  return routes;
}
export const userRoutes = createUserRoutes(defaultDependencies);
