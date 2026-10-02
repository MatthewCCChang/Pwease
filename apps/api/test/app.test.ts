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

test('auth and profile placeholders do not pretend to authenticate', async () => {
  for (const path of ['/api/auth/get-session', '/api/me']) {
    const response = await app.request(path);
    assert.equal(response.status, 501);
    assert.equal(apiErrorSchema.parse(await response.json()).error.code, 'NOT_IMPLEMENTED');
  }
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
