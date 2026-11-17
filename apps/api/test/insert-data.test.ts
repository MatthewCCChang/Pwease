import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import type { Database } from '../src/db';
import * as schema from '../src/db/schema';
import { databaseErrorMessage, insertBatches, prepareInserts } from '../scripts/insert-data';

const pg = new PGlite();
const db = drizzle(pg, { schema });
const insert = (input: unknown) => insertBatches(db as unknown as Database, prepareInserts(input));
before(async () => {
  await pg.exec(await readFile(new URL('../drizzle/0000_faithful_thunderbolt_ross.sql', import.meta.url), 'utf8'));
});
after(() => pg.close());

test('example inserts every table, regardless of JSON order, without exposing auth fields', async () => {
  const fixture = JSON.parse(await readFile(new URL('../scripts/fixtures/example.json', import.meta.url), 'utf8'));
  const results = await insert(Object.fromEntries(Object.entries(fixture).reverse()));
  assert.equal(results.length, 10);
  assert.equal(results.reduce((sum, result) => sum + result.count, 0), 15);
  const instances = await db.select().from(schema.cardInstance);
  assert.deepEqual(instances.map((row) => row.currentStamps).sort(), [2, 5]);
  const allocations = await db.select().from(schema.stampAllocation);
  assert.equal(allocations.reduce((sum, row) => sum + row.stampsAllocated, 0), 7);
  const output = JSON.stringify(results);
  assert(!output.includes('expired-example-not-a-login-cookie'));
  assert(!output.includes('earner@example.test'));
});
test('omitted fields receive database defaults and generated IDs are returned', async () => {
  const results = await insert({ workspace: [{ name: 'Generated workspace' }] });
  const createdId = results[0]?.keys[0]?.id;
  assert.equal(typeof createdId, 'string');
  const [created] = await db.select().from(schema.workspace).where(eq(schema.workspace.id, createdId as string));
  assert.equal(created?.name, 'Generated workspace');
  assert(created?.createdAt instanceof Date);
});
test('invalid table/field names, missing values and wrong types fail before connecting', () => {
  for (const input of [
    {}, { arbitraryTable: [{}] }, { user: [] }, { user: [{ id: 'x' }] },
    { workspace: [{ name: 'Test', arbitraryColumn: true }] },
    { workspace: [{ name: null }] }, { workspace: [{ name: 'Test', id: 'not-a-uuid' }] },
    { user: [{ id: 'x', name: 'Test', email: 'x@example.test', emailVerified: 'true' }] },
    { workspace: [{ name: 'Test', createdAt: 'not-a-date' }] },
    { workspaceMember: [{ workspaceId: '11111111-1111-4111-8111-111111111111', userId: 'x', role: 'ADMIN' }] },
  ]) assert.throws(() => prepareInserts(input));
});
test('foreign-key and uniqueness failures roll back all earlier inserts', async () => {
  await assert.rejects(insert({
    user: [{ id: 'rollback-user', name: 'Rollback', email: 'rollback@example.test' }],
    account: [{ id: 'missing-parent-account', userId: 'does-not-exist', providerId: 'test', accountId: 'x' }],
  }), (error) => databaseErrorMessage(error).includes('parent record'));
  assert.equal((await db.select().from(schema.user).where(eq(schema.user.id, 'rollback-user'))).length, 0);
  await assert.rejects(insert({ user: [
    { id: 'rollback-user', name: 'Rollback', email: 'rollback@example.test' },
    { id: 'manual-earner', name: 'Duplicate', email: 'duplicate@example.test' },
  ] }), (error) => databaseErrorMessage(error).includes('Duplicate'));
  assert.equal((await db.select().from(schema.user).where(eq(schema.user.id, 'rollback-user'))).length, 0);
});
test('SQL constraints still apply and errors never include raw SQL/credential text', async () => {
  await assert.rejects(insert({ workspace: [{ name: '' }] }),
    (error) => databaseErrorMessage(error).includes('constraint'));
  const secretError = new Error('postgres://user:secret@host/db; token=private');
  assert(!databaseErrorMessage(secretError).includes('secret'));
  assert(!databaseErrorMessage(secretError).includes('private'));
});
