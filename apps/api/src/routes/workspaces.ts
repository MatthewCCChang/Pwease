import { Hono } from 'hono';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { createWorkspaceSchema, pageQuerySchema, userIdSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { workspace, workspaceMember, user, stampRequest, cardDefinition, cardInstance } from '../db/schema';
import { body, id, lockWorkspace, membership, parse, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

export function createWorkspaceRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.get('/workspaces', protectedHandler(deps, async (c, db, userId) => {
    const page = parse(pageQuerySchema, c.req.query());
    const rows = await db.select({ id: workspace.id, name: workspace.name, createdAt: workspace.createdAt, role: workspaceMember.role })
      .from(workspace).innerJoin(workspaceMember, eq(workspaceMember.workspaceId, workspace.id))
      .where(eq(workspaceMember.userId, userId)).orderBy(desc(workspace.createdAt), workspace.id).limit(page.limit).offset(page.offset);
    return c.json(rows);
  }));
  routes.post('/workspaces', protectedHandler(deps, async (c, db, userId) => {
    const input = await body(c, createWorkspaceSchema);
    const result = await db.transaction(async (tx) => {
      const [created] = await tx.insert(workspace).values(input).returning();
      if (!created) throw new Error('Workspace insert returned no row.');
      await tx.insert(workspaceMember).values({ workspaceId: created.id, userId, role: 'OWNER' });
      return created;
    });
    return c.json({ ...result, role: 'OWNER' as const }, 201);
  }));
  routes.get('/workspaces/:id', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const [row] = await db.select({
      id: workspace.id, name: workspace.name, createdAt: workspace.createdAt, role: workspaceMember.role,
    }).from(workspace).innerJoin(workspaceMember, and(
      eq(workspaceMember.workspaceId, workspace.id), eq(workspaceMember.userId, userId),
    )).where(eq(workspace.id, workspaceId));
    if (!row) fail(404, 'NOT_FOUND', 'Workspace not found.');
    return c.json(row);
  }));
  routes.get('/workspaces/:id/members', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const page = parse(pageQuerySchema, c.req.query());
    await membership(db, workspaceId, userId);
    return c.json(await db.select({ userId: user.id, name: user.name, image: user.image, role: workspaceMember.role, joinedAt: workspaceMember.joinedAt })
      .from(workspaceMember).innerJoin(user, eq(user.id, workspaceMember.userId))
      .where(eq(workspaceMember.workspaceId, workspaceId)).orderBy(workspaceMember.joinedAt, user.id).limit(page.limit).offset(page.offset));
  }));
  routes.delete('/workspaces/:id/members/:userId', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const targetId = parse(userIdSchema, c.req.param('userId'));
    await db.transaction(async (tx) => {
      const actor = await lockWorkspace(tx, workspaceId, userId);
      if (targetId !== userId && actor.role !== 'OWNER') fail(403, 'FORBIDDEN', 'Only owners can remove other members.');
      const target = await membership(tx, workspaceId, targetId);
      if (target.role === 'OWNER') {
        const owners = await tx.select().from(workspaceMember).where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.role, 'OWNER')));
        if (owners.length <= 1) fail(409, 'CONFLICT', 'The last owner cannot leave or be removed.');
      }
      await tx.delete(workspaceMember).where(and(eq(workspaceMember.workspaceId, workspaceId), eq(workspaceMember.userId, targetId)));
    });
    return c.body(null, 204);
  }));
  routes.get('/workspaces/:id/stats', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    await membership(db, workspaceId, userId);
    const [requests] = await db.select({
      pendingIncoming: sql<number>`count(*) filter (where ${stampRequest.status} = 'PENDING' and ${stampRequest.reviewUserId} = ${userId})`.mapWith(Number),
      pendingOutgoing: sql<number>`count(*) filter (where ${stampRequest.status} = 'PENDING' and ${stampRequest.askUserId} = ${userId})`.mapWith(Number),
      approvedRequests: sql<number>`count(*) filter (where ${stampRequest.status} = 'APPROVED')`.mapWith(Number),
    }).from(stampRequest).where(and(eq(stampRequest.workspaceId, workspaceId), or(eq(stampRequest.askUserId, userId), eq(stampRequest.reviewUserId, userId))));
    const [cards] = await db.select({
      completedCards: sql<number>`count(*) filter (where ${cardInstance.completedAt} is not null)`.mapWith(Number),
      redeemedCards: sql<number>`count(*) filter (where ${cardInstance.redeemedAt} is not null)`.mapWith(Number),
      stampsEarned: sql<number>`coalesce(sum(${cardInstance.currentStamps}) filter (where ${cardDefinition.askUserId} = ${userId}), 0)`.mapWith(Number),
    }).from(cardInstance).innerJoin(cardDefinition, eq(cardDefinition.id, cardInstance.cardDefinitionId))
      .where(and(eq(cardDefinition.workspaceId, workspaceId), or(eq(cardDefinition.askUserId, userId), eq(cardDefinition.approveUserId, userId))));
    return c.json({ ...requests, ...cards });
  }));
  return routes;
}
