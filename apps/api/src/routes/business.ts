import { Hono } from 'hono';
import { apiErrorSchema } from '@pwease/shared';
import type { ApiEnvironment } from '../env';

export const businessRoutes = new Hono<ApiEnvironment>();

// A truthful placeholder, not mock user/workspace data or an authentication bypass.
businessRoutes.get('/me', (c) => c.json(apiErrorSchema.parse({
  error: { code: 'NOT_IMPLEMENTED', message: 'Profile and session integration is not implemented.' },
}), 501));

// Add workspace, category, card, request, and upload routers here in later milestones.
