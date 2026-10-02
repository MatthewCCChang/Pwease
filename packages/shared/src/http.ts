import { z } from 'zod';

// Liveness only: does not claim that auth, Neon, or R2 are connected.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('pwease-api'),
  version: z.literal('0.1.0'),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(['NOT_FOUND', 'NOT_IMPLEMENTED', 'INTERNAL_ERROR']),
    message: z.string(),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;
