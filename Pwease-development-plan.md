# Pwease: development schedule and installation checklist

Prepared October 1, 2026. Project: `C:\Users\matthew\Desktop\Work\Work\Project\Pwease`.

## Starting point

The skeleton is implemented: Expo/React Native/Router mobile routes, theme tokens, shared Zod contracts, Hono Worker health endpoint, and boundaries for authentication, database, and storage. Login, real data, stamp operations, image uploads, and the final animation do not exist yet. No cloud resources have been provisioned or deployed.

The implementation session passed workspace type-checking, linting, four API tests, Expo dependency compatibility, iOS/Android Metro exports, and the Worker dry run. Live HTTP checks verified health (200), unknown routes (404), and unimplemented auth/profile routes (501). Exported source maps were checked for server modules and secret references. These results do not establish that a signed native application installs and runs correctly on a phone.

## Time budget and working rhythm

Plan for **12 weeks at one hour every day: 84 focused sessions**, followed by **2-4 weeks of contingency** for unfamiliar tools, signing, OAuth, and device bugs. This is a planning estimate for a small private beta, not a public-store launch commitment. At five sessions per week, the core plan takes about 17 weeks. Account verification, cloud builds, and store review can add calendar time.

Use each hour as: 5 minutes reviewing the last note, 40 minutes implementing one small outcome, 10 minutes testing, and 5 minutes recording the next step. If a day's outcome takes longer, carry it forward and shift the schedule. Keep day 7 of each week available for integration, fixes, and catch-up. Avoid adding new features to recover lost time.

## Feasibility and decisions before implementation

- Keep Expo Router, TanStack Query, Reanimated, Gesture Handler, and SVG. They suit the navigation, floating card previews, category colors, and modest decorative motion. Use Reanimated for interface motion; keep the cat illustration separate so the loader can later use layered SVG animation or an exported animation asset.
- Hono on Workers with Neon and Drizzle is a reasonable architecture. The critical spike is a real database transaction through the chosen Neon driver from the Worker runtime. Validate this before implementing stamp approval.
- Use Better Auth's supported Expo integration with SecureStore for local session material. Verify the actual Google and Apple redirect/session flow early. Installing SecureStore alone does not implement authentication. Avoid creating a separate custom token system alongside the auth library.
- Replace a Google-only identity field with provider/account records that support both Apple and Google. Follow the selected auth library's schema requirements. Do not merge accounts solely because email addresses match.
- Keep `CardDefinition` as the reusable rule and `CardInstance` as an earned card. Snapshot the target and relevant display/reward terms on each instance so editing a definition cannot rewrite completed history.
- Replace `affectedInstances` as the source of truth with a relational allocation table: request ID, instance ID, and stamps allocated. Decide overflow behavior explicitly; recommended: fill the current instance, then allocate remaining stamps to subsequent instances in the same transaction.
- Make review and redemption atomic and retry-safe. Two taps or simultaneous devices must not award stamps twice or redeem a card twice. Define who can redeem; recommended initial rule: the earning user redeems once the card is complete.
- Define membership checks for every resource, not just workspace listing. Requests must bind the requester, reviewer, definition, and workspace consistently. A former member must not retain access to private proof images.
- Define category identifiers separately from display colors. Use the six palettes as reusable tokens; do not store color hex values as category identity.
- Resolve the optional-photo rule: the modal can say photos are optional only when the definition's proof requirement permits it. Show the applicable text/photo requirement before submission.
- Choose request cancellation, reviewer adjustment limits, self-approval policy, invite expiry, member removal, and photo retention behavior before writing the affected endpoints. Treat these as decisions to confirm during implementation, not existing behavior.
- Defer push notifications, chat, offline mutations, social features, and advanced analytics until the private beta works.

## Schedule: one numbered item per one-hour session

### Week 1: establish a reliable local and device setup

1. Activate project-local Node 24; verify executable paths and npm workspace recognition.
2. Verify a lockfile-based installation in a disposable checkout; run the baseline checks below.
3. Start the Worker and Metro; test the health endpoint from the computer and a phone.
4. Exercise every placeholder route, modal dismissal, Android back behavior, and API-offline behavior.
5. Check small/large screens, text scaling, safe areas, and all six palettes on an actual device.
6. Choose permanent app identifiers and a development-build path; record required accounts and signing prerequisites.
7. Fix setup problems and record a reproducible startup procedure.

Exit: the current shell runs reliably on at least one real phone; remaining platform gaps are recorded.

### Week 2: native build and authentication spike

1. Configure development builds and the app URL scheme after identifiers are chosen.
2. Install an Android development build; verify native navigation, SVG, and Reanimated startup.
3. Arrange iOS device build/signing and verify installation, or explicitly track that platform as blocked.
4. Select and verify the current Better Auth Expo/Worker/Drizzle integration; document the session flow.
5. Configure development provider credentials and callback URLs; create only the auth schema needed for the spike.
6. Prove one Google sign-in round trip on a device, including cancellation and redirect handling.
7. Fix the spike and document the working flow; roll unfinished work into week 3.

Exit: native development installation and an end-to-end authentication path are proven. This is a high-uncertainty milestone; use contingency if needed.

### Week 3: authentication and session completion

1. Implement authenticated API middleware and `/api/me`.
2. Integrate the supported mobile session persistence mechanism with SecureStore.
3. Implement Apple login and confirm identity mapping, including private relay email behavior.
4. Add real welcome-screen login actions with clear loading, cancellation, and error states.
5. Implement session restoration, logout, and expired/revoked-session behavior.
6. Test app restart, multiple devices, provider failure, and unauthorized API calls.
7. Fix issues and record credential rotation/account setup steps without committing secrets.

Exit: both providers work on their intended platforms and protected routes reject missing/invalid sessions.

### Week 4: domain schema and workspace boundaries

1. Confirm lifecycle, proof, overflow, redemption, and participant rules from the decision list.
2. Model workspaces, memberships, invitations, and categories with keys and constraints.
3. Model definitions, instances, requests, and allocation records with snapshots and indexes.
4. Generate/review migrations and apply them to a development database; inspect the result.
5. Implement membership helpers and workspace create/list/read endpoints.
6. Test cross-workspace access and prove transaction commit/rollback in the Worker runtime.
7. Review schema and fix integrity gaps before adding workflows.

Exit: persistence and tenant isolation are established; failed transactions leave no partial writes.

### Week 5: workspace switching and card setup

1. Implement invitation creation/acceptance with expiry and appropriate usage limits.
2. Implement member listing, leaving, and removal, including owner safeguards.
3. Build the avatar workspace switcher and persist the selected workspace safely.
4. Implement definition creation/update/archive and participant validation.
5. Add definition setup UI with category, recipient, target, and proof requirement.
6. Test stale membership, invalid invitations, empty workspaces, and definition edits.
7. Integrate and fix; confirm switching workspaces clears or separates cached data.

Exit: two users can share a workspace and create an agreed card definition.

### Week 6: text-based stamp requests

1. Add request contracts, quantity bounds, and text-proof validation.
2. Implement create/list/detail requests with requester/reviewer scoping.
3. Build the modal fields: category/card, person, title, text, quantity chips, and optional-photo placeholder.
4. Wire text-only submission and prevent duplicate submissions/retries from duplicating records.
5. Build incoming and outgoing pending sections; show title, participant, category, and quantity.
6. Add independent counts with visual badges capped at `9+`; retain true counts for accessibility.
7. Test invalid proof, wrong participants, empty queues, and slow/failed submissions.

Exit: one user can send a text request that only the designated reviewer can review.

### Week 7: approval, allocation, and card progress

1. Implement atomic review of a pending request with approved/rejected status transitions.
2. Implement reviewer quantity adjustment with agreed limits and a recorded final award.
3. Allocate stamps to instances and write allocation records in the same transaction.
4. Handle completion and overflow according to the agreed rule.
5. Build incoming approval actions and the floating card carousel with ordinary arrows.
6. Test concurrent approvals, repeated requests, rollback, and quantities spanning multiple cards.
7. Fix failures and verify mobile cache refresh after approval.

Exit: every approved stamp can be traced to an allocation, with no double awards.

### Week 8: approved history, completed cards, and redemption

1. Add paginated approved-request and completed-card endpoints.
2. Add category and requested/approved participation filters with defined semantics.
3. Build separate Approved and Completed tabs with loading and empty states.
4. Implement authorized, atomic redemption for completed cards.
5. Add the faded redeemed card, diagonal line, and clear `REDEEMED` stamp.
6. Test duplicate redemption, incomplete cards, filter combinations, and historical snapshots.
7. Fix history and accessibility issues; verify filters do not mix workspaces.

Exit: history is understandable and redemption occurs at most once.

### Week 9: private optional proof images

1. Configure a private development R2 bucket and choose upload size/type limits and retention policy.
2. Implement authenticated upload authorization bound to the submitting user/workspace.
3. Add image selection, cancellation, preview, and removal to the modal.
4. Validate upload completion before linking proof; handle interrupted uploads and retries.
5. Implement reviewer-authorized image reads and expired/missing-proof UI.
6. Add retention cleanup and orphan cleanup; test unauthorized reads and invalid file metadata/content.
7. Test photo/text requirements, offline uploads, and permission denial on both platforms.

Exit: photos remain private, optional where permitted, and removable on the agreed schedule.

### Week 10: finish the selected visual design

1. Refine the welcome screen with sleeping-cat details and warm green decoration.
2. Refine long cat-shaped buttons, small paw controls, and touch/accessibility targets.
3. Refine the six category palettes, neighboring card previews, and responsive card layout.
4. Refine the request modal, photo label outside the box, helper text inside, and keyboard behavior.
5. Prepare layered cat/yarn artwork and implement a short looping loader.
6. Add reduced-motion behavior and test animation during backgrounding and slow requests.
7. Test text scaling, contrast, screen readers, and small/large devices; simplify anything crowded.

Exit: the selected design works across screen sizes and motion preferences. Reserve extra sessions for original artwork if necessary.

### Week 11: reliability and development-to-staging transition

1. Review input limits, authorization, pagination, and rate limits across business endpoints.
2. Test request retry behavior, partial failures, session expiry, and stale caches.
3. Configure staging secrets/resources and HTTPS URLs separately from local development.
4. Deploy to staging when ready; verify migrations, health, and the main two-user flow.
5. Add useful server error logging without tokens or proof content; verify failure diagnostics.
6. Document database backup/restore, migration recovery, and image retention checks.
7. Rehearse the beta installation/update process and resolve release-blocking bugs.

Exit: a staging-backed build can be installed and exercised without the developer's local server.

### Week 12: private beta and handoff

1. Build and install beta candidates on Android and iOS.
2. Run the entire two-user flow: login, invite, definition, request, approval, completion, redemption.
3. Run negative cases: wrong workspace, removed user, rejected request, expired proof, duplicate review.
4. Test fresh install, restart, update, offline launch, and reconnect with the beta builds.
5. Collect feedback from a small test group and rank issues by impact.
6. Fix the highest-impact issues and repeat affected tests.
7. Record known limitations, update setup documentation, and decide whether another beta is needed.

Exit: private-beta readiness is demonstrated. Public-store submission, policy work, and review timing are a separate milestone.

## Installation: what to verify now

These are checks to perform next; they are not additional checks executed while writing this document.

### 1. Runtime and reproducible dependencies

Run from the project root in a new PowerShell terminal:

```powershell
Set-Location 'C:\Users\matthew\Desktop\Work\Work\Project\Pwease'
. ./scripts/use-node.ps1
node --version
npm --version
Get-Command node
Get-Command npm
```

- [ ] Node reports the pinned Node 24 version and both tools resolve through the project-local runtime. Activate it again in every new terminal.
- [ ] If the local runtime is missing, run `./scripts/setup-node.ps1` first. Do not bypass engine checks to use the system Node 20 installation.
- [ ] Run `npm ci` in a disposable checkout/copy to prove the lockfile installs cleanly. This replaces `node_modules` in that checkout; do not run it alongside an active dev server there.
- [ ] Run the checks below. Record any fresh failure, rather than assuming the prior implementation results apply to another machine.

```powershell
npm run typecheck
npm run lint
npm run test:api
npm run check:expo
npm run bundle:mobile
npm run build:api
```

An additional Expo project/configuration check is `npx expo-doctor` from `apps/mobile`; it may download its CLI. Run it after the baseline install or when investigating native configuration problems.

### 2. API and local networking

In terminal A, activate Node and run `npm run dev:api`. In another terminal:

```powershell
Invoke-RestMethod http://localhost:8787/api/health
curl.exe -i http://localhost:8787/api/missing
curl.exe -i http://localhost:8787/api/me
```

- [ ] Health returns `{"status":"ok","service":"pwease-api","version":"0.1.0"}` without cloud credentials.
- [ ] Unknown routes return JSON 404; `/api/me` and `/api/auth/get-session` return JSON 501 until implemented.
- [ ] A physical phone's browser can open `http://YOUR_COMPUTER_LAN_IP:8787/api/health` on the same network. Check private-network firewall access if it cannot.
- [ ] Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`: physical phone uses the computer LAN address; Android Studio emulator uses `http://10.0.2.2:8787`; iOS simulator uses `http://localhost:8787` on its host Mac.
- [ ] Copy `.env.example` only if `.env` does not already exist; preserve existing local values. Reload the app after changing the API address.
- [ ] Remember that an Expo tunnel only addresses Metro connectivity; it does not expose the local API.

### 3. Mobile shell and failure behavior

In terminal B, activate Node and run `npm run dev:mobile`. Use an Expo Go version compatible with the project's SDK; if unavailable for your device, use a compatible development build instead of changing package versions blindly. Expo distinguishes Expo Go previews from your own native development builds. [Expo environment setup](https://docs.expo.dev/get-started/set-up-your-environment/).

- [ ] Launch on a real phone without cloud credentials and without the API running.
- [ ] Welcome renders; login actions clearly remain unimplemented; Explore opens Home.
- [ ] Home, Approved, Completed, Request modal, Close, and back navigation work.
- [ ] With the API running, Home's manual connection check succeeds.
- [ ] With the API stopped, the check shows a useful error. An unreachable address may take up to the configured 15-second timeout; the app stays usable and does not retry indefinitely.
- [ ] Start the API again and retry manually; the connection recovers.
- [ ] Force-close/reopen, background/foreground, and reload; no blank screen or native-module errors appear.
- [ ] Test a small phone, a larger screen, increased system font size, and device safe areas. Buttons and text should remain reachable.
- [ ] Confirm the cat/yarn drawing is currently static; the complete animation is future work, not an installation failure.

### 4. Native installation checks that remain

Metro exports verify JavaScript bundling, not signed app installation. Development builds contain your app's native modules and configuration; cloud EAS builds can produce iOS builds from Windows, while local iOS builds require the Apple toolchain on macOS. Signing/account setup must be completed before the relevant device build. [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

- [ ] Install and launch an Android development build and an iOS development build on actual devices.
- [ ] Verify gesture handling, SVG rendering, Reanimated startup, URL scheme/deep-link opening, and splash transition in those builds.
- [ ] Before authentication work, use a temporary non-secret test value to check SecureStore write/read/delete and behavior after restart. Remove the probe afterward. Native storage behavior, including uninstall behavior, differs by platform. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).
- [ ] Once login exists, test actual provider redirects, cancellation, logout, and expired sessions on native builds; the current placeholders cannot verify these.
- [ ] Once uploads exist, test photo-library permissions, denied access, large files, and interrupted transfers.
- [ ] Later install a release-like preview build: ensure it uses the intended HTTPS API and launches without Metro. A development-client launch alone does not establish standalone release readiness.

### 5. Configuration boundaries

- [ ] Real `.env` / `.dev.vars` files remain excluded from source control. Do not put Neon URLs, provider secrets, or signing keys in the mobile environment.
- [ ] Keep `EXPO_PUBLIC_*` limited to non-secret configuration: these values are embedded in client code. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).
- [ ] Recheck mobile bundle boundaries when introducing authentication or database dependencies. A successful API health call proves only liveness, not Neon, R2, or OAuth readiness.
- [ ] Do not run schema migrations against the current empty domain schema merely to test installation. Introduce reviewed schemas during the planned persistence work.

## Daily progress note

```text
Date / session:
One outcome for today:
What changed:
What I tested and the result:
Blocker or decision needed:
Next smallest step:
```

For command details and configuration examples, also see the project's README.md. This document is a future implementation plan and checklist; writing it does not provision services or implement the listed features.
