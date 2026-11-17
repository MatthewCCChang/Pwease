import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hono } from 'hono';
import { apiErrorSchema, healthResponseSchema } from '@pwease/shared';
import { app, handleError } from '../src/app';
import type { ApiEnvironment } from '../src/env';

test('health responds with the public contract without cloud credentials', async () => {
  const response = await app.request('/api/health', undefined, {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(healthResponseSchema.parse(await response.json()), {
    status: 'ok', service: 'pwease-api', version: '0.1.0',
  });
});

test('unknown endpoints return a JSON 404', async () => {
  const response = await app.request('/api/missing');
  assert.equal(response.status, 404);
  assert.equal(apiErrorSchema.parse(await response.json()).error.code, 'NOT_FOUND');
});

test('database readiness reports missing configuration without opening a connection', async () => {
  const response = await app.request('/api/db', undefined, {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(apiErrorSchema.parse(await response.json()).error.code, 'SERVICE_UNAVAILABLE');
});

test('profile requires a session and auth reports missing configuration', async () => {
  const profile = await app.request('/api/me', undefined, {});
  assert.equal(profile.status, 401);
  assert.equal(apiErrorSchema.parse(await profile.json()).error.code, 'UNAUTHORIZED');
  const auth = await app.request('/api/auth/get-session', undefined, {});
  assert.equal(auth.status, 503);
  assert.equal(apiErrorSchema.parse(await auth.json()).error.code, 'SERVICE_UNAVAILABLE');
});

test('unexpected failures return JSON without leaking server details', async () => {
  const failingRoutes = new Hono();
  failingRoutes.get('/throw', () => { throw new Error('sensitive internal detail'); });
  const testApp = new Hono<ApiEnvironment>();
  testApp.route('/', app);
  testApp.route('/test', failingRoutes);
  // Use the same registered error handler on an isolated app, without a debug route in production.
  testApp.onError(handleError);
  const response = await testApp.request('/test/throw');
  assert.equal(response.status, 500);
  const body = apiErrorSchema.parse(await response.json());
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(body).includes('sensitive internal detail'), false);
});
