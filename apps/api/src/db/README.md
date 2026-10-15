# Pwease database schema

`schema.ts` defines tables; importing it does not create tables or connect to Neon.
The API now connects Better Auth to these tables through its Drizzle adapter.

## Identity

- `user`, `account`, `session`, and `verification` follow Better Auth's core schema.
- `user.name` is the original model's display-name `username`.
- `account.providerId` + `account.accountId` identify a Google or Apple account;
  `googleSub` is therefore not duplicated on `user`.
- Auth IDs are strings supplied by Better Auth. Pwease records use database-generated
  UUIDs. Dates are PostgreSQL timestamps with time zone.

## Pwease records

- `workspace` and `workspaceMember`: workspaces and unique user memberships.
- `cardDefinition`: reusable rules, earning user, approving user, category and target.
- `cardInstance`: one physical stamp card. Copy title, category and stampsNeeded
  from the definition on creation, so definition edits cannot rewrite its history.
  Only one incomplete instance is allowed per definition.
- `stampRequest`: the modal's own title and proof, requested amount, decision and
  awarded amount. Copy category and proofRequirement from the definition at submission.
  Its composite foreign key binds the workspace and both people to the definition.
- `stampAllocation`: replaces affectedInstances with request/card links and the
  number of stamps each card received. Both sides must use the same definition.
  Example: a five-stamp approval can allocate two stamps to finish one card and
  three to the next card.

Categories remain text identifiers such as `health`; color palettes are presentation
choices. No category, invitation or reward model has been added yet.

## Constraints and service responsibilities

The database requires positive stamp quantities, progress within each instance's
target, completion exactly when full, and redemption only after completion.
Only approved requests have a non-null positive stampsAwarded. Approved/rejected
requests need reviewedAt; pending/cancelled requests leave it null. CANCELLED
comes from the existing shared enum; cancellation behavior is not implemented.

The API routes enforce membership, permissions, proof text, snapshots, and atomic
stamp allocation. See [route documentation](../routes/README.md) for the implemented
rules and remaining limits. The full workflow requires:

- Active workspace membership, role permissions and owner-removal rules.
- Who may approve/redeem, self-approval policy and reviewer adjustment limits.
- Proof requirements when submitting; photo fields stay nullable so retention
  cleanup can remove proof without invalidating historical requests.
- Snapshot copying, preventing edits to historical snapshots, and preventing new
  requests against archived definitions.
- An atomic, retry-safe review transaction: lock/claim the pending request, allocate
  stamps across cards, mark filled cards complete, and save the approval together.
  Allocation sums must match the award and instance progress; row checks alone
  cannot enforce these cross-row totals.

Deleting referenced domain records is restricted to preserve history. Removing a
workspace membership does not delete cards or requests; the API must revoke access.
Deleting an entire workspace/user requires a deliberate cleanup/anonymization flow.
`updatedAt` hooks on auth tables run through Drizzle; they are not database triggers.

## Next integration steps

1. Review the existing migration in `apps/api/drizzle`. After future schema changes,
   generate another migration with `npm run db:generate --workspace=@pwease/api`.
2. Apply migrations to a development database once DATABASE_URL is available to
   Drizzle Kit. The current drizzle.config.ts does not load .env automatically.
3. Configure the Worker auth/database bindings and sign in again to establish a
   persisted session. Test concurrency against Neon before deploying the workflow.
