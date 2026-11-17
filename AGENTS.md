# AGENTS.md

## 1. Project Overview & Tech Stack
- **Purpose:** Pwease is a cat-themed stamp-card app for friends and families. Users share invitation-only workspaces, request stamps from designated reviewers, complete cards, and redeem completed cards.
- **Language & Runtime:** TypeScript 6 on Node.js 24 LTS. The project requires Node 24.x; do not bypass the root `engines` constraint.
- **Repository Model:** npm workspaces monorepo with `apps/*` and `packages/*`. Use npm and commit the root `package-lock.json` when dependencies change.
- **Mobile:** Expo SDK 57, Expo Router, React Native 0.86, React 19, TanStack Query, Reanimated, Gesture Handler, SVG, and SecureStore.
- **API:** Cloudflare Workers using Hono. Better Auth handles social identities and database-backed sessions. Authenticated business routes validate the session and workspace membership server-side.
- **Database & ORM:** Neon PostgreSQL with Drizzle ORM and Drizzle Kit migrations. API tests use an isolated PGlite database. Cloudflare R2 is reserved for future private proof-image storage.
- **Shared Contracts:** `@pwease/shared` contains client-safe Zod schemas and domain enums consumed by both the mobile app and API. Server-only database or authentication code must remain in `apps/api`.

## 2. Repository Map
- `apps/mobile/app/` — screens, workspace tabs, modal routes, and root navigation layouts.
- `apps/mobile/src/` — Reusable UI components and auth client
- `apps/api/src/` — API endpoints, backend logic
- `apps/api/drizzle/` — Generated, reviewable SQL migrations and Drizzle metadata. 
- `apps/api/test/` — Node test-runner suites using Hono requests and PGlite; tests do not require Neon or other cloud credentials.
- `apps/api/scripts/` — Direct test-data insertion utility, fixtures, and manual testing/setup guides.
- `packages/shared/src/` — Zod HTTP/request/response contracts and domain enums safe for both client and server bundles.

## 3. Essential Commands
Run these commands from the repository root to verify your work:
- **Install exact locked dependencies:** `npm ci`
- **Start the API on port 8787:** `npm run dev:api`
- **Start Expo/Metro for Expo Go:** `npm run dev:mobile`
- **Start the web preview:** `npm run dev:web`
- **Type-check every workspace:** `npm run typecheck`
- **Lint the repository:** `npm run lint`
- **Run all API tests:** `npm test`
- **Run one API test file:** `npm exec --workspace=@pwease/api -- node --import tsx --test test/routes.test.ts`
- **Check Expo dependency compatibility:** `npm run check:expo`
- **Export Android and iOS bundles:** `npm run bundle:mobile`
- **Dry-build the Cloudflare Worker:** `npm run build:api`
- **Generate a reviewed migration after an authorized schema change:** `npm run db:generate --workspace=@pwease/api`
- **Apply migrations to the configured database:** `npm run db:migrate --workspace=@pwease/api`

Run the API and mobile app in separate terminals during local development. Database commands require `DATABASE_URL`; they must never silently target production. Mobile configuration may contain only public `EXPO_PUBLIC_*` values, while Better Auth, provider, database, and R2 secrets remain in the API environment.

## 4. Coding Standards & Clean Code Practices
- **Strict Typing:** Never use `any` or suppress compiler errors with `@ts-ignore`. Define explicit interfaces for all inputs and outputs except for Zod schemas and Drizzle.
- **Function Design:** Keep functions small, pure where possible, and focused on a single responsibility. Use early returns instead of deeply nested `if/else` blocks.
- **Error Handling:** Handle errors explicitly at service boundaries. Never swallow exceptions with empty `catch` blocks.
- **Naming:** Use `camelCase` for variables/functions, `PascalCase` for types/classes/components, and `UPPER_SNAKE_CASE` for environment constants.
- **Dependencies:** Do not install new third-party packages without explicit approval. Prefer built-in standard library utilities first.

### Code Style Examples
**Good (Explicit types, early return, clear error handling):**
```typescript
export async function getUserById(id: string): Promise<User | null> {
  if (!id.trim()) {
    throw new ValidationError("User ID cannot be empty");
  }
  return await db.user.findUnique({ where: { id } });
}
```

**Bad (Implicit `any`, nested conditionals, silent failure):**
```typescript
export async function getUser(id: any) {
  try {
    if (id) {
      return await db.user.findUnique({ where: { id } });
    }
  } catch (e) {}
}
```

## 5. Testing & Definition of Done
- **Test-Driven Workflow:** Write or update unit tests for every bug fix and new feature before considering a task complete.
- **Verification Loop:** Before finishing any task, you must run `npm run typecheck`, `npm run lint`, and `npm run test` for changed features and confirm zero errors.
- **No Skipped Tests:** Never delete, skip (`.skip`), or weaken existing assertions to make a test suite pass.

## 6. Boundaries & Safety Rules
- **Always Do:**
  - Read existing files in the target directory to match local patterns before writing new code.
  - Ask clarifying questions if requirements or edge cases are ambiguous.
- **Ask First:**
  - Modifying database schemas or creating migrations.
  - Adding, upgrading, or removing dependencies in `package.json`.
  - Changing CI/CD workflows or environment variable configurations.
- **Never Do:**
  - Read, modify, or commit `.env` files, API keys, or secrets.
  - Force-push, amend published commits, or run `git commit` unless explicitly asked.
  - Edit generated files, build artifacts (`dist/`), or lockfiles manually.
