import { Hono } from 'hono';
import { and, desc, eq, isNotNull, isNull, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { createCardSchema, historyQuerySchema, instanceQuerySchema, updateCardSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import { cardDefinition, cardInstance } from '../db/schema';
import { body, findCard, id, lockWorkspace, membership, parse, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

type HistoryRole = ReturnType<typeof historyQuerySchema.parse>['role'];
type InstanceState = ReturnType<typeof instanceQuerySchema.parse>['state'];

function participationCondition(role: HistoryRole, userId: string): SQL {
  if (role === 'requested') return eq(cardDefinition.askUserId, userId);
  if (role === 'approved') return eq(cardDefinition.approveUserId, userId);
  return or(eq(cardDefinition.askUserId, userId), eq(cardDefinition.approveUserId, userId))!;
}

function instanceStateCondition(state: InstanceState): SQL | undefined {
  if (state === 'completed') return isNotNull(cardInstance.completedAt);
  if (state === 'redeemed') return isNotNull(cardInstance.redeemedAt);
  if (state === 'in_progress') return isNull(cardInstance.completedAt);
  return undefined;
}

function requireMutationRow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

export function createCardRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.get('/workspaces/:id/cards', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const query = parse(historyQuerySchema, c.req.query());
    await membership(db, workspaceId, userId);
    const cards = await db.select().from(cardDefinition).where(and(
      eq(cardDefinition.workspaceId, workspaceId), participationCondition(query.role, userId),
      isNull(cardDefinition.archivedAt),
      query.category ? eq(cardDefinition.category, query.category) : undefined,
    )).orderBy(desc(cardDefinition.createdAt), cardDefinition.id).limit(query.limit).offset(query.offset);
    return c.json(cards);
  }));
  routes.post('/workspaces/:id/cards', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const input = await body(c, createCardSchema);
    if (input.approveUserId === userId) fail(400, 'BAD_REQUEST', 'Choose another member to approve stamps.');
    const createdCard = await db.transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId, userId);
      await membership(tx, workspaceId, input.approveUserId);
      const createdCards = await tx.insert(cardDefinition)
        .values({ ...input, workspaceId, askUserId: userId }).returning();
      const card = requireMutationRow(createdCards, 'Card insert returned no row.');
      await tx.insert(cardInstance).values({
        cardDefinitionId: card.id, title: card.title,
        category: card.category, stampsNeeded: card.stampsNeeded,
      });
      return card;
    });
    return c.json(createdCard, 201);
  }));
  routes.patch('/cards/:id', protectedHandler(deps, async (c, db, userId) => {
    const cardId = id(c);
    const input = await body(c, updateCardSchema);
    const card = await findCard(db, cardId, userId);
    const updatedCard = await db.transaction(async (tx) => {
      await lockWorkspace(tx, card.workspaceId, userId);
      const currentCard = await findCard(tx, cardId, userId);
      if (currentCard.askUserId !== userId) fail(403, 'FORBIDDEN', 'Only the earning user can edit this card.');
      const { archived, ...fields } = input;
      const updatedCards = await tx.update(cardDefinition).set({ ...fields,
        ...(archived === undefined ? {} : { archivedAt: archived ? currentCard.archivedAt ?? new Date() : null }),
      }).where(eq(cardDefinition.id, cardId)).returning();
      return requireMutationRow(updatedCards, 'Card update returned no row.');
    });
    return c.json(updatedCard);
  }));
  routes.get('/cards/:id/instances', protectedHandler(deps, async (c, db, userId) => {
    const cardId = id(c);
    const card = await findCard(db, cardId, userId);
    const query = parse(instanceQuerySchema, c.req.query());
    const isRoleMismatch = (query.role === 'requested' && card.askUserId !== userId)
      || (query.role === 'approved' && card.approveUserId !== userId);
    if (isRoleMismatch) return c.json([]);
    const instances = await db.select().from(cardInstance).where(and(
      eq(cardInstance.cardDefinitionId, cardId),
      query.category ? eq(cardInstance.category, query.category) : undefined,
      instanceStateCondition(query.state),
    )).orderBy(desc(cardInstance.createdAt), cardInstance.id).limit(query.limit).offset(query.offset);
    return c.json(instances);
  }));
  routes.get('/workspaces/:id/card-instances', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    await membership(db, workspaceId, userId);
    const query = parse(instanceQuerySchema, c.req.query());
    const instances = await db.select({
      instance: cardInstance,
      askUserId: cardDefinition.askUserId,
      approveUserId: cardDefinition.approveUserId,
    })
      .from(cardInstance).innerJoin(cardDefinition, eq(cardDefinition.id, cardInstance.cardDefinitionId))
      .where(and(
        eq(cardDefinition.workspaceId, workspaceId), participationCondition(query.role, userId),
        query.category ? eq(cardInstance.category, query.category) : undefined,
        instanceStateCondition(query.state),
      )).orderBy(desc(cardInstance.createdAt), cardInstance.id).limit(query.limit).offset(query.offset);
    return c.json(instances);
  }));
  routes.post('/card-instances/:id/redeem', protectedHandler(deps, async (c, db, userId) => {
    const instanceId = id(c);
    const matchingInstances = await db.select().from(cardInstance).where(eq(cardInstance.id, instanceId));
    const instance = matchingInstances[0];
    if (!instance) fail(404, 'NOT_FOUND', 'Card instance not found.');
    const card = await findCard(db, instance.cardDefinitionId, userId);
    if (card.askUserId !== userId) fail(403, 'FORBIDDEN', 'Only the earning user can redeem this card.');
    const redeemedInstance = await db.transaction(async (tx) => {
      await lockWorkspace(tx, card.workspaceId, userId);
      const currentInstances = await tx.select().from(cardInstance)
        .where(eq(cardInstance.id, instanceId)).for('update');
      const currentInstance = currentInstances[0];
      if (!currentInstance?.completedAt) fail(409, 'CONFLICT', 'Complete the card before redeeming it.');
      if (currentInstance.redeemedAt) return currentInstance;
      const updatedInstances = await tx.update(cardInstance).set({ redeemedAt: new Date() })
        .where(eq(cardInstance.id, instanceId)).returning();
      return requireMutationRow(updatedInstances, 'Card redemption returned no row.');
    });
    return c.json(redeemedInstance);
  }));
  return routes;
}
