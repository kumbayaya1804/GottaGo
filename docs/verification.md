# Verification Commands

Status: active. Update this file when the stack or host tooling changes.

## Goal

Every non-trivial change should have a clear verification signal before commit. Reviewers should report what they ran and what they could not run.

## Expected Command Categories

For the Expo/TypeScript app, expected commands include:

```bash
cd app && npm.cmd test -- --runInBand
cd app && npm.cmd run typecheck
cd app && npm.cmd run lint
cd app && npm.cmd run test:coverage -- --runInBand
```

On this Windows host, use `npm.cmd` rather than `npm` from PowerShell. The `.ps1` shims can be blocked by execution policy.

For focused Jest runs against Expo Router paths containing literal parentheses, use `--runTestsByPath` so Jest does not treat `(auth)` as a regular-expression group:

```bash
cd app && npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(auth)/sign-in.test.tsx"
```

## Supabase And Database Verification

When Supabase migrations or database logic exist, expected verification should include the project-standard equivalent of:

```bash
supabase db lint
supabase test db
supabase db reset
```

Use only commands that are actually configured for the repository. If local Supabase is not available, reviewers must say that database verification was not run.

Multi-session/multi-connection pgTAP tests that commit a real, globally-visible mutation mid-test (e.g. a two-session race that requires a temporarily-changed `app_config` value visible to a separate connection, not just a savepoint) MUST run against a disposable, single-use local Supabase/Postgres instance dedicated to that suite invocation — never against a persistent or shared non-production database another run or another developer could be using concurrently. A committed global mutation is not safe to "restore" after the fact if a second concurrent run could observe or race the same window.

Do not prescribe a `dblink_connect()` string from credentials or destination address
alone. Supplying a password does not prove that the server requested password
authentication, and `pg_hba.conf` network rules match the client's source address, not
the server destination. In the pinned Supabase container, Unix-socket `peer` and
loopback `trust` routes can both accept a connection without password negotiation.
Before committing a dblink harness, prove the complete client -> resolver -> transport
-> kernel/container route -> server -> matched HBA rule -> negotiated authentication
path in the disposable runtime. If supported by the pinned libpq version, a client-side
authentication requirement such as `require_auth=scram-sha-256` is an additional
fail-closed assertion, not a substitute for the runtime proof. There is currently no
approved speculative connection string for
`supabase/tests/phase5_discovery_cooldown_race.test.sql`.

This requirement is a mandatory procedural rule, not optional guidance: no script or hook currently blocks a plain `supabase test db` invocation from running one of these files, so it is enforced by this document and the file's own header comment, not by an automatic guard — run `node supabase/scripts/run-isolated-db-suite.js <test-path>` for any suite file containing such a test. Currently required: `supabase/tests/phase5_discovery_cooldown_race.test.sql` (committed; a genuine two-session dblink race proving the atomic discovery-cooldown claim — see the file's own header). Also required once authored: `supabase/tests/phase5_verify_publish.test.sql` (planned in Phase 5 05-02, not yet on disk; will contain the HISTORICAL-VERIFIER-SHADOWBAN-RACE fixture per `05-02-PLAN.md`). The runner copies `supabase/migrations`, `supabase/tests`, and `supabase/seed.sql` into a fresh OS temp directory alongside a rewritten `config.toml` (unique `project_id`, every `port`/`shadow_port`/`inspector_port` key shifted by a random per-invocation offset — this repo's config.toml uses `inspector_port` for the edge runtime inspector rather than `port`, so the rewrite explicitly covers that key too, not just `port`/`shadow_port`), preflight-checks that every resulting port is actually free before starting, drives that copy by resolving the installed `supabase` CLI's real underlying entry point rather than invoking its platform shim as a command string: on Windows, the `.cmd`/`.bat` npm shim is itself just a thin launcher for a real JavaScript file (`node_modules/supabase/dist/supabase.js`), which is resolved and invoked directly via `spawnSync(process.execPath, [jsEntry, ...args], { shell: false })`; a resolved real executable (a non-npm `.exe` install, or the typical non-Windows binary) is instead invoked directly via `spawnSync(binPath, args, { shell: false })` with no JS entry involved. Either way, no shell or `.cmd`/`cmd.exe` command-string boundary is ever in the invocation path, which specifically avoids Windows `cmd.exe`'s `%VAR%` environment-expansion pass, an injection vector that survived an earlier version of this runner that shelled out through `cmd.exe` with manually-escaped arguments (confirmed exploitable, then confirmed closed by removing the shell boundary entirely) — and attempts `supabase stop --no-backup` teardown after every start attempt (including a failed one, in case it created partial resources) in a `finally` block; a teardown failure is never downgraded to a warning — it fails the run and preserves the temp workdir as a manual-recovery reference instead of deleting it. Plain `supabase test db` against this repo's fixed `Gotta_Go` project/ports is not an acceptable substitute for either file, even on an otherwise Docker-capable machine — two invocations sharing that fixed stack can interleave a committed mutation and its restore.

## Browser And Frontend Verification

For user-facing UI changes, verify:
- Desktop and mobile responsive layout
- Loading states
- Error states
- Empty states
- Denied location permission
- Slow or failed network calls
- Keyboard accessibility for controls
- No PII or precise coordinates in visible logs/debug UI
- Parent layout, provider, route guard, and async event behavior when those boundaries can change the screen outcome
- Whether screen tests mock production boundaries such as router, auth session, Supabase RPCs, GPS, network, or RLS behavior

When a dev server exists, run it and inspect the affected route in a browser if practical.

## Security-Sensitive Verification

For changes involving GPS, trust, shadowban, RLS, or moderation, verification must include targeted tests or direct inspection of enforcement at the correct layer.

Minimum evidence to look for:
- Tests for allowed and denied access
- Tests for shadowbanned users/locations being excluded
- Tests for deleted/expired/suppressed records being excluded
- Tests for failed Supabase calls
- Tests for GPS radius, freshness, and accuracy rules
- No sensitive values in logs

For auth, routing, Supabase writes, GPS, trust/shadowban, RLS-sensitive reads, and async UI flows, reviewers should include a call-path and mock-boundary check in addition to test results. Passing isolated unit or screen tests is not sufficient when those tests replace the provider, route guard, database, policy, or external callback that decides production behavior.

## Review Reporting

Reviewers should include a verification section:

```md
### Verification
- `npm test` - passed
- `npm run typecheck` - passed
- Not run: Supabase database tests; no Supabase config exists yet.
```

If a command fails, report the failing command and the relevant failure. Do not hide failed verification behind an approval.
