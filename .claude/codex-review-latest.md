## Codex Review - Round 8 P0 Remediation Batch

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
- `app/src/features/locations/__tests__/useDeniedLocationState.test.ts` (staged deletion inspected against `HEAD`)
- `app/src/features/locations/__tests__/useFamilyMode.test.ts`
- `app/src/features/locations/__tests__/useLocationDetail.test.ts`
- `app/src/features/locations/__tests__/useLocationsBbox.test.ts`
- `app/src/features/locations/__tests__/useNearby.test.ts`
- `app/src/features/locations/types.ts`
- `app/src/features/locations/useCurrentPosition.ts`
- `app/src/features/locations/useDeniedLocationState.ts` (staged deletion inspected against `HEAD`)
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

### Findings
- No blocking findings.

### Open Questions
- None affecting merge safety. The separately authorized deployment/live verification of `20260710121534` and the already-tracked Docker pgTAP/device-UAT gaps remain post-merge operational or verification boundaries, not hidden approval assumptions.

### Verification
- Recomputed the staged queue fingerprint with `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`: exact packet match, `sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d`.
- Compared `.claude/review-queue.txt` with `git diff --cached --name-only`: 49 queue entries and 49 staged paths, no differences; both staged deletions were confirmed absent from the index and inspected from `HEAD`.
- `node --test .claude/hooks/check-review-artifacts.test.js`: exit 0, 15/15 passed, including changed-staged-byte invalidation and fail-closed index inspection.
- `npm.cmd run typecheck` in `app`: exit 0.
- `npm.cmd run lint` in `app`: exit 0 with 0 errors and 30 disclosed warnings.
- `npm.cmd run test:coverage -- --runInBand` in `app`: exit 0; 46/46 suites and 389/389 tests passed; configured `features/**` and `lib/**` coverage is 100%. One disclosed non-failing React `act(...)` warning remains in `MapScreen.test.tsx`.
- `git diff --cached --check`: exit 0.
- pgTAP was not run because Docker is unavailable in this environment. Both SQL suites were statically inspected, including assertion counts, role/ACL checks, denied direct INSERT, any-signature legacy-RPC removal, and transaction rollback.
- No live Supabase push, live ACL query, device UAT, or commit was performed.

### Runtime Boundary Check
- `MapScreen` and `NearbyScreen` now consume only `useCurrentPosition` for their mounted read-path permission/GPS boundary. The deleted `useDeniedLocationState` hook and test have no remaining reference. Other foreground-permission calls are confined to separate auth-consent and submission-GPS workflows, not a second concurrently mounted Map/Nearby boundary.
- `useCurrentPosition` catches permission-provider and GPS-fix rejection, exposes explicit `unavailable` recovery, and guards every async settlement with an effect-local `active` flag. Retry increments the effect dependency; React cleanup invalidates the superseded attempt before the next effect can publish state, including rapid repeated Retry presses.
- Map's provider-rejection test crosses the real hook through mocked `expo-location`; Nearby deliberately mocks the hook contract and asserts unavailable Retry, denied OS-settings recovery, and non-actionable undetermined state. `Linking.openSettings()` is mocked and call-count asserted.
- Location-detail failure now reaches an inline retry instead of an endless skeleton, and the query wrappers preserve server-side RPC enforcement rather than introducing client-side trust or privacy filtering.
- The review fingerprint binds sorted queue paths to staged Git index descriptors, including a deterministic `DELETED` marker. Re-staging a queued blob changes its index object ID and invalidates both saved approvals.
- Database enforcement remains server-side: direct authenticated `verification_events` INSERT policy removal is paired with client ACL reduction to authenticated SELECT only; all legacy radius-RPC overloads are removed; active public read RPCs retain explicit public-safe return columns, moderation/family-mode filters, qualified PostGIS objects, restricted `PUBLIC` execution, and scoped `anon`/`authenticated` grants.
- Mocked/Jest results are not treated as proof of PostgreSQL policy behavior, a live migration, Mapbox/native permission behavior, or device UX. Those limits remain explicitly recorded in active state.

### Approved
- Round 7's stale-verdict bypass is closed for the staged queue: packets and verdicts are bound to the exact staged object IDs, and regression coverage proves changed queued bytes invalidate prior approval.
- Round 6's duplicate permission request, Nearby denied-state dead end, and omitted regression-file scope issue remain closed.
- The staged migrations, generated types, app recovery paths, workflow contracts, and active handoff/state documents are internally consistent and ready for the Codex side of the review gate.
- Overall commit readiness still requires the separate current-scope Antigravity APPROVE artifact; this Codex verdict does not substitute for that independent gate.
