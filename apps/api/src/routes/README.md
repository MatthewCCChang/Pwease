# API routes

All paths below are relative to `/api`. `app.ts` mounts routers by category:
`users.ts`, `workspaces.ts`, `cards.ts`, and `stamp-requests.ts`. Better Auth's
provider and session endpoints stay in `../auth/`, mounted at `/api/auth/*`.
The old `businessRoutes`, `/db/user`, and `/db/users` debug endpoints are removed.

## Setup and authentication

Apply the existing reviewed migration to a development database, then configure
DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL and Google credentials for Wrangler.
GOOGLE_WEB_CLIENT_ID is preferred; GOOGLE_CLIENT_ID is accepted as a fallback.
WEB_ORIGIN is the web frontend origin, with a localhost:8081 fallback outside
production. In production set it explicitly if serving a web frontend.
The Google callback is `${BETTER_AUTH_URL}/api/auth/callback/google`.

Better Auth now uses the Drizzle adapter, with a pool scoped to each request.
Previously issued stateless sessions may require a fresh sign-in. Apple login
configuration remains a separate task.

Every business endpoint verifies the Better Auth session. Browser requests must
include `credentials: 'include'`; native callers forward the session cookie from
`authClient.getCookie()`. Never send a user ID as a substitute for authentication.
Session-refresh cookies are forwarded to the client. Mutating browser requests
must originate from WEB_ORIGIN, and JSON inputs require Content-Type: application/json.
Only health and the login flow are publicly accessible.

## Endpoints

| Method | Path | Input / behavior |
| --- | --- | --- |
| GET | /me | Current database-backed profile |
| PATCH | /me | `{ "name": "Matthew" }`; does not change login email |
| GET | /workspaces | Workspaces the caller belongs to |
| POST | /workspaces | `{ "name": "Our workspace" }`; also creates OWNER membership |
| GET | /workspaces/:id | Workspace and caller's role |
| GET | /workspaces/:id/members | IDs, names, avatars and roles; no private emails |
| DELETE | /workspaces/:id/members/:userId | Leave, or owner removes another member; last owner cannot leave |
| GET | /workspaces/:id/stats | Caller-scoped pending incoming/outgoing, approved-request and card counts |
| GET | /workspaces/:id/cards | Active definitions involving the caller |
| POST | /workspaces/:id/cards | title, category, approveUserId, stampsNeeded, optional proofRequirement |
| PATCH | /cards/:id | Earning user edits title/category/proofRequirement or boolean archived |
| GET | /cards/:id/instances | Instances of a definition involving the caller |
| GET | /workspaces/:id/card-instances | Card history across definitions, including archived definitions |
| POST | /card-instances/:id/redeem | Earning user redeems a completed card; repeated redemption returns the same timestamp |
| GET | /workspaces/:id/requests | Incoming/outgoing requests involving the caller |
| POST | /cards/:id/requests | title, stampsRequested, optional proofText; participants inferred from the card |
| POST | /requests/:id/review | `{ "status": "APPROVED", "stampsAwarded": 3 }` or `{ "status": "REJECTED" }` |

List responses are arrays; single resources are objects. Review returns
`{ request, allocations }`. Workspace card history returns objects containing
`instance`, `askUserId` and `approveUserId`. Dates are ISO strings.

List routes accept `limit` (1–100, default 30) and `offset` (default 0).
Card/request lists support `category` and `role=all|requested|approved`.
Here `approved` means the caller is the designated approver; use
`status=APPROVED` on requests to select completed approvals. Request lists also
accept status=PENDING|APPROVED|REJECTED|CANCELLED. Instance lists accept
`state=all|in_progress|completed|redeemed`; completed includes redeemed cards.
Stats return actual counts; the UI should display `9+` when appropriate.

## Rules and scope

- Only the earning user creates requests or edits their definitions. The reviewer
  must be another current member. All resource access checks current membership.
- Card creation opens a zero-progress instance and snapshots its title/category/target.
  Definition edits affect future snapshots, not existing cards or requests.
- Reviews require the designated reviewer and an active earning member. Awards
  default to the requested amount and may be reduced, never increased. Quantities
  and targets are limited to 1–1000. Zero awards use rejection.
- Workspace mutations lock the workspace row in a transaction, serializing approvals
  with member removal. Reviews fill the open card, then batch-create overflow cards.
  Allocation, progress and decision commit together. Repeat reviews return 409.
- Archive blocks new requests; existing pending requests may still be reviewed.
- Text proof is enforced from the card's rule. PHOTO requests return a clear error
  until uploads exist; TEXT_OR_PHOTO currently requires text. Arbitrary photo keys
  are rejected. Existing proof keys are not exposed as public bucket URLs.
- Invitation creation/acceptance, photo uploads, cancellation, owner transfer and
  card proposals are not implemented. Joining a workspace still requires a seeded
  membership until the invite model is added. Creation POSTs are not retry-idempotent;
  do not automatically retry them after ambiguous network failures.

Errors use `{ error: { code, message } }` with 400/401/403/404/409/503 as appropriate.
Unexpected failures return a generic 500 without database details.

## Testing

Run `npm run test:api` from the repository root. PGlite tests apply the committed
PostgreSQL migration in memory and use real signed Better Auth sessions. They cover
access control, validation, history, overflow, duplicate review, redemption, member
removal and rollback. They do not contact Neon, exercise provider OAuth, or prove
multi-connection locking under the deployed Worker/Neon runtime. Test that integration
before production; PGlite serializes transactions on its single local connection.
