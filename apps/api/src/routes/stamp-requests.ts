import { Hono } from 'hono';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { createStampRequestSchema, requestQuerySchema, reviewStampRequestSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { cardInstance, stampAllocation, stampRequest } from '../db/schema';
import { body, findCard, id, lockWorkspace, membership, parse, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

export function createStampRequestRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.get('/workspaces/:id/requests', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    await membership(db, workspaceId, userId);
    const query = parse(requestQuerySchema, c.req.query());
    const role = query.role === 'requested' ? eq(stampRequest.askUserId, userId)
      : query.role === 'approved' ? eq(stampRequest.reviewUserId, userId)
      : or(eq(stampRequest.askUserId, userId), eq(stampRequest.reviewUserId, userId));
    return c.json(await db.select().from(stampRequest).where(and(eq(stampRequest.workspaceId, workspaceId), role,
      query.category ? eq(stampRequest.category, query.category) : undefined,
      query.status ? eq(stampRequest.status, query.status) : undefined))
      .orderBy(desc(stampRequest.createdAt), stampRequest.id).limit(query.limit).offset(query.offset));
  }));
  routes.post('/cards/:id/requests', protectedHandler(deps, async (c, db, userId) => {
    const cardId = id(c);
    const input = await body(c, createStampRequestSchema);
    const card = await findCard(db, cardId, userId);
    const result = await db.transaction(async (tx) => {
      await lockWorkspace(tx, card.workspaceId, userId);
      const current = await findCard(tx, cardId, userId);
      if (current.askUserId !== userId) fail(403, 'FORBIDDEN', 'Only the earning user can request stamps.');
      if (current.approveUserId === userId) fail(403, 'FORBIDDEN', 'Self-approval is not allowed.');
      await membership(tx, current.workspaceId, current.approveUserId);
      if (current.archivedAt) fail(409, 'CONFLICT', 'This card is archived.');
      if (current.proofRequirement === 'PHOTO') fail(400, 'BAD_REQUEST', 'This card requires a photo; photo uploads are not implemented yet.');
      if (['TEXT', 'TEXT_OR_PHOTO'].includes(current.proofRequirement) && !input.proofText) fail(400, 'BAD_REQUEST', 'This card requires proof text.');
      const [created] = await tx.insert(stampRequest).values({ ...input,
        workspaceId: current.workspaceId, cardDefinitionId: current.id,
        askUserId: userId, reviewUserId: current.approveUserId,
        category: current.category, proofRequirement: current.proofRequirement,
      }).returning();
      return created;
    });
    return c.json(result, 201);
  }));
  routes.post('/requests/:id/review', protectedHandler(deps, async (c, db, userId) => {
    const requestId = id(c);
    const input = await body(c, reviewStampRequestSchema);
    const [request] = await db.select().from(stampRequest).where(eq(stampRequest.id, requestId));
    if (!request) fail(404, 'NOT_FOUND', 'Request not found.');
    await membership(db, request.workspaceId, userId);
    if (request.reviewUserId !== userId) fail(403, 'FORBIDDEN', 'Only the designated reviewer can review this request.');
    const result = await db.transaction(async (tx) => {
      await lockWorkspace(tx, request.workspaceId, userId);
      const [current] = await tx.select().from(stampRequest).where(eq(stampRequest.id, requestId)).for('update');
      if (!current) fail(404, 'NOT_FOUND', 'Request not found.');
      if (current.status !== 'PENDING') fail(409, 'CONFLICT', 'This request has already been reviewed.');
      if (current.askUserId === userId) fail(403, 'FORBIDDEN', 'Self-approval is not allowed.');
      await membership(tx, current.workspaceId, current.askUserId);
      const now = new Date();
      if (input.status === 'REJECTED') {
        const [updated] = await tx.update(stampRequest).set({ status: 'REJECTED', reviewedAt: now })
          .where(eq(stampRequest.id, requestId)).returning();
        return { request: updated, allocations: [] };
      }
      const award = input.stampsAwarded ?? current.stampsRequested;
      if (award > current.stampsRequested) fail(400, 'BAD_REQUEST', 'The award cannot exceed the requested amount.');
      const card = await findCard(tx, current.cardDefinitionId, userId);
      const [open] = await tx.select().from(cardInstance).where(and(
        eq(cardInstance.cardDefinitionId, card.id), isNull(cardInstance.completedAt),
      )).for('update');
      let remaining = award;
      const allocations: (typeof stampAllocation.$inferInsert)[] = [];
      if (open) {
        const applied = Math.min(remaining, open.stampsNeeded - open.currentStamps);
        const progress = open.currentStamps + applied;
        await tx.update(cardInstance).set({ currentStamps: progress, completedAt: progress === open.stampsNeeded ? now : null })
          .where(eq(cardInstance.id, open.id));
        allocations.push({ stampRequestId: requestId, cardInstanceId: open.id, cardDefinitionId: card.id, stampsAllocated: applied });
        remaining -= applied;
      }
      // Batch overflow cards instead of issuing a query for every individual stamp.
      const newCards: (typeof cardInstance.$inferInsert)[] = [];
      while (remaining > 0) {
        const applied = Math.min(remaining, card.stampsNeeded);
        const instanceId = crypto.randomUUID();
        newCards.push({ id: instanceId, cardDefinitionId: card.id, title: card.title,
          category: card.category, stampsNeeded: card.stampsNeeded, currentStamps: applied,
          createdAt: now, completedAt: applied === card.stampsNeeded ? now : null });
        allocations.push({ stampRequestId: requestId, cardInstanceId: instanceId, cardDefinitionId: card.id, stampsAllocated: applied });
        remaining -= applied;
      }
      if (newCards.length) await tx.insert(cardInstance).values(newCards);
      await tx.insert(stampAllocation).values(allocations);
      const [updated] = await tx.update(stampRequest).set({ status: 'APPROVED', stampsAwarded: award, reviewedAt: now })
        .where(eq(stampRequest.id, requestId)).returning();
      return { request: updated, allocations };
    });
    return c.json(result);
  }));
  return routes;
}
