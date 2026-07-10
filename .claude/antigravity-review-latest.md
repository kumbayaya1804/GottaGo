## Antigravity Review - P0 Remediation Batch Round 8

**VERDICT: APPROVE**

scope_hash: sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d

### Reviewed Queue
- `.beads/context/execution-state.md`
- `.planning/CLAUDE-HANDOFF-2026-07-09.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/project-audit-2026-07-09.md`
- `.planning/stale-info-scan-latest.md`
- `.planning/phases/05-trust-engine-verification/05-READINESS.md`
- `.planning/phases/05-trust-engine-verification/05-DISCUSSION-DRAFT.md`
- `ANTIGRAVITY.md`
- `.claude/commands/codex-prompt.md`
- `.claude/commands/antigravity-review.md`
- `.claude/commands/review-gate.md`
- `.claude/hooks/check-review-artifacts.js`
- `.claude/hooks/check-review-artifacts.test.js`
- `.claude/skills/review_packet_generator.md`
- `app/src/app/(components)/LocationDetailSheet.tsx`
- `app/src/app/(tabs)/index.tsx`
- `app/src/app/(tabs)/nearby.tsx`
- `app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx`
- `app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx`
- `app/src/app/__tests__/(tabs)/MapScreen.test.tsx`
- `app/src/app/__tests__/(tabs)/nearby.test.tsx`
- `app/src/app/__tests__/(tabs)/submit.test.tsx`
- `app/src/features/locations/__tests__/useCurrentPosition.test.ts`
- `app/src/features/locations/__tests__/useDeniedLocationState.test.ts`
- `app/src/features/locations/__tests__/useFamilyMode.test.ts`
- `app/src/features/locations/__tests__/useLocationDetail.test.ts`
- `app/src/features/locations/__tests__/useLocationsBbox.test.ts`
- `app/src/features/locations/__tests__/useNearby.test.ts`
- `app/src/features/locations/types.ts`
- `app/src/features/locations/useCurrentPosition.ts`
- `app/src/features/locations/useDeniedLocationState.ts`
- `app/src/features/locations/useLocationDetail.ts`
- `app/src/features/locations/useLocationsBbox.ts`
- `app/src/features/locations/useNearby.ts`
- `app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts`
- `app/src/features/submit/useMyPendingSubmissions.ts`
- `app/src/lib/database.types.ts`
- `docs/agent-harness.md`
- `docs/context-router.md`
- `docs/codex-model-routing.md`
- `CODEX.md`
- `supabase/migrations/20260710000000_phase5prep_drop_verification_events_direct_insert.sql`
- `supabase/migrations/20260710010000_phase3_postgis_schema_qualification_fix.sql`
- `supabase/migrations/20260710020000_drop_legacy_radius_rpcs.sql`
- `supabase/migrations/20260710030000_drop_legacy_radius_rpcs_all_overloads.sql`
- `supabase/migrations/20260710121534_verification_events_client_write_acl_lockdown.sql`
- `supabase/tests/phase5prep_verification_events_lockdown.test.sql`
- `supabase/tests/phase5prep_legacy_radius_rpcs_dropped.test.sql`

### Issues
- None. All P0 remediation items 1-3 have been fully resolved:
  - PostGIS schema qualification migration `20260710010000` was successfully applied, and the two legacy Phase 1 radius RPCs were retired and swept entirely via the DO block in `20260710030000` to close the `setof locations` full-row leak.
  - Direct authenticated verification event inserts are blocked by dropping `verification_events_insert_auth` in `20260710000000`.
  - Client-role database write/DDL privileges on `public.verification_events` are locked down via `20260710121534_verification_events_client_write_acl_lockdown.sql` (local, undeployed), leaving `authenticated` with `SELECT` only.
  - TypeScript types regenerated successfully from the live schema, removing the deprecated functions.
  - Async fetching helpers were renamed from `use*` to `fetch*`, resolving ESLint hooks warnings.
  - Jest tests exit cleanly without timeout (due to `gcTime: 0` defaults set in query client config).
  - The location-detail fetch error state is correctly structured, allowing user retry.
  - The shared `useCurrentPosition` hook wraps both the permission call and the GPS-fix call in a try/catch, implements a retry method with an attempt counter, handles unmount state via an active flag, and defines an `'unavailable'` status.
  - MapScreen and NearbyScreen are verified to be the only permission call sites for location discovery, and the orphaned `useDeniedLocationState` hook and test files are completely deleted from Git.

### Concerns
- **pgTAP and Device UAT Gaps:** pgTAP tests were not executed locally due to the absence of Docker, and physical-device UAT walkthroughs (Phase 3/4) remain deferred by design. These remain tracked quality and environment-verification gaps that must be performed when the necessary environment support is available.
- **Postgres Version Compatibility:** Postgres 14 support ended on 2026-07-01; verify the hosted Supabase instance version before relying on cron features.

### Verification
- **Jest Test Suite:** Executed `npm run test:coverage -- --runInBand` in `app/`. Output: 46/46 suites, 389/389 tests passed. Coverage 100% on features/lib. Clean exit in 41.8 seconds.
- **TypeScript & Lint:** Executed `npm run typecheck` (clean exit 0) and `npm run lint` (clean exit 0; 0 errors, 30 pre-existing style warnings).
- **Hook check-review-artifacts.test.js:** Executed `node --test .claude/hooks/check-review-artifacts.test.js` (clean exit 0; 15/15 tests pass).
- **Bypass Check:** Verified via PowerShell that `count_locations_within` and `get_locations_in_radius` are absent from `app/src/lib/database.types.ts`.
- **pgTAP Tests (Mocked/Deferred):** `phase5prep_verification_events_lockdown.test.sql` (18 assertions) and `phase5prep_legacy_radius_rpcs_dropped.test.sql` (5 assertions) exist in the migrations test directory but were not run due to local Docker constraints.

### Runtime Boundary Check
- **Location Permission Boundaries:** MapScreen and NearbyScreen are now the only production call sites requesting foreground location permission. All imports and calls to `useDeniedLocationState` or duplicate `requestForegroundPermissionsAsync()` have been removed.
- **React cleanup & race guards:** React's dependency-change cleanup correctly sets `active = false` before the next `useCurrentPosition` attempt, preventing stale async operations from calling `setState` post-cleanup.
- **Hook Mocking:** `MapScreen.test.tsx` successfully drives the real hook via `expo-location` mocks, rather than mocking the hook itself. `nearby.test.tsx` verifies that the `Linking.openSettings` mock is called without executing OS level side-effects.
- **PostGIS schema qualification:** Schema qualifications (`extensions.st_*`, `extensions.geography`, `extensions.geometry`, and `OPERATOR(extensions.&&)` / `OPERATOR(extensions.<->)`) successfully resolve PostGIS functions under the `SET search_path = public` security definer context.
- **Legacy RPC Retiral:** The full-row read surface of the legacy functions `get_locations_in_radius` and `count_locations_within` is completely eliminated from the database (all signatures dropped).
- **Direct verification events writes:** The `verification_events_insert_auth` policy was dropped, and the new `20260710121534` migration revokes all privileges from client roles except for `SELECT` on `authenticated`, locking down the database-level write boundary.
- **Hook enforcement:** `.claude/hooks/check-review-artifacts.js` fails closed if Git staged index is not read, and enforces `Claim And State Audit` blocks.

### Claim And State Audit
- **Database Types Freshness:** Verified regenerated types file `app/src/lib/database.types.ts` to match the post-sweep public schema (no legacy radius functions or graphql_public schema references).
- **State Consistency:** Reconciled state-chain documents (`.beads/context/execution-state.md`, `.planning/STATE.md`, `.planning/project-audit-2026-07-09.md`, `.planning/stale-info-scan-latest.md`, `.planning/phases/05-trust-engine-verification/05-READINESS.md`, and `.planning/ROADMAP.md`).
  - Active state-chain files successfully mark pre-Phase-5 remediation items 1-3 as complete, explicitly pointing recovery next steps to item 4 (authority document updates) and item 5 (Phase 5 discussion decisions).
  - The dated 2026-07-09 project audit report is correctly banner-marked as historical.
  - Phase 5 planning stubs (such as ROADMAP plan 05-01) properly test and preserve the completed direct-write lockdown rather than scheduling its removal/repair again.
- **Undeployed status:** Confirm that `20260710121534` remains local/undeployed.

### Approved
- PostGIS schema qualification migration `20260710010000` (pushed).
- Legacy radius RPC sweeps `20260710020000` and `20260710030000` (pushed).
- Verification events lockdown migration `20260710000000` (pushed).
- Verification events table write/DDL privilege revocation migration `20260710121534` (local, pending push).
- Generated TypeScript types database contract `app/src/lib/database.types.ts`.
- Async helper renames, LocationDetailSheet fetch error state, and Jest open-handle cleanup.
- Hook check script `.claude/hooks/check-review-artifacts.js` and tests.
- Active state documents `.beads/context/execution-state.md` and `.planning/STATE.md`.
