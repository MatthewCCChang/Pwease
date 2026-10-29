import { z } from 'zod';
import { proofRequirementSchema, stampRequestStatusSchema, historyRoleSchema } from './domain';
const title = z.string().trim().min(1).max(120);
const category = z.string().trim().min(1).max(60);
export const resourceIdSchema = z.uuid();
export const userIdSchema = z.string().trim().min(1).max(128);
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export const historyQuerySchema = pageQuerySchema.extend({ category: category.optional(), role: historyRoleSchema.default('all') });
export const requestQuerySchema = historyQuerySchema.extend({ status: stampRequestStatusSchema.optional() });
export const instanceQuerySchema = historyQuerySchema.extend({ state: z.enum(['all', 'in_progress', 'completed', 'redeemed']).default('all') });
export const updateProfileSchema = z.object({ name: title }).strict();
export const createWorkspaceSchema = z.object({ name: title }).strict();
export const createCardSchema = z.object({
  title, category, approveUserId: userIdSchema,
  stampsNeeded: z.number().int().min(1).max(1000),
  proofRequirement: proofRequirementSchema.default('NONE'),
}).strict();
export const updateCardSchema = z.object({
  title: title.optional(), category: category.optional(),
  proofRequirement: proofRequirementSchema.optional(), archived: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
// Uploads are not implemented; arbitrary bucket keys are not accepted.
export const createStampRequestSchema = z.object({
  title, stampsRequested: z.number().int().min(1).max(1000),
  proofText: z.string().trim().max(4000).optional(),
}).strict();
export const reviewStampRequestSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('APPROVED'), stampsAwarded: z.number().int().min(1).max(1000).optional() }).strict(),
  z.object({ status: z.literal('REJECTED') }).strict(),
]);

export const createInviteSchema = z.object({ workspaceId: resourceIdSchema }).strict();
export const inviteCodeSchema = z.string().trim().toLowerCase().regex(/^[0-9a-f]{32}$/);
export const workspaceResponseSchema = z.object({
  id: resourceIdSchema, name: z.string(), createdAt: z.string(),
  role: z.enum(['OWNER', 'MEMBER']),
});
export const workspaceListSchema = z.array(workspaceResponseSchema);
export const inviteResponseSchema = z.object({ code: inviteCodeSchema, expiresAt: z.string() });
