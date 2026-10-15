import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withDatabase } from '../src/db';
import { databaseErrorMessage, InsertInputError, insertBatches, prepareInserts, tables } from './insert-data';

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

async function main() {
  if (args.includes('--help') || !args.length) {
    console.log('Usage: npm run db:insert --workspace=@pwease/api -- --file scripts/fixtures/example.json [--dry-run]');
    console.log('Paths are relative to apps/api. Supported tables:', Object.keys(tables).join(', '));
    console.log('Reads DATABASE_URL from the shell, or apps/api/.dev.vars (preferred) / .env.');
    console.log('Inserts all supplied rows in one transaction. It does not update, delete, or skip duplicates.');
    return;
  }
  let filename: string | undefined;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--file' && !filename && args[i + 1] && !args[i + 1]!.startsWith('--')) filename = args[++i];
    else throw new InsertInputError('Use --file <json-file> and optionally --dry-run.');
  }
  if (!filename) throw new InsertInputError('--file is required.');
  let contents: string;
  try { contents = await readFile(resolve(apiDirectory, filename), 'utf8'); }
  catch { throw new InsertInputError('Could not read the input file. Paths are relative to apps/api.'); }
  let input: unknown;
  try { input = JSON.parse(contents.replace(/^\uFEFF/, '')); }
  catch { throw new InsertInputError('The input file must contain valid JSON.'); }
  const batches = prepareInserts(input);
  if (dryRun) {
    console.log('Input valid:', JSON.stringify(batches.map(({ table, rows }) => ({ table, count: rows.length })), null, 2));
    console.log('Dry run: no database connection. Foreign keys, unique values and SQL checks are verified only during insertion.');
    return;
  }
  // Do not load environment files during a dry run. Shell configuration wins.
  if (!process.env.DATABASE_URL) {
    const devVars = resolve(apiDirectory, '.dev.vars');
    const envFile = existsSync(devVars) ? devVars : resolve(apiDirectory, '.env');
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
  if (!process.env.DATABASE_URL) throw new InsertInputError('Set DATABASE_URL in the shell or apps/api/.env / .dev.vars.');
  const results = await withDatabase({ DATABASE_URL: process.env.DATABASE_URL }, (db) => insertBatches(db, batches));
  console.log('Inserted successfully:', JSON.stringify(results, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof InsertInputError ? error.message : databaseErrorMessage(error));
  process.exitCode = 1;
});
