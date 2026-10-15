# Insert test data directly

Run from the repository root. No API server, mobile app or session cookie is needed.
Use a development database with the existing migration applied. This bypasses API
authentication and workflow logic; PostgreSQL's constraints still apply.

## Start with the example

```powershell
# Validate the file without reading credentials or connecting to a database:
npm run db:insert --workspace=@pwease/api -- --file scripts/fixtures/example.json --dry-run

# Insert the sample rows into the configured database:
npm run db:insert --workspace=@pwease/api -- --file scripts/fixtures/example.json
```

The script uses DATABASE_URL from your shell if present. Otherwise it loads
`apps/api/.dev.vars` if that file exists, or `apps/api/.env`. It never prints the
connection string, auth tokens or full database errors. File paths passed to
`--file` are always relative to `apps/api` (absolute paths also work).

It prints inserted primary keys, including generated UUIDs. All tables in the
file are inserted in dependency order inside one transaction. Duplicate IDs or
emails fail the entire batch; nothing is silently updated or skipped. Re-running
the unchanged example therefore fails. There is no automatic deletion/reset.

## Insert into just one table

Copy/edit the example, or create `scripts/fixtures/users.local.json`:

```json
{
  "user": [
    { "id": "test-alice", "name": "Alice", "email": "alice@example.test" },
    { "id": "test-bob", "name": "Bob", "email": "bob@example.test" }
  ]
}
```

```powershell
npm run db:insert --workspace=@pwease/api -- --file scripts/fixtures/users.local.json
```

Or create `scripts/fixtures/workspace.local.json`:

```json
{ "workspace": [{ "name": "My test workspace" }] }
```

The UUID and createdAt are generated automatically. Use the printed workspace ID
in your next membership file. Personal `*.local.json` fixture files are ignored by Git.

## Table names and IDs

Use the TypeScript names from schema.ts, including camelCase column names:

| JSON table key | ID behavior / dependencies |
| --- | --- |
| user | Supply id, name and email; Better Auth is not generating IDs in this script |
| account | Supply id, userId, providerId and accountId; user must exist |
| session | Supply id, userId, token and expiresAt; user must exist |
| verification | Supply id, identifier, value and expiresAt |
| workspace | ID defaults to a random UUID |
| workspaceMember | Supply workspaceId and userId; these form its primary key |
| cardDefinition | UUID default; workspace and both users must exist |
| cardInstance | UUID default; definition must exist; supply title/category/target snapshots |
| stampRequest | UUID default; workspace/participants must match the definition |
| stampAllocation | Supply request/card/definition IDs and stampsAllocated |

The example demonstrates every table. Include only the table keys you need.
Use JSON numbers for quantities, booleans for flags, and ISO timestamps with a
timezone such as `2026-10-14T12:00:00Z` for dates. Omit fields with defaults;
explicit `null` is allowed only on nullable columns. Unknown fields are rejected.
Dry-run validates types/required fields; only a real insert checks database
uniqueness, foreign keys and SQL constraints.

## Important differences from using the API

- Inserts do not automatically create a membership, open card, session or allocation.
  Supply all related rows yourself. Database defaults only fill individual columns.
- Completed cards need matching currentStamps/stampsNeeded and completedAt; approved
  requests need stampsAwarded and reviewedAt. Keep allocation totals consistent
  with awards and card progress yourself. Cross-row totals are not SQL constraints.
- The sample account uses a fictional provider and does not enable Google login.
  The sample session and verification are deliberately expired. Creating a session
  row alone does not give you the signed cookie required for curl/browser login.
- To test real signed-in API requests with this data, sign in normally first, obtain
  your ID from `/api/me`, then insert memberships/cards referring to that ID. Do not
  reinsert your existing user or use your real login email for a separate fake user.
