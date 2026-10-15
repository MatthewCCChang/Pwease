import { Hono } from 'hono';
import { and, desc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { createCardSchema, historyQuerySchema, instanceQuerySchema, updateCardSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { cardDefinition, cardInstance } from '../db/schema';
import { body, findCard, id, lockWorkspace, membership, parse, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

export function createCardRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.get('/workspaces/:id/cards', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const query = parse(historyQuerySchema, c.req.query());
    await membership(db, workspaceId, userId);
    const role = query.role === 'requested' ? eq(cardDefinition.askUserId, userId)
      : query.role === 'approved' ? eq(cardDefinition.approveUserId, userId)
      : or(eq(cardDefinition.askUserId, userId), eq(cardDefinition.approveUserId, userId));
    return c.json(await db.select().from(cardDefinition).where(and(eq(cardDefinition.workspaceId, workspaceId), role,
      isNull(cardDefinition.archivedAt), query.category ? eq(cardDefinition.category, query.category) : undefined))
      .orderBy(desc(cardDefinition.createdAt), cardDefinition.id).limit(query.limit).offset(query.offset));
  }));
  routes.post('/workspaces/:id/cards', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const input = await body(c, createCardSchema);
    if (input.approveUserId === userId) fail(400, 'BAD_REQUEST', 'Choose another member to approve stamps.');
    const result = await db.transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId, userId);
      await membership(tx, workspaceId, input.approveUserId);
      const [created] = await tx.insert(cardDefinition).values({ ...input, workspaceId, askUserId: userId }).returning();
      if (!created) throw new Error('Card insert returned no row.');
      await tx.insert(cardInstance).values({ cardDefinitionId: created.id, title: created.title, category: created.category, stampsNeeded: created.stampsNeeded });
      return created;
    });
    return c.json(result, 201);
  }));
  routes.patch('/cards/:id', protectedHandler(deps, async (c, db, userId) => {
    const cardId = id(c);
    const input = await body(c, updateCardSchema);
    const card = await findCard(db, cardId, userId);
    const result = await db.transaction(async (tx) => {
      await lockWorkspace(tx, card.workspaceId, userId);
      const current = await findCard(tx, cardId, userId);
      if (current.askUserId !== userId) fail(403, 'FORBIDDEN', 'Only the earning user can edit this card.');
      const { archived, ...fields } = input;
      const [updated] = await tx.update(cardDefinition).set({ ...fields,
        ...(archived === undefined ? {} : { archivedAt: archived ? current.archivedAt ?? new Date() : null }),
      }).where(eq(cardDefinition.id, cardId)).returning();
      return updated;
    });
    return c.json(result);
  }));
  routes.get('/cards/:id/instances', protectedHandler(deps, async (c, db, userId) => {
    const cardId = id(c);
    const card = await findCard(db, cardId, userId);
    const query = parse(instanceQuerySchema, c.req.query());
    if ((query.role === 'requested' && card.askUserId !== userId)
      || (query.role === 'approved' && card.approveUserId !== userId)) return c.json([]);
    return c.json(await db.select().from(cardInstance).where(and(eq(cardInstance.cardDefinitionId, cardId),
      query.category ? eq(cardInstance.category, query.category) : undefined,
      query.state === 'completed' ? isNotNull(cardInstance.completedAt)
        : query.state === 'redeemed' ? isNotNull(cardInstance.redeemedAt)
        : query.state === 'in_progress' ? isNull(cardInstance.completedAt) : undefined))
      .orderBy(desc(cardInstance.createdAt), cardInstance.id).limit(query.limit).offset(query.offset));
  }));
  routes.get('/workspaces/:id/card-instances', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    await membership(db, workspaceId, userId);
    const query = parse(instanceQuerySchema, c.req.query());
    const role = query.role === 'requested' ? eq(cardDefinition.askUserId, userId)
      : query.role === 'approved' ? eq(cardDefinition.approveUserId, userId)
      : or(eq(cardDefinition.askUserId, userId), eq(cardDefinition.approveUserId, userId));
    return c.json(await db.select({ instance: cardInstance, askUserId: cardDefinition.askUserId, approveUserId: cardDefinition.approveUserId })
      .from(cardInstance).innerJoin(cardDefinition, eq(cardDefinition.id, cardInstance.cardDefinitionId))
      .where(and(eq(cardDefinition.workspaceId, workspaceId), role,
        query.category ? eq(cardInstance.category, query.category) : undefined,
        query.state === 'completed' ? isNotNull(cardInstance.completedAt)
          : query.state === 'redeemed' ? isNotNull(cardInstance.redeemedAt)
          : query.state === 'in_progress' ? isNull(cardInstance.completedAt) : undefined))
      .orderBy(desc(cardInstance.createdAt), cardInstance.id).limit(query.limit).offset(query.offset));
  }));
  routes.post('/card-instances/:id/redeem', protectedHandler(deps, async (c, db, userId) => {
    const instanceId = id(c);
    const [instance] = await db.select().from(cardInstance).where(eq(cardInstance.id, instanceId));
    if (!instance) fail(404, 'NOT_FOUND', 'Card instance not found.');
    const card = await findCard(db, instance.cardDefinitionId, userId);
    if (card.askUserId !== userId) fail(403, 'FORBIDDEN', 'Only the earning user can redeem this card.');
    const result = await db.transaction(async (tx) => {
      await lockWorkspace(tx, card.workspaceId, userId);
      const [current] = await tx.select().from(cardInstance).where(eq(cardInstance.id, instanceId)).for('update');
      if (!current?.completedAt) fail(409, 'CONFLICT', 'Complete the card before redeeming it.');
      if (current.redeemedAt) return current;
      const [updated] = await tx.update(cardInstance).set({ redeemedAt: new Date() }).where(eq(cardInstance.id, instanceId)).returning();
      return updated;
    });
    return c.json(result);
  }));
  return routes;
}
