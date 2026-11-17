import { Platform } from 'react-native';
import { authClient } from './auth-client';
import { apiErrorSchema, healthResponseSchema } from '@pwease/shared';
import type { z } from 'zod';
import { config } from '../config';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, schema: z.ZodType<T>, options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(Platform.OS === 'web' ? {} : { Cookie: await authClient.getCookie() }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
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
    options.signal?.removeEventListener('abort', abort);
  }
}

export const getHealth = () => apiRequest('/api/health', healthResponseSchema);

