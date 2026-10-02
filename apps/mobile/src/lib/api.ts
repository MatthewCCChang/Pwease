import { apiErrorSchema, healthResponseSchema } from '@pwease/shared';
import type { z } from 'zod';
import { config } from '../config';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body);
      throw new ApiError(
        parsed.success ? parsed.data.error.message : `API request failed (${response.status}).`,
        response.status,
        parsed.success ? parsed.data.error.code : undefined,
      );
    }
    return schema.parse(body);
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('The API did not respond within 15 seconds. Try again.', 0, 'TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const getHealth = () => apiRequest('/api/health', healthResponseSchema);

// Future authenticated calls must attach Better Auth's session cookie here.
// This skeleton deliberately has no session, fake identity, or secret credentials.
