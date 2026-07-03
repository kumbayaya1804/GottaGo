## Codex Review - WU-02-T6 (profileTrigger.test.ts)

**VERDICT: APPROVE**

### Findings
- None.

### Open Questions
- None.

### Verification
- Read `.claude/codex-prompt-latest.md`; current packet is WU-02-T6, scoped to the test-only file `app/src/features/profile/__tests__/profileTrigger.test.ts`.
- Read `CODEX.md`, `docs/agent-harness.md`, `.claude/review-queue.txt`, `docs/stale-info-scan.md`, `.planning/stale-info-scan-latest.md`, `docs/schema-contract.md`, `.planning/phases/02-auth-profiles/02-REVIEW.md`, the queued test file, and `supabase/migrations/20260627000000_handle_new_user_trigger.sql`.
- Confirmed `.claude/review-queue.txt` lists only `app/src/features/profile/__tests__/profileTrigger.test.ts`.
- Inspected the queued test from disk. The source-scan guard walks `app/src` via `srcRoot` and checks static `.from('users').insert(` / `.from('users').upsert(` calls at `app/src/features/profile/__tests__/profileTrigger.test.ts:19-48`.
- Confirmed the `srcRoot` sanity checks at `app/src/features/profile/__tests__/profileTrigger.test.ts:20-22` meaningfully reduce silent scan narrowing by requiring both expected `features` and `lib` children before walking.
- Searched `app/src` for `.from(` calls. The only production `.from('users')` call is `app/src/features/profile/getMyProfile.ts:16-20`, and it is a `.select('display_name')`, not an insert or upsert. The only other hit is the test's own explanatory comment.
- Inspected the migration. `supabase/migrations/20260627000000_handle_new_user_trigger.sql:21-32` defines `public.handle_new_user()` as `security definer`, inserts only `(id, email)` at lines 28-29, returns `new`, and does not set `display_name` in the function body.
- Confirmed the migration SQL parse in `app/src/features/profile/__tests__/profileTrigger.test.ts:67-71` is appropriate for this migration: anchoring to `as $$ ... $$;` avoids the earlier nested `begin` / `end;` truncation risk. A literal `$$` inside the function body would terminate this exact dollar-quoted SQL body, so that is not a realistic hidden-body edge case for the current delimiter; if the migration changes to a different dollar-quote tag, this test will fail loudly via `functionBody` being undefined.
- Confirmed no `supabase/functions` directory is present, so there is no current Supabase Edge Function source tree outside `app/src` for this test to miss. The documented blind spots remain static-scan limits: template-literal table names, variable table names, and any future non-`app/src` client/server source location would need an explicit test update.
- `npm.cmd test -- --runInBand --testPathPattern=profileTrigger` from `app` passed: 1 suite, 2 tests.
- `npm.cmd test -- --runInBand` from `app` passed: 25 suites, 200 tests.

### Runtime Boundary Check
- Dependency call chain: none. The test imports only Node `fs` and `path`; it does not import application modules, hooks, providers, route guards, the Supabase client, or mocked APIs.
- Runtime boundary under test is the real on-disk source tree (`app/src`) plus the real committed migration (`supabase/migrations/20260627000000_handle_new_user_trigger.sql`).
- There is no mock boundary in this file that could hide production behavior. The assertions are structural presence checks, not runtime integration tests.
- The source scan is sound as a bounded guard for the stated invariant: no static client-side `.from('users').insert(` or `.from('users').upsert(` path under `app/src`. It is intentionally not an exhaustive parser or database-policy proof, and the accepted blind spots are documented in-file at `app/src/features/profile/__tests__/profileTrigger.test.ts:23-25`.

### Approved
- The WU-02-T6 test is ready to merge as a regression guard for the trigger-only profile provisioning contract.
- The current test catches the direct client write forms it claims to catch, fails loudly if its expected `app/src` or migration path assumptions break, and verifies the committed `handle_new_user` trigger migration sets only `id` and `email`.
- No Codex findings remain for this scoped review.
