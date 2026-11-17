# Creating, joining and switching workspaces

Apply the new migration before testing invitations. From apps/api, use Node 24
to load your API environment file and run Drizzle (this changes your configured DB):

    node --env-file=.env ../../node_modules/drizzle-kit/bin.cjs migrate

If your DATABASE_URL is in .dev.vars instead, use --env-file=.dev.vars.
Use your development database. The migration adds workspace_invite; existing
workspaces and members are preserved. No migration is applied automatically.

Start the API and mobile app. Sign in, then open Home > Profile:

- Create a workspace by name. The creator becomes its owner and it is selected.
- Switch using the workspace list. Home displays "Welcome to workspace <name>".
- Owners can generate a code and select/copy its text to share it.
- Another signed-in account can paste the code into Join workspace.
- Codes expire in seven days and admit one new member. An existing member does
  not consume an unused code. Only a hash is stored in the database.
- Members cannot generate invitations. Invitations from someone who is no longer
  an owner are rejected. Used/expired/unknown codes grant no access.

Selection is kept in memory for the current account. On reload, the newest
workspace is selected. The list and current membership refresh every 30 seconds;
switching always checks membership immediately. Every business API request also
checks membership, independently of the selected workspace in the UI.

Test with two browser profiles:
1. Account A creates two workspaces and switches between them.
2. Account B sees neither until redeeming an invitation for one.
3. B can access only the joined workspace; a direct GET for the other ID gives 404.
4. A used invitation cannot admit another account.
5. Logging out clears selection; a different account gets its own workspace list.

Most stamp UI remains a preview; this change connects the workspace controls.
Automated tests run in PGlite with real session validation:
npm run test --workspace=@pwease/api
