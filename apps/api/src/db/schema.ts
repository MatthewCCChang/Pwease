import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, integer, pgEnum, pgTable,
  primaryKey, text, timestamp, unique, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import {
  proofRequirementSchema, stampRequestStatusSchema, workspaceRoleSchema,
} from '@pwease/shared';

// Keep PostgreSQL enum values aligned with the shared API contracts.
export const workspaceRole = pgEnum('workspace_role', workspaceRoleSchema.enum);
export const proofRequirement = pgEnum('proof_requirement', proofRequirementSchema.enum);
export const stampRequestStatus = pgEnum('stamp_request_status', stampRequestStatusSchema.enum);

const dateTime = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// Better Auth supplies string IDs. Keep its standard field names so the Drizzle
// adapter can use this schema without field mapping. `name` is the display name
// called `username` in the original model (not a unique login handle).
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  updatedAt: dateTime('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: dateTime('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  updatedAt: dateTime('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [index('session_user_idx').on(table.userId)]);

// Google sub (and Apple subject) lives in accountId, scoped by providerId.
// Provider tokens stay server-side; never return this table as a public profile.
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: dateTime('access_token_expires_at'),
  refreshTokenExpiresAt: dateTime('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  updatedAt: dateTime('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index('account_user_idx').on(table.userId),
  unique('account_provider_identity_unique').on(table.providerId, table.accountId),
]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: dateTime('expires_at').notNull(),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  updatedAt: dateTime('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [index('verification_identifier_idx').on(table.identifier)]);

export const workspace = pgTable('workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: dateTime('created_at').notNull().defaultNow(),
}, (table) => [check('workspace_name_nonempty', sql`length(trim(${table.name})) > 0`)]);

export const workspaceMember = pgTable('workspace_member', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'restrict' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  role: workspaceRole('role').notNull().default('MEMBER'),
  joinedAt: dateTime('joined_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
  index('workspace_member_user_idx').on(table.userId),
]);

// Archive definitions instead of deleting earned history. Membership is checked
// by the API; removing a member must not delete their past cards and requests.
export const cardDefinition = pgTable('card_definition', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'restrict' }),
  askUserId: text('ask_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  approveUserId: text('approve_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  category: text('category').notNull(),
  stampsNeeded: integer('stamps_needed').notNull(),
  proofRequirement: proofRequirement('proof_requirement').notNull().default('NONE'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  archivedAt: dateTime('archived_at'),
}, (table) => [
  index('card_definition_workspace_category_idx').on(table.workspaceId, table.category),
  index('card_definition_requester_idx').on(table.askUserId),
  index('card_definition_approver_idx').on(table.approveUserId),
  // Target for the request FK: workspace and participants cannot be mismatched.
  unique('card_definition_participants_unique').on(
    table.id, table.workspaceId, table.askUserId, table.approveUserId,
  ),
  check('card_definition_target_positive', sql`${table.stampsNeeded} > 0`),
  check('card_definition_title_nonempty', sql`length(trim(${table.title})) > 0`),
  check('card_definition_category_nonempty', sql`length(trim(${table.category})) > 0`),
  check('card_definition_archive_date', sql`${table.archivedAt} is null or ${table.archivedAt} >= ${table.createdAt}`),
]);

export const cardInstance = pgTable('card_instance', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardDefinitionId: uuid('card_definition_id').notNull().references(() => cardDefinition.id, { onDelete: 'restrict' }),
  // Copy these from the definition when opening an instance. Subsequent edits to
  // the definition must not change the target or appearance of historical cards.
  title: text('title').notNull(),
  category: text('category').notNull(),
  stampsNeeded: integer('stamps_needed').notNull(),
  currentStamps: integer('current_stamps').notNull().default(0),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  completedAt: dateTime('completed_at'),
  redeemedAt: dateTime('redeemed_at'),
}, (table) => [
  index('card_instance_definition_created_idx').on(table.cardDefinitionId, table.createdAt),
  unique('card_instance_definition_unique').on(table.id, table.cardDefinitionId),
  uniqueIndex('card_instance_one_open_per_definition').on(table.cardDefinitionId)
    .where(sql`${table.completedAt} is null`),
  check('card_instance_target_positive', sql`${table.stampsNeeded} > 0`),
  check('card_instance_progress_range', sql`${table.currentStamps} >= 0 and ${table.currentStamps} <= ${table.stampsNeeded}`),
  check('card_instance_completion_matches_progress', sql`
    (${table.completedAt} is null and ${table.currentStamps} < ${table.stampsNeeded}) or
    (${table.completedAt} is not null and ${table.currentStamps} = ${table.stampsNeeded})
  `),
  check('card_instance_completion_date', sql`${table.completedAt} is null or ${table.completedAt} >= ${table.createdAt}`),
  check('card_instance_redemption_requires_completion', sql`
    ${table.redeemedAt} is null or
    (${table.completedAt} is not null and ${table.redeemedAt} >= ${table.completedAt})
  `),
]);

export const stampRequest = pgTable('stamp_request', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  cardDefinitionId: uuid('card_definition_id').notNull(),
  askUserId: text('ask_user_id').notNull(),
  reviewUserId: text('review_user_id').notNull(),
  // The modal's request title is separate from the reusable card's title.
  title: text('title').notNull(),
  category: text('category').notNull(),
  proofRequirement: proofRequirement('proof_requirement').notNull().default('NONE'),
  stampsRequested: integer('stamps_requested').notNull(),
  stampsAwarded: integer('stamps_awarded'),
  proofText: text('proof_text'),
  photoKey: text('photo_key'),
  photoExpiresAt: dateTime('photo_expires_at'),
  status: stampRequestStatus('status').notNull().default('PENDING'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
  reviewedAt: dateTime('reviewed_at'),
}, (table) => [
  foreignKey({
    name: 'stamp_request_definition_participants_fk',
    columns: [table.cardDefinitionId, table.workspaceId, table.askUserId, table.reviewUserId],
    foreignColumns: [cardDefinition.id, cardDefinition.workspaceId, cardDefinition.askUserId, cardDefinition.approveUserId],
  }).onDelete('restrict'),
  unique('stamp_request_definition_unique').on(table.id, table.cardDefinitionId),
  index('stamp_request_incoming_idx').on(table.workspaceId, table.reviewUserId, table.status, table.createdAt),
  index('stamp_request_outgoing_idx').on(table.workspaceId, table.askUserId, table.status, table.createdAt),
  index('stamp_request_definition_idx').on(table.cardDefinitionId),
  index('stamp_request_photo_expiry_idx').on(table.photoExpiresAt).where(sql`${table.photoKey} is not null`),
  check('stamp_request_title_nonempty', sql`length(trim(${table.title})) > 0`),
  check('stamp_request_quantity_positive', sql`${table.stampsRequested} > 0`),
  // Only approved requests have an award. Adjustment limits belong to the API.
  check('stamp_request_award_matches_status', sql`
    (${table.status} = 'APPROVED' and ${table.stampsAwarded} is not null and ${table.stampsAwarded} > 0) or
    (${table.status} <> 'APPROVED' and ${table.stampsAwarded} is null)
  `),
  check('stamp_request_review_matches_status', sql`
    (${table.status} in ('APPROVED', 'REJECTED') and ${table.reviewedAt} is not null) or
    (${table.status} in ('PENDING', 'CANCELLED') and ${table.reviewedAt} is null)
  `),
  check('stamp_request_review_date', sql`${table.reviewedAt} is null or ${table.reviewedAt} >= ${table.createdAt}`),
]);

// Replaces affectedInstances JSON with an auditable allocation per request/card.
// One approval can fill the current card and carry over into additional cards.
export const stampAllocation = pgTable('stamp_allocation', {
  stampRequestId: uuid('stamp_request_id').notNull(),
  cardInstanceId: uuid('card_instance_id').notNull(),
  cardDefinitionId: uuid('card_definition_id').notNull(),
  stampsAllocated: integer('stamps_allocated').notNull(),
}, (table) => [
  primaryKey({ columns: [table.stampRequestId, table.cardInstanceId] }),
  foreignKey({
    name: 'stamp_allocation_request_definition_fk',
    columns: [table.stampRequestId, table.cardDefinitionId],
    foreignColumns: [stampRequest.id, stampRequest.cardDefinitionId],
  }).onDelete('restrict'),
  foreignKey({
    name: 'stamp_allocation_instance_definition_fk',
    columns: [table.cardInstanceId, table.cardDefinitionId],
    foreignColumns: [cardInstance.id, cardInstance.cardDefinitionId],
  }).onDelete('restrict'),
  index('stamp_allocation_instance_idx').on(table.cardInstanceId),
  check('stamp_allocation_quantity_positive', sql`${table.stampsAllocated} > 0`),
]);


export const workspaceInvite = pgTable('workspace_invite', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull().unique(),
  expiresAt: dateTime('expires_at').notNull(),
  usedAt: dateTime('used_at'),
  createdAt: dateTime('created_at').notNull().defaultNow(),
}, (table) => [index('workspace_invite_workspace_idx').on(table.workspaceId)]);
