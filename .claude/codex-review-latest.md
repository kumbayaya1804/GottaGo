## Codex Review - app/src/features/auth/oauth.ts, app/src/features/auth/__tests__/oauth.test.ts, app/src/features/profile/updateProfile.ts, app/src/features/profile/__tests__/updateProfile.test.ts, app/src/features/profile/deleteAccount.ts, app/src/features/profile/__tests__/deleteAccount.test.ts, app/src/features/profile/profileStats.ts, app/src/features/profile/__tests__/profileStats.test.ts

**VERDICT: REQUEST CHANGES**

### Findings
- [MAJOR] app/src/features/profile/profileStats.ts:22 - `profileStats()` reads the `ratings` base table directly from the client, but the current privacy migration explicitly revokes base-table `SELECT` from `authenticated` (`supabase/migrations/20260624000002_ratings_privacy_fix.sql:13-14`) after the earlier public-rating identity exposure fix. In the real app this query will fail with a permission error instead of returning `ratingsGiven`, even though the mocked unit test passes. It also keeps personal contribution stats dependent on a caller-supplied `userId` at the client boundary. Required fix: expose profile stats through a reviewed authenticated RPC that derives the user from `auth.uid()` and returns aggregate counts, or provide an equivalent database-reviewed own-stats path; add tests that cover the ratings count path against the intended permission model rather than only a mocked `from('ratings')` chain.

### Open Questions
- None.

### Verification
- Read `.claude/codex-prompt-latest.md` and confirmed the scoped review files from `.claude/review-queue.txt`.
- Read `CODEX.md`, `CLAUDE.md`, `AGENTS_ROSTER.md`, `AGENTS.md`, `docs/agent-harness.md`, `SPEC.md`, `docs/schema-contract.md`, `docs/review-severity.md`, `docs/verification.md`, `docs/stale-info-scan.md`, `.planning/stale-info-scan-latest.md`, `.planning/PROJECT.md`, and `.claude/antigravity-review-latest.md`.
- Inspected all eight scoped implementation/test files from disk, plus related `app/src/lib/supabase.ts`, `app/src/features/auth/displayName.ts`, `app/jest.setup.ts`, and relevant Supabase migrations.
- `npm.cmd test -- --runInBand app/src/features/auth/__tests__/oauth.test.ts app/src/features/profile/__tests__/updateProfile.test.ts app/src/features/profile/__tests__/deleteAccount.test.ts app/src/features/profile/__tests__/profileStats.test.ts` - passed, 4 suites / 24 tests.
- `npm.cmd run typecheck` - passed.
- `npm.cmd run lint` - passed with 27 warnings, all in pre-existing files outside this review's changed files.
- `npm.cmd test -- --runInBand` - passed, 19 suites / 133 tests.
- Not run: live Supabase/database tests. The permission finding is based on local migration inspection, not a live database query.

### Approved
- `oauth.ts` correctly uses Expo WebBrowser with `skipBrowserRedirect`, handles `cancel` and `dismiss` without throwing, exchanges callback codes through Supabase Auth, and has focused unit coverage for success and error paths.
- `updateProfile.ts` and `deleteAccount.ts` use RPC boundaries rather than client-side table mutation and surface RPC errors to callers.
- The scoped Jest and TypeScript verification passed; no service-role keys, auth tokens, raw SQL, PII logging, or coordinate handling issues were found in the reviewed app files.
