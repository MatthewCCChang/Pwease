import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { and, eq } from 'drizzle-orm';
import { createApp } from '../src/app';
import type { Database } from '../src/db';
import * as schema from '../src/db/schema';
import { defaultDependencies } from '../src/routes/helpers';
import type { Bindings } from '../src/env';

const pg = new PGlite();
const db = drizzle(pg, { schema });
const env: Bindings = {
  APP_ENV: 'development', DATABASE_URL: 'unused-in-memory-test-database',
  BETTER_AUTH_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'route-tests-only-a-fixed-secret-not-used-in-production',
};
const app = createApp({
  ...defaultDependencies,
  withDatabase: async (_env, run) => run(db as unknown as Database),
});
const cookies: Record<string, string> = {};
before(async () => {
  await pg.exec(await readFile(new URL('../drizzle/0000_faithful_thunderbolt_ross.sql', import.meta.url), 'utf8'));
  for (const person of ['earner', 'reviewer', 'outsider', 'observer']) {
    await db.insert(schema.user).values({ id: person, name: person, email: `${person}@example.test` });
    const token = `test-session-${person}`;
    await db.insert(schema.session).values({ id: `session-${person}`, userId: person, token,
      createdAt: new Date(Date.now() - 3 * 86400000), updatedAt: new Date(Date.now() - 3 * 86400000),
      expiresAt: new Date(Date.now() + 86400000) });
    const signature = createHmac('sha256', env.BETTER_AUTH_SECRET!).update(token).digest('base64');
    cookies[person] = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
  }
});
after(() => pg.close());

function request(path: string, person = 'earner', method = 'GET', input?: unknown, extraHeaders: Record<string, string> = {}) {
  return app.request(`http://localhost:8787/api${path}`, {
    method, headers: { Cookie: cookies[person] ?? '', Origin: 'http://localhost:8081',
      ...(input === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  }, env);
}
async function workspace() {
  const response = await request('/workspaces', 'earner', 'POST', { name: 'Test workspace' });
  assert.equal(response.status, 201, await response.clone().text());
  const value = await response.json() as { id: string };
  await db.insert(schema.workspaceMember).values([
    { workspaceId: value.id, userId: 'reviewer' }, { workspaceId: value.id, userId: 'observer' },
  ]);
  return value.id;
}
async function card(workspaceId: string, proofRequirement = 'NONE', stampsNeeded = 5) {
  const response = await request(`/workspaces/${workspaceId}/cards`, 'earner', 'POST', {
    title: 'Exercise', category: 'health', approveUserId: 'reviewer', stampsNeeded, proofRequirement,
  });
  assert.equal(response.status, 201, await response.clone().text());
  return await response.json() as { id: string };
}
async function stamp(cardId: string, amount: number, proofText?: string) {
  const response = await request(`/cards/${cardId}/requests`, 'earner', 'POST', {
    title: 'Morning walk', stampsRequested: amount, ...(proofText ? { proofText } : {}),
  });
  assert.equal(response.status, 201, await response.clone().text());
  return await response.json() as { id: string };
}

test('real Better Auth session validation rejects forged cookies and refreshes valid ones', async () => {
  assert.equal((await request('/me', 'missing')).status, 401);
  assert.equal((await request('/me', 'earner', 'GET', undefined, { Cookie: 'better-auth.session_token=forged' })).status, 401);
  const response = await request('/me');
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { id: string }).id, 'earner');
  assert(response.headers.get('set-cookie'), 'Session refresh cookies must reach the client.');
});
test('profile is scoped to the caller; invalid fields, JSON and cross-origin writes are rejected', async () => {
  assert.equal((await request('/me', 'earner', 'PATCH', { name: 'Updated name' })).status, 200);
  assert.equal((await request('/me', 'earner', 'PATCH', { email: 'hijack@example.test' })).status, 400);
  assert.equal((await request('/me', 'earner', 'PATCH', { name: 'Hijack' }, { Origin: 'https://untrusted.example' })).status, 403);
  const invalid = await app.request('/api/me', { method: 'PATCH', headers: {
    Cookie: cookies.earner!, 'Content-Type': 'application/json', Origin: 'http://localhost:8081',
  }, body: '{broken' }, env);
  assert.equal(invalid.status, 400);
  assert.equal((await request('/db/users')).status, 404);
});
test('workspace boundaries, membership listing and last-owner protection', async () => {
  const workspaceId = await workspace();
  assert.equal((await request(`/workspaces/${workspaceId}`, 'outsider')).status, 404);
  assert.equal((await request(`/workspaces/${workspaceId}/members`, 'outsider')).status, 404);
  const members = await (await request(`/workspaces/${workspaceId}/members`)).json() as Record<string, unknown>[];
  assert.equal(members.length, 3);
  assert(members.every((member) => !('email' in member)));
  assert.equal((await request(`/workspaces/${workspaceId}/members/earner`, 'earner', 'DELETE')).status, 409);
  assert.equal((await request(`/workspaces/${workspaceId}/members/observer`, 'reviewer', 'DELETE')).status, 403);
  assert.equal((await request('/workspaces/not-a-uuid')).status, 400);
});
test('cards enforce participants, text proof, strict inputs and archival', async () => {
  const workspaceId = await workspace();
  const created = await card(workspaceId, 'TEXT');
  assert.equal((await request(`/cards/${created.id}/instances`, 'observer')).status, 404);
  assert.equal((await request(`/cards/${created.id}/requests`, 'earner', 'POST', { title: 'Walk', stampsRequested: 1 })).status, 400);
  await stamp(created.id, 1, 'Walked today');
  assert.equal((await request(`/cards/${created.id}/requests`, 'reviewer', 'POST', { title: 'Walk', stampsRequested: 1, proofText: 'Proof' })).status, 403);
  assert.equal((await request(`/cards/${created.id}/requests`, 'earner', 'POST', { title: 'Walk', stampsRequested: 1, photoKey: 'someone-elses-proof' })).status, 400);
  assert.equal((await request(`/cards/${created.id}`, 'reviewer', 'PATCH', { title: 'Changed' })).status, 403);
  assert.equal((await request(`/cards/${created.id}`, 'earner', 'PATCH', { archived: true })).status, 200);
  assert.equal((await request(`/cards/${created.id}/requests`, 'earner', 'POST', { title: 'Walk', stampsRequested: 1, proofText: 'Proof' })).status, 409);
  const photoCard = await card(workspaceId, 'PHOTO');
  assert.equal((await request(`/cards/${photoCard.id}/requests`, 'earner', 'POST', { title: 'Walk', stampsRequested: 1 })).status, 400);
  assert.equal((await request(`/workspaces/${workspaceId}/cards`, 'earner', 'POST', {
    title: 'Self', category: 'health', approveUserId: 'earner', stampsNeeded: 5,
  })).status, 400);
});
test('approval allocates overflow once, preserves snapshots, filters history and redeems once', async () => {
  const workspaceId = await workspace();
  const created = await card(workspaceId);
  const pending = await stamp(created.id, 12);
  assert.equal((await request(`/requests/${pending.id}/review`, 'earner', 'POST', { status: 'APPROVED' })).status, 403);
  assert.equal((await request(`/requests/${pending.id}/review`, 'reviewer', 'POST', { status: 'APPROVED', stampsAwarded: 13 })).status, 400);
  await request(`/cards/${created.id}`, 'earner', 'PATCH', { title: 'New title', category: 'fitness' });
  const reviews = await Promise.all([
    request(`/requests/${pending.id}/review`, 'reviewer', 'POST', { status: 'APPROVED' }),
    request(`/requests/${pending.id}/review`, 'reviewer', 'POST', { status: 'APPROVED' }),
  ]);
  assert.deepEqual(reviews.map((r) => r.status).sort(), [200, 409]);
  const instances = await db.select().from(schema.cardInstance).where(eq(schema.cardInstance.cardDefinitionId, created.id));
  assert.deepEqual(instances.map((row) => row.currentStamps).sort(), [2, 5, 5]);
  const allocations = await db.select().from(schema.stampAllocation).where(eq(schema.stampAllocation.stampRequestId, pending.id));
  assert.equal(allocations.reduce((sum, row) => sum + row.stampsAllocated, 0), 12);
  assert(instances.some((row) => row.title === 'Exercise' && row.category === 'health'));
  assert(instances.some((row) => row.title === 'New title' && row.category === 'fitness'));
  const completed = instances.find((row) => row.completedAt)!;
  const incomplete = instances.find((row) => !row.completedAt)!;
  assert.equal((await request(`/card-instances/${completed.id}/redeem`, 'reviewer', 'POST')).status, 403);
  assert.equal((await request(`/card-instances/${incomplete.id}/redeem`, 'earner', 'POST')).status, 409);
  const first = await (await request(`/card-instances/${completed.id}/redeem`, 'earner', 'POST')).json() as { redeemedAt: string };
  const second = await (await request(`/card-instances/${completed.id}/redeem`, 'earner', 'POST')).json() as { redeemedAt: string };
  assert.equal(first.redeemedAt, second.redeemedAt);
  const history = await (await request(`/workspaces/${workspaceId}/requests?role=approved&status=APPROVED&category=health`, 'reviewer')).json() as unknown[];
  assert.equal(history.length, 1);
  const cards = await (await request(`/workspaces/${workspaceId}/card-instances?state=completed&role=requested`)).json() as unknown[];
  assert.equal(cards.length, 2);
  const wrongRole = await (await request(`/cards/${created.id}/instances?role=approved`, 'earner')).json();
  assert.deepEqual(wrongRole, []);
  const page = await (await request(`/cards/${created.id}/instances?limit=1&offset=1`)).json() as unknown[];
  assert.equal(page.length, 1);
  const stats = await (await request(`/workspaces/${workspaceId}/stats`)).json();
  assert.deepEqual(stats, { pendingIncoming: 0, pendingOutgoing: 0, approvedRequests: 1, completedCards: 2, redeemedCards: 1, stampsEarned: 12 });
});
test('rejection awards no stamps and member removal revokes access without deleting history', async () => {
  const workspaceId = await workspace();
  const created = await card(workspaceId);
  const pending = await stamp(created.id, 2);
  assert.equal((await request(`/requests/${pending.id}/review`, 'reviewer', 'POST', { status: 'REJECTED' })).status, 200);
  assert.equal((await db.select().from(schema.stampAllocation).where(eq(schema.stampAllocation.stampRequestId, pending.id))).length, 0);
  const next = await stamp(created.id, 2);
  assert.equal((await request(`/workspaces/${workspaceId}/members/reviewer`, 'earner', 'DELETE')).status, 204);
  assert.equal((await request(`/requests/${next.id}/review`, 'reviewer', 'POST', { status: 'APPROVED' })).status, 404);
  assert.equal((await db.select().from(schema.stampRequest).where(and(eq(schema.stampRequest.id, next.id), eq(schema.stampRequest.status, 'PENDING')))).length, 1);
});
test('a failed allocation rolls back card progress and the request decision', async () => {
  const workspaceId = await workspace();
  const created = await card(workspaceId);
  const pending = await stamp(created.id, 7);
  await pg.exec(`CREATE FUNCTION reject_test_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'simulated failure'; END; $$;
    CREATE TRIGGER reject_test_allocation BEFORE INSERT ON stamp_allocation
    FOR EACH ROW EXECUTE FUNCTION reject_test_allocation();`);
  try {
    assert.equal((await request(`/requests/${pending.id}/review`, 'reviewer', 'POST', { status: 'APPROVED' })).status, 500);
    const [row] = await db.select().from(schema.stampRequest).where(eq(schema.stampRequest.id, pending.id));
    assert.equal(row?.status, 'PENDING');
    const instances = await db.select().from(schema.cardInstance).where(eq(schema.cardInstance.cardDefinitionId, created.id));
    assert.equal(instances.length, 1);
    assert.equal(instances[0]?.currentStamps, 0);
  } finally {
    await pg.exec('DROP TRIGGER reject_test_allocation ON stamp_allocation; DROP FUNCTION reject_test_allocation();');
  }
});

test('expired and revoked database sessions cannot access business endpoints', async () => {
  await db.update(schema.session).set({ expiresAt: new Date(Date.now() - 60000) }).where(eq(schema.session.userId, 'outsider'));
  assert.equal((await request('/me', 'outsider')).status, 401);
  await db.delete(schema.session).where(eq(schema.session.userId, 'observer'));
  assert.equal((await request('/me', 'observer')).status, 401);
});

test('auth routes renew a real session and logout invalidates its signed cookie', async () => {
  const person = 'logout-test';
  const token = 'logout-test-token';
  await db.insert(schema.user).values({ id: person, name: 'Logout Test', email: 'logout@example.test' });
  const oldExpiry = new Date(Date.now() + 86400000);
  await db.insert(schema.session).values({
    id: 'logout-test-session', userId: person, token,
    createdAt: new Date(Date.now() - 3 * 86400000),
    updatedAt: new Date(Date.now() - 3 * 86400000), expiresAt: oldExpiry,
  });
  const signature = createHmac('sha256', env.BETTER_AUTH_SECRET!).update(token).digest('base64');
  cookies[person] = 'better-auth.session_token=' + encodeURIComponent(token + '.' + signature);

  const current = await request('/auth/get-session', person);
  assert.equal(current.status, 200);
  const payload = await current.json() as { user: { id: string } };
  assert.equal(payload.user.id, person);
  assert(current.headers.get('set-cookie')?.includes('better-auth.session_token='));
  const [renewed] = await db.select().from(schema.session).where(eq(schema.session.token, token));
  assert(renewed!.expiresAt > oldExpiry);

  const forbidden = await request('/auth/sign-out', person, 'POST', {}, { Origin: 'https://untrusted.example' });
  assert.equal(forbidden.status, 403);
  assert.equal((await db.select().from(schema.session).where(eq(schema.session.token, token))).length, 1);

  const logout = await request('/auth/sign-out', person, 'POST', {});
  assert.equal(logout.status, 200);
  assert(logout.headers.get('set-cookie')?.includes('Max-Age=0'));
  assert.equal((await db.select().from(schema.session).where(eq(schema.session.token, token))).length, 0);
  assert.equal(await (await request('/auth/get-session', person)).json(), null);
  assert.equal((await request('/me', person)).status, 401);
  assert.equal((await db.select().from(schema.user).where(eq(schema.user.id, person))).length, 1);
});

test('auth session lookup rejects expired and unsigned fixture tokens', async () => {
  await db.insert(schema.session).values({
    id: 'expired-auth-test', userId: 'earner', token: 'expired-auth-test-token',
    expiresAt: new Date('2020-01-01T00:00:00Z'),
  });
  const token = 'expired-auth-test-token';
  const signature = createHmac('sha256', env.BETTER_AUTH_SECRET!).update(token).digest('base64');
  const expired = await request('/auth/get-session', 'earner', 'GET', undefined, {
    Cookie: 'better-auth.session_token=' + encodeURIComponent(token + '.' + signature),
  });
  assert.equal(await expired.json(), null);
  const unsigned = await request('/auth/get-session', 'earner', 'GET', undefined, {
    Cookie: 'better-auth.session_token=test-session-earner',
  });
  assert.equal(await unsigned.json(), null);
});
