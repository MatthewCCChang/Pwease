# Pwease

A mobile and serverless API **skeleton**, ready for small daily implementation steps.
The welcome screen, Home / Approved / Completed navigation, request modal, color
tokens, and API health check work without cloud credentials. Authentication,
database tables, stamp workflows, uploads, and production artwork are **not implemented**.

## Requirements

- Node **24.x LTS** (the project pins 24.21.0 in `.nvmrc`).
- npm bundled with Node 24.
- For device testing later: an Expo development build on Android/iOS. Native build
  tools and signing credentials are not required to type-check or export bundles.

The existing system Node 20 is too old for this toolchain. Do not bypass the engine check.

### Windows: project-local Node

From the project root in PowerShell:

```powershell
# Downloads the official Windows x64 archive and verifies its published SHA-256.
# Run only if .tools does not already contain the pinned version.
./scripts/setup-node.ps1

# Run this in EACH new PowerShell terminal. It changes PATH for that terminal only.
. ./scripts/use-node.ps1
node --version
npm ci
```

`.tools` is ignored by Git. The helper does not replace your global Node installation.
If script execution is restricted, use an approved execution policy or a system
Node 24 installation. For macOS/Linux, use the version in `.nvmrc` with your Node
version manager, then run `npm ci`.

## Run locally

Start the API in one terminal:

```powershell
. ./scripts/use-node.ps1
npm run dev:api
```

Wrangler serves the API on port **8787**, including your LAN interface for phone
testing. It uses local mode; no Cloudflare account, Neon database, or R2 bucket is
required. Access it only on a trusted development network.

```powershell
Invoke-RestMethod http://localhost:8787/api/health
```

Expected JSON:

```json
{ "status": "ok", "service": "pwease-api", "version": "0.1.0" }
```

Start Metro in another terminal:

```powershell
. ./scripts/use-node.ps1
Copy-Item apps/mobile/.env.example apps/mobile/.env
# Edit EXPO_PUBLIC_API_URL for your device as described below.
npm run dev:mobile
```

The default command targets **Expo Go** so the credential-free shell can be
previewed without provisioning a development build. Use an Expo Go version that
supports this project's SDK. This command does not build or install a native app.
For a previously installed development client, run
`npm run start:client --workspace=@pwease/mobile` instead. Provider authentication
will require development builds in a later milestone.

### Browser preview and startup troubleshooting

From the repository root, run `npm run dev:web` for a browser preview, or run
`npm run dev:mobile` and press `w`. Both commands start Expo in `apps/mobile`.
You do not need to change directories yourself or add a Metro config.
The web dependencies live in the mobile workspace, with React and React DOM pinned
to the same Expo-compatible version.

If the browser reports `Unable to resolve "../../App"` from `expo/AppEntry.js`,
check which server URL it opened. This app uses `expo-router/entry`, not the default
Expo `AppEntry`. Stop any old Expo process started at the repository root with
Ctrl+C in its terminal, then start the mobile command and open the URL it prints.
Do not run bare `npx expo start` from the repository root or create an `App.tsx`
there to mask the error. A stale browser tab can still point to the wrong server.

To explicitly choose a free port and clear Metro's cache from the root:

```powershell
npm run start --workspace=@pwease/mobile -- --clear --port 8082
```

Then press `w` or open `http://localhost:8082`. The standard config filename, if
custom configuration is ever needed, is `metro.config.js`, not `metro.xonfig.js`.

The mobile app starts even when the API is not running. Use **Explore the skeleton**
to navigate without signing in. **Check API connection** on Home makes an explicit
request with a 15-second timeout and no automatic retries. All business actions
are visibly disabled or labeled as not implemented.

### Mobile API address

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`:

| Client | API URL |
| --- | --- |
| iOS simulator on a Mac | `http://localhost:8787` |
| Android Studio emulator | `http://10.0.2.2:8787` |
| Physical phone | `http://YOUR_COMPUTER_LAN_IP:8787` |

On Windows use `ipconfig` to find the active adapter's IPv4 address. Keep phone and
computer on the same network and allow Node/Wrangler through the firewall on that
trusted private network if prompted. `localhost` on a phone means the phone itself.
An Expo tunnel tunnels Metro, **not** the API. Reload the app after changing its URL.
Use an HTTPS API for release builds; device cleartext policies may also require an
HTTPS development endpoint. Never commit a machine-specific IP as the default.

## Project layout

```text
apps/
  mobile/
    app/                    Expo Router screens and top tabs
    src/components/         Shared UI and static cat/yarn placeholder
    src/lib/api.ts          Typed API client; no credentials yet
    src/providers.tsx       TanStack Query provider
    src/theme.ts            Ivory/terracotta tokens and six palettes
    app.config.ts           Expo native plugins and placeholder app identifiers
    eas.json                Development, preview, and production profiles
  api/
    src/auth/               Explicit 501 boundary for future Better Auth
    src/db/                 Lazy request-scoped Neon helper; empty schema
    src/storage/            Future private R2 binding boundary
    src/routes/             Health and future business routers
    test/                   API contract and failure smoke tests
    drizzle.config.ts       Migration tooling only; no migrations exist
    wrangler.jsonc          Local Worker configuration
packages/
  shared/src/               Client-safe Zod contracts and domain enums
scripts/                    Optional Windows Node helpers
```

The shared package intentionally exports TypeScript source: Metro, Wrangler, and
the test loader compile it. Do not import `apps/api` from the mobile app or shared
package. There are no copied server environment variables in the Expo config.

## Configuration boundaries

| File / setting | Purpose |
| --- | --- |
| `apps/mobile/.env.example` | Public API URL only; bundled into the app |
| `apps/api/.dev.vars.example` | Future Worker runtime secrets and provider configuration |
| `apps/api/.env.example` | Documents the database URL needed by the Drizzle CLI |
| `PROOF_IMAGES` in Wrangler | Future private R2 bucket binding; no access keys in the app |

All real `.env` and `.dev.vars` files are ignored. Keep credentials server-side;
`EXPO_PUBLIC_*` values are public by definition. Better Auth is an integration
boundary only: this skeleton does not configure it, persist sessions, or generate
its tables. SecureStore's native plugin is configured but no credentials are saved.

The database helper connects only when called and closes the pool after that
request. No current endpoint calls it. The Drizzle schema is empty: **do not run
migrations yet**. When tables are intentionally added, pass the connection string
through the terminal environment; the CLI does not automatically load the example:

```powershell
# Set DATABASE_URL locally through your preferred secret-management method.
npm run db:generate --workspace=@pwease/api
npm run db:migrate --workspace=@pwease/api
```

The health endpoint is liveness only, not proof of database/auth/storage readiness.
Unknown routes return a JSON 404. `/api/me` and `/api/auth/*` return a JSON 501;
neither endpoint provides fake authentication or account data. Unexpected errors
return a generic JSON 500 without exposing exception details.

## Verify the skeleton

```powershell
npm run typecheck
npm run lint
npm run test:api
npm run check:expo
npm run bundle:mobile
npm run build:api
```

- `test:api`: in-process Hono smoke tests; no cloud account or network needed.
- `check:expo`: checks installed native dependency versions against the Expo SDK.
- `bundle:mobile`: exports **both iOS and Android** Metro bundles, not signed binaries.
- `build:api`: Wrangler dry run; creates local output without deploying anything.

Exports, Worker state, package caches, and local Node binaries are ignored.
Do not treat successful bundling as physical-device or OAuth validation.

## Next small milestones

1. Choose permanent native app identifiers, link an EAS project, and create development builds.
2. Implement Better Auth, Google/Apple configuration, and SecureStore-backed sessions.
3. Add reviewed Drizzle tables and migrations for workspaces and card proposals.
4. Implement transaction-safe stamp allocation and participant authorization.
5. Build the selected screens and illustration assets, followed by private proof uploads.

The selected visual direction is A + D1, E1, F1, G2 with G1's outside photo label,
H1, I1, and J2's diagonal treatment with J3's REDEEMED stamp. The static cat/yarn
component is only a placeholder for the future layered, reduced-motion-aware loader.

No provisioning, sign-in, migration, image generation, or deployment is performed
by the default development commands.
