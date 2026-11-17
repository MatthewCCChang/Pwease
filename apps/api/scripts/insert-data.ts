import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Database } from '../src/db';
import * as schema from '../src/db/schema';

// Explicit allowlist and parent-before-child order. JSON cannot select arbitrary
// SQL tables or execute raw SQL. Keys are the exports from schema.ts.
export const tables = {
  user: schema.user,
  account: schema.account,
  session: schema.session,
  verification: schema.verification,
  workspace: schema.workspace,
  workspaceMember: schema.workspaceMember,
  cardDefinition: schema.cardDefinition,
  cardInstance: schema.cardInstance,
  stampRequest: schema.stampRequest,
  stampAllocation: schema.stampAllocation,
};
type TableName = keyof typeof tables;
type Row = Record<string, unknown>;
export interface InsertBatch { table: TableName; rows: Row[] }

export class InsertInputError extends Error {}
function invalid(message: string): never { throw new InsertInputError(message); }
function isObject(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function prepareInserts(input: unknown): InsertBatch[] {
  if (!isObject(input) || !Object.keys(input).length) invalid('Supply an object mapping table names to arrays of rows.');
  for (const name of Object.keys(input)) {
    if (!Object.hasOwn(tables, name)) invalid(`Unknown table. Allowed tables: ${Object.keys(tables).join(', ')}.`);
  }
  const batches: InsertBatch[] = [];
  for (const tableName of Object.keys(tables) as TableName[]) {
    if (!Object.hasOwn(input, tableName)) continue;
    const supplied = input[tableName];
    if (!Array.isArray(supplied) || !supplied.length) invalid(`${tableName}: supply a nonempty array of rows.`);
    const columns = getTableColumns(tables[tableName]);
    const rows = supplied.map((source, rowIndex) => {
      const location = `${tableName}[${rowIndex}]`;
      if (!isObject(source)) invalid(`${location}: each row must be an object.`);
      const result: Row = {};
      for (const key of Object.keys(source)) {
        if (!Object.hasOwn(columns, key)) invalid(`${location}: unknown field; use the camelCase field names in schema.ts.`);
      }
      for (const [key, column] of Object.entries(columns)) {
        const value = source[key];
        const field = `${location}.${key}`;
        if (value === undefined) {
          if (column.notNull && !column.hasDefault) invalid(`${field} is required.`);
          continue; // Let PostgreSQL/Drizzle apply the declared default.
        }
        if (value === null) {
          if (column.notNull) invalid(`${field} cannot be null.`);
          result[key] = null;
          continue;
        }
        if (column.dataType === 'date') {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
            invalid(`${field} must be an ISO timestamp with a timezone.`);
          }
          const date = new Date(value);
          if (!Number.isFinite(date.getTime())) invalid(`${field} is not a valid timestamp.`);
          result[key] = date;
        } else if (column.dataType === 'number') {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
            invalid(`${field} must be a PostgreSQL integer.`);
          }
          result[key] = value;
        } else if (column.dataType === 'boolean') {
          if (typeof value !== 'boolean') invalid(`${field} must be true or false.`);
          result[key] = value;
        } else if (column.dataType === 'string') {
          if (typeof value !== 'string') invalid(`${field} must be a string.`);
          if (column.enumValues && !column.enumValues.includes(value)) invalid(`${field} must be one of: ${column.enumValues.join(', ')}.`);
          if (column.columnType === 'PgUUID' && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) invalid(`${field} must be a UUID.`);
          result[key] = value;
        } else {
          invalid(`${field} uses an unsupported column type.`);
        }
      }
      return result;
    });
    batches.push({ table: tableName, rows });
  }
  return batches;
}

export async function insertBatches(db: Database, batches: InsertBatch[]) {
  return db.transaction(async (tx) => {
    const results = [];
    for (const batch of batches) {
      const table: PgTable = tables[batch.table];
      const columns = getTableColumns(table);
      const keyNames = batch.table === 'workspaceMember' ? ['workspaceId', 'userId']
        : batch.table === 'stampAllocation' ? ['stampRequestId', 'cardInstanceId'] : ['id'];
      const keys = Object.fromEntries(keyNames.map((key) => [key, columns[key]!]));
      const inserted: Record<string, unknown>[] = [];
      // Chunk to stay below PostgreSQL's parameter limit. The entire file is
      // still one transaction: any failed row rolls everything back.
      for (let offset = 0; offset < batch.rows.length; offset += 100) {
        inserted.push(...await tx.insert(table).values(batch.rows.slice(offset, offset + 100)).returning(keys));
      }
      results.push({ table: batch.table, count: inserted.length, keys: inserted });
    }
    return results;
  });
}

// Never print raw driver errors: they may contain SQL values or credentials.
export function databaseErrorMessage(error: unknown): string {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const code = 'code' in current ? current.code : undefined;
    if (code === '23505') return 'Duplicate primary key or unique value. Change the fixture IDs/emails; no rows were committed.';
    if (code === '23503') return 'A referenced parent record is missing or inconsistent; no rows were committed.';
    if (code === '23514' || code === '23502') return 'A row violates a database constraint; no rows were committed.';
    if (code === '42P01') return 'A table is missing. Apply the schema migration first; no rows were committed.';
    current = 'cause' in current ? current.cause : undefined;
  }
  return 'Insert failed. Check database connectivity, configuration and row constraints. No automatic retries were attempted.';
}
