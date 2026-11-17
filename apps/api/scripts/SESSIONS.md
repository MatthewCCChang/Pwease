# Sessions and manual testing

The profile button on Home opens the current user's profile. Refresh session
calls Better Auth; Log out ends the current device's session, clears local
session storage through the Better Auth client, clears the query cache and
returns to Welcome. Other devices stay logged in.

These routes already come from the Better Auth handler in src/auth/index.ts:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/auth/get-session | Read current session and renew it when due |
| POST | /api/auth/sign-out | Delete current session and clear its cookie |
| GET | /api/auth/list-sessions | List your active sessions |
| POST | /api/auth/revoke-session | Revoke your session specified by JSON token |
| POST | /api/auth/revoke-other-sessions | End your other sessions |

Session lifetime is explicitly seven days; activity renews it when the last
update is at least a day old. Refresh session therefore does not always change
expiresAt. This is separate from Google's OAuth access/refresh tokens.
Profile edits use PATCH /api/me, not an update to session identity or token.

## Why the fixture cannot log you in

example.json demonstrates inserts into all tables. The session and verification
are deliberately expired; its account is a fictional provider identity.
A session needs both an unexpired database row and the matching signed client
cookie. Changing expiresAt alone does not supply that cookie.

Verification records support temporary auth challenges, not regular session
authentication. Let Better Auth create them during the relevant login flow.
The fixture is not an OAuth simulator.

## Use the sample business data with real logins

1. Run the API and Expo, then sign in with Google in the web app.
2. From the browser console on localhost:8081, get your real user ID:
   fetch('http://localhost:8787/api/me', { credentials: 'include' })
     .then(r => r.json()).then(console.log)
3. Use another browser profile/account to sign in as the reviewer; get its ID too.
   Each browser profile now holds its own real session.
4. Copy scripts/fixtures/example.json to scripts/fixtures/signed-in.local.json.
   Remove the user, account, session and verification sections entirely.
5. Replace every manual-earner and manual-reviewer value with the real IDs.
   If the original example was already inserted, replace its six UUIDs with new
   UUIDs consistently in this copy, including every reference. The insert command
   does not update existing records. PowerShell [guid]::NewGuid() generates a UUID.
6. Run from the repo root:
   npm run db:insert --workspace=@pwease/api -- --file scripts/fixtures/signed-in.local.json --dry-run
   npm run db:insert --workspace=@pwease/api -- --file scripts/fixtures/signed-in.local.json
7. In each signed-in browser, fetch /api/workspaces with credentials: 'include'.
   Use the returned workspace ID for /api/workspaces/:id/cards and
   /api/workspaces/:id/requests. Most business screens are still placeholders;
   test these endpoints through browser fetch or DevTools Copy as cURL.
8. Open Home > Profile: check the name/email and refresh. Click Log out, then
   fetch /api/me again: expect 401. /api/auth/get-session should return null.
   The user/account/business rows remain; only this session is removed.

In DevTools, use Copy as cURL on an authenticated request if you want to test in
a terminal. Keep the copied cookie private. Use curl.exe on Windows.
For mutations retain Origin: http://localhost:8081 and Content-Type: application/json.
A browser address bar cannot send a POST sign-out request.

## Automated tests without Google or Neon

npm run test --workspace=@pwease/api

The tests create isolated PGlite databases, insert users and valid sessions, and
sign test cookies with a test-only secret. They exercise the real Better Auth
handler: renewal, logout, cookie clearing, rejecting untrusted origins, and
rejecting unsigned/expired sessions. This is not a production login bypass and
does not require inserting reusable credentials into your Neon database.
