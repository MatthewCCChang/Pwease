import { z } from 'zod';

export const workspaceRoleSchema = z.enum(['OWNER', 'MEMBER']);
export const proofRequirementSchema = z.enum(['NONE', 'TEXT', 'PHOTO', 'TEXT_OR_PHOTO']);
export const stampRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export const cardDefinitionStatusSchema = z.enum(['PROPOSED', 'ACTIVE', 'DECLINED']);
export const historyRoleSchema = z.enum(['all', 'requested', 'approved']);
export const categoryColorKeySchema = z.enum(['sage', 'peach', 'lavender', 'blue', 'honey', 'rose']);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type ProofRequirement = z.infer<typeof proofRequirementSchema>;
export type StampRequestStatus = z.infer<typeof stampRequestStatusSchema>;
export type CardDefinitionStatus = z.infer<typeof cardDefinitionStatusSchema>;
export type HistoryRole = z.infer<typeof historyRoleSchema>;
export type CategoryColorKey = z.infer<typeof categoryColorKeySchema>;
