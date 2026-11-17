import { Hono } from 'hono';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { createStampRequestSchema, requestQuerySchema, reviewStampRequestSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';
import type { Database, Transaction } from '../db';
import { cardInstance, stampAllocation, stampRequest } from '../db/schema';
import { body, findCard, id, lockWorkspace, membership, parse, protectedHandler } from './helpers';
import type { RouteDependencies } from './helpers';
import { fail } from './errors';

type StampRequestRow = typeof stampRequest.$inferSelect;
type StampAllocationInsert = typeof stampAllocation.$inferInsert;
type ReviewInput = ReturnType<typeof reviewStampRequestSchema.parse>;
type Card = Awaited<ReturnType<typeof findCard>>;

interface ReviewResult {
  request: StampRequestRow;
  allocations: StampAllocationInsert[];
}

function requireRequest(rows: StampRequestRow[]): StampRequestRow {
  const request = rows[0];
  if (!request) fail(404, 'NOT_FOUND', 'Request not found.');
  return request;
}

function requireUpdatedRequest(rows: StampRequestRow[]): StampRequestRow {
  const request = rows[0];
  if (!request) throw new Error('Stamp request mutation returned no row.');
  return request;
}

async function allocateStamps(
  tx: Transaction,
  requestId: string,
  card: Card,
  stampsAwarded: number,
  reviewedAt: Date,
): Promise<StampAllocationInsert[]> {
  const openCards = await tx.select().from(cardInstance).where(and(
    eq(cardInstance.cardDefinitionId, card.id), isNull(cardInstance.completedAt),
  )).for('update');
  const openCard = openCards[0];
  let remaining = stampsAwarded;
  const allocations: StampAllocationInsert[] = [];

  if (openCard) {
    const applied = Math.min(remaining, openCard.stampsNeeded - openCard.currentStamps);
    const progress = openCard.currentStamps + applied;
    await tx.update(cardInstance).set({
      currentStamps: progress,
      completedAt: progress === openCard.stampsNeeded ? reviewedAt : null,
    }).where(eq(cardInstance.id, openCard.id));
    allocations.push({
      stampRequestId: requestId, cardInstanceId: openCard.id,
      cardDefinitionId: card.id, stampsAllocated: applied,
    });
    remaining -= applied;
  }

  // Batch overflow cards instead of issuing a query for every individual stamp.
  const newCards: (typeof cardInstance.$inferInsert)[] = [];
  while (remaining > 0) {
    const applied = Math.min(remaining, card.stampsNeeded);
    const instanceId = crypto.randomUUID();
    newCards.push({
      id: instanceId, cardDefinitionId: card.id, title: card.title,
      category: card.category, stampsNeeded: card.stampsNeeded, currentStamps: applied,
      createdAt: reviewedAt, completedAt: applied === card.stampsNeeded ? reviewedAt : null,
    });
    allocations.push({
      stampRequestId: requestId, cardInstanceId: instanceId,
      cardDefinitionId: card.id, stampsAllocated: applied,
    });
    remaining -= applied;
  }

  if (newCards.length) await tx.insert(cardInstance).values(newCards);
  await tx.insert(stampAllocation).values(allocations);
  return allocations;
}

async function completeReview(
  tx: Transaction,
  request: StampRequestRow,
  requestId: string,
  userId: string,
  input: ReviewInput,
): Promise<ReviewResult> {
  const workspaceMembership = await lockWorkspace(tx, request.workspaceId, userId);
  const matchingRequests = await tx.select().from(stampRequest)
    .where(eq(stampRequest.id, requestId)).for('update');
  const currentRequest = requireRequest(matchingRequests);

  if (currentRequest.status !== 'PENDING') fail(409, 'CONFLICT', 'This request has already been reviewed.');
  if (currentRequest.askUserId === userId) fail(403, 'FORBIDDEN', 'Self-approval is not allowed.');
  await membership(tx, workspaceMembership.workspaceId, currentRequest.askUserId);

  const reviewedAt = new Date();
  if (input.status === 'REJECTED') {
    const rejectedRequests = await tx.update(stampRequest).set({ status: 'REJECTED', reviewedAt })
      .where(eq(stampRequest.id, requestId)).returning();
    return { request: requireUpdatedRequest(rejectedRequests), allocations: [] };
  }

  const stampsAwarded = input.stampsAwarded ?? currentRequest.stampsRequested;
  if (stampsAwarded > currentRequest.stampsRequested) {
    fail(400, 'BAD_REQUEST', 'The award cannot exceed the requested amount.');
  }
  const card = await findCard(tx, currentRequest.cardDefinitionId, userId);
  const allocations = await allocateStamps(tx, requestId, card, stampsAwarded, reviewedAt);
  const approvedRequests = await tx.update(stampRequest).set({
    status: 'APPROVED', stampsAwarded, reviewedAt,
  }).where(eq(stampRequest.id, requestId)).returning();
  return { request: requireUpdatedRequest(approvedRequests), allocations };
}

async function reviewRequest(
  db: Database,
  requestId: string,
  userId: string,
  input: ReviewInput,
): Promise<ReviewResult> {
  const matchingRequests = await db.select().from(stampRequest).where(eq(stampRequest.id, requestId));
  const request = requireRequest(matchingRequests);
  const reviewerMembership = await membership(db, request.workspaceId, userId);
  if (request.reviewUserId !== reviewerMembership.userId) {
    fail(403, 'FORBIDDEN', 'Only the designated reviewer can review this request.');
  }
  return db.transaction((tx) => completeReview(tx, request, requestId, userId, input));
}

export function createStampRequestRoutes(deps: RouteDependencies) {
  const routes = new Hono<ApiEnvironment>();
  routes.get('/workspaces/:id/requests', protectedHandler(deps, async (c, db, userId) => {
    const workspaceId = id(c);
    const workspaceMembership = await membership(db, workspaceId, userId);
    const query = parse(requestQuerySchema, c.req.query());
    const userParticipationCondition = query.role === 'requested' ? eq(stampRequest.askUserId, userId)
      : query.role === 'approved' ? eq(stampRequest.reviewUserId, userId)
      : or(eq(stampRequest.askUserId, userId), eq(stampRequest.reviewUserId, userId));
    const requests = await db.select().from(stampRequest).where(and(
      eq(stampRequest.workspaceId, workspaceMembership.workspaceId), userParticipationCondition,
      query.category ? eq(stampRequest.category, query.category) : undefined,
      query.status ? eq(stampRequest.status, query.status) : undefined))
      .orderBy(desc(stampRequest.createdAt), stampRequest.id).limit(query.limit).offset(query.offset);
    return c.json(requests);
  }));
  routes.post('/cards/:id/requests', protectedHandler(deps, async (c, db, userId) => {
    const cardId = id(c);
    const input = await body(c, createStampRequestSchema);
    const card = await findCard(db, cardId, userId);
    const createdRequest = await db.transaction(async (tx) => {
      const workspaceMembership = await lockWorkspace(tx, card.workspaceId, userId);
      const currentCard = await findCard(tx, cardId, userId);
      if (currentCard.askUserId !== userId) fail(403, 'FORBIDDEN', 'Only the earning user can request stamps.');
      if (currentCard.approveUserId === userId) fail(403, 'FORBIDDEN', 'Self-approval is not allowed.');
      const reviewerMembership = await membership(tx, workspaceMembership.workspaceId, currentCard.approveUserId);
      if (currentCard.archivedAt) fail(409, 'CONFLICT', 'This card is archived.');
      if (currentCard.proofRequirement === 'PHOTO') {
        fail(400, 'BAD_REQUEST', 'This card requires a photo; photo uploads are not implemented yet.');
      }
      const isProofTextRequired = ['TEXT', 'TEXT_OR_PHOTO'].includes(currentCard.proofRequirement);
      if (isProofTextRequired && !input.proofText) fail(400, 'BAD_REQUEST', 'This card requires proof text.');
      const createdRequests = await tx.insert(stampRequest).values({ ...input,
        workspaceId: currentCard.workspaceId, cardDefinitionId: currentCard.id,
        askUserId: userId, reviewUserId: reviewerMembership.userId,
        category: currentCard.category, proofRequirement: currentCard.proofRequirement,
      }).returning();
      return requireUpdatedRequest(createdRequests);
    });
    return c.json(createdRequest, 201);
  }));
  routes.post('/requests/:id/review', protectedHandler(deps, async (c, db, userId) => {
    const requestId = id(c);
    const input = await body(c, reviewStampRequestSchema);
    const reviewResult = await reviewRequest(db, requestId, userId, input);
    return c.json(reviewResult);
  }));
  return routes;
}
