import type { Context, Handler } from 'hono';
import { and, eq } from 'drizzle-orm';
import { resourceIdSchema } from '@pwease/shared';
import { withDatabase } from '../db';
import type { Database, QueryDatabase } from '../db';
import type { ApiEnvironment, Bindings } from '../env';
import { createAuth, webOrigin } from '../auth/auth';
import { cardDefinition, workspace, workspaceMember } from '../db/schema';
import { fail } from './errors';
export type RouteContext = Context<ApiEnvironment>;
export interface RouteDependencies {
  withDatabase: typeof withDatabase;
  authenticate: (db: Database, env: Bindings, headers: Headers) => Promise<{ userId: string | null; headers: Headers }>;
}
export const defaultDependencies: RouteDependencies = {
  withDatabase,
  async authenticate(db, env, headers) {
    const result = await createAuth(env, db).api.getSession({ headers, returnHeaders: true });
    return { userId: result.response?.user.id ?? null, headers: result.headers };
  },
};
export function protectedHandler(deps: RouteDependencies,
  handler: (c: RouteContext, db: Database, userId: string) => Promise<Response>): Handler<ApiEnvironment> {
  return async (c) => {
    c.header('Cache-Control', 'no-store');
    if (!c.req.header('cookie')) fail(401, 'UNAUTHORIZED', 'Sign in to continue.');
    if (!['GET', 'HEAD'].includes(c.req.method)) {
      const origin = c.req.header('origin');
      if ((origin && origin !== webOrigin(c.env ?? {})) || (!origin && c.req.header('sec-fetch-site') === 'cross-site')) {
        fail(403, 'FORBIDDEN', 'This request origin is not allowed.');
      }
    }
    if (!c.env?.DATABASE_URL) fail(503, 'SERVICE_UNAVAILABLE', 'The database is not configured.');
    return deps.withDatabase(c.env, async (db) => {
      const auth = await deps.authenticate(db, c.env, c.req.raw.headers);
      for (const cookie of auth.headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true });
      if (!auth.userId) fail(401, 'UNAUTHORIZED', 'Sign in to continue.');
      return handler(c, db, auth.userId);
    });
  };
}
export function parse<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
  try { return schema.parse(input); }
  catch { return fail(400, 'BAD_REQUEST', 'Invalid request fields or query parameters.'); }
}
export async function body<T>(c: RouteContext, schema: { parse: (input: unknown) => T }): Promise<T> {
  if (!c.req.header('content-type')?.includes('application/json')) fail(400, 'BAD_REQUEST', 'Send an application/json body.');
  let input: unknown;
  try { input = await c.req.json(); }
  catch { return fail(400, 'BAD_REQUEST', 'The request body must be valid JSON.'); }
  return parse(schema, input);
}
export const id = (c: RouteContext, name = 'id') => parse(resourceIdSchema, c.req.param(name));
export async function membership(db: QueryDatabase, workspaceId: string, userId: string) {
  const [member] = await db.select().from(workspaceMember).where(and(
    eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, userId),
  ));
  if (!member) fail(404, 'NOT_FOUND', 'Workspace not found.');
  return member;
}
// Serialize writes and member removal within each workspace. Call in a transaction.
export async function lockWorkspace(db: QueryDatabase, workspaceId: string, userId: string) {
  const [row] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).for('update');
  if (!row) fail(404, 'NOT_FOUND', 'Workspace not found.');
  return membership(db, workspaceId, userId);
}
export async function findCard(db: QueryDatabase, cardId: string, userId: string) {
  const [card] = await db.select().from(cardDefinition).where(eq(cardDefinition.id, cardId));
  if (!card) fail(404, 'NOT_FOUND', 'Card not found.');
  await membership(db, card.workspaceId, userId);
  if (card.askUserId !== userId && card.approveUserId !== userId) fail(404, 'NOT_FOUND', 'Card not found.');
  return card;
}
