<!-- review-manifest
reviewer: codex
generated_at: 2026-07-10T23:07:26Z
scope_hash: sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d
queue:
  - .beads/context/execution-state.md
  - .planning/CLAUDE-HANDOFF-2026-07-09.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/project-audit-2026-07-09.md
  - .planning/stale-info-scan-latest.md
  - .planning/phases/05-trust-engine-verification/05-READINESS.md
  - .planning/phases/05-trust-engine-verification/05-DISCUSSION-DRAFT.md
  - ANTIGRAVITY.md
  - .claude/commands/codex-prompt.md
  - .claude/commands/antigravity-review.md
  - .claude/commands/review-gate.md
  - .claude/hooks/check-review-artifacts.js
  - .claude/hooks/check-review-artifacts.test.js
  - .claude/skills/review_packet_generator.md
  - app/src/app/(components)/LocationDetailSheet.tsx
  - app/src/app/(tabs)/index.tsx
  - app/src/app/(tabs)/nearby.tsx
  - app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
  - app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx
  - app/src/app/__tests__/(tabs)/MapScreen.test.tsx
  - app/src/app/__tests__/(tabs)/nearby.test.tsx
  - app/src/app/__tests__/(tabs)/submit.test.tsx
  - app/src/features/locations/__tests__/useCurrentPosition.test.ts
  - app/src/features/locations/__tests__/useDeniedLocationState.test.ts
  - app/src/features/locations/__tests__/useFamilyMode.test.ts
  - app/src/features/locations/__tests__/useLocationDetail.test.ts
  - app/src/features/locations/__tests__/useLocationsBbox.test.ts
  - app/src/features/locations/__tests__/useNearby.test.ts
  - app/src/features/locations/types.ts
  - app/src/features/locations/useCurrentPosition.ts
  - app/src/features/locations/useDeniedLocationState.ts
  - app/src/features/locations/useLocationDetail.ts
  - app/src/features/locations/useLocationsBbox.ts
  - app/src/features/locations/useNearby.ts
  - app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts
  - app/src/features/submit/useMyPendingSubmissions.ts
  - app/src/lib/database.types.ts
  - docs/agent-harness.md
  - docs/context-router.md
  - docs/codex-model-routing.md
  - CODEX.md
  - supabase/migrations/20260710000000_phase5prep_drop_verification_events_direct_insert.sql
  - supabase/migrations/20260710010000_phase3_postgis_schema_qualification_fix.sql
  - supabase/migrations/20260710020000_drop_legacy_radius_rpcs.sql
  - supabase/migrations/20260710030000_drop_legacy_radius_rpcs_all_overloads.sql
  - supabase/migrations/20260710121534_verification_events_client_write_acl_lockdown.sql
  - supabase/tests/phase5prep_verification_events_lockdown.test.sql
  - supabase/tests/phase5prep_legacy_radius_rpcs_dropped.test.sql
diff_base: HEAD (30272ceda89700a863771fe211d8ff85ebe72d30)
context_tier: 1
-->

# P0 Remediation Batch - Fresh Review Round 8 (post Round 7 fingerprint fix)

## Goal

Your own prior verdict, saved at `.claude/codex-review-latest.md`, is **Round 7: REQUEST CHANGES** with one MAJOR review-gate freshness finding. This packet describes the deterministic staged-scope fingerprint fix and retains the already-closed Round 6 findings for context. Verify all 49 staged paths from disk/index and do not reuse any prior verdict text.

No prior verdict is current. Round 7's fingerprint finding is the active baseline; Round 6's findings below are retained only to confirm they remain closed.

## Round 7 Finding And Claimed Fix

Round 7 found that filename-only artifact checks did not bind APPROVE verdicts to the exact bytes being committed. The staged 49-file queue is now frozen at:

`scope_hash: sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d`

`check-review-artifacts.js` deterministically hashes sorted queue paths plus their staged index descriptors, requires this exact fingerprint in both packets and both verdicts, and rejects missing/mismatched hashes. Its CLI prints the staged hash for packet generation. The isolated fixture suite is now 15/15 and includes approve -> re-stage changed queued bytes -> prior artifacts fail. Durable generator, command, harness, Codex, and Antigravity contracts were updated to stage the exact queue, carry the fingerprint, and require full re-review after re-staging.

## Round 6 Findings And Claimed Fixes

1. **[MAJOR] `app/src/features/locations/useDeniedLocationState.ts:35`** — MapScreen mounted this hook alongside `useCurrentPosition`, causing a duplicate `requestForegroundPermissionsAsync()` call in production with only a fulfillment handler (no rejection/unmount guard on the older hook).
   - Claimed fix: `app/src/app/(tabs)/index.tsx` no longer imports or calls `useDeniedLocationState`. It now derives `showManualSearch` / `positionUnavailable` / `manualSearchActive` purely from `useCurrentPosition()`'s own `status` field, and `useCurrentPosition.ts` itself was extended with a `retry()` method and a `try/catch` around both the permission call and the GPS fix, setting `status: 'unavailable'` on rejection instead of leaving an unhandled promise rejection. An `active` flag guards against post-unmount state writes for both the permission and position promises.
   - The now-orphaned `useDeniedLocationState.ts` and its standalone test were deleted and are explicitly included in the review queue. A repository scan finds no remaining reference.

2. **[MAJOR] `app/src/app/(tabs)/nearby.tsx:74`** — Nearby only offered Retry for `unavailable`; `denied` and `undetermined` had no recovery action, and the existing test asserted the dead end rather than a recovery path.
   - Claimed fix: `nearby.tsx` now branches on `positionStatus` (`unavailable` / `denied` / `undetermined`) with distinct copy for each, a Retry button wired to `retryPosition()` for `unavailable`, and an "Open settings" button wired to `Linking.openSettings()` for `denied`. `undetermined` renders a non-actionable "Finding your location" pending state with no buttons. Three new/updated tests in `nearby.test.tsx` assert: the denied-state settings button calls `Linking.openSettings`, the undetermined state shows no actionable buttons, and the unavailable state's Retry button calls the hook's `retry()`.

3. **[MAJOR] `.claude/review-queue.txt:26`** — The queue/manifest omitted the changed `app/src/features/locations/__tests__/useCurrentPosition.test.ts` regression file.
   - Claimed fix: the queue (and this packet's manifest above) now includes that test file. Confirm queue/manifest/git-status all agree — see verification below.

## Files Changed To Close Round 6

Use `git diff --cached -- <path>` and inspect the staged files directly; this summary is not proof. Re-inspect every file in the 49-file queue.

### app/src/app/(tabs)/index.tsx

- Removed `useDeniedLocationState` import/call entirely.
- `showManualSearch = positionStatus === 'denied'`, `positionUnavailable = positionStatus === 'unavailable'`, `manualSearchActive = (showManualSearch || positionUnavailable) && !manualBrowseEnabled`.
- New `manualBrowseEnabled` local state, reset to `false` via `useEffect` whenever `coords !== null`.
- The manual-search overlay now shows `LOCATION_UNAVAILABLE_COPY` + a Retry button (calls `retryPosition`) when `positionUnavailable`, vs. the original `DENIED_COPY` + "Search this area" (now sets `manualBrowseEnabled(true)` instead of directly calling `bboxQuery.refetch()`).
- All the `showManualSearch` gates that controlled pin rendering, chip row, and empty-state logic were switched to `manualSearchActive`.

### app/src/app/(tabs)/nearby.tsx

- Imports `expo-linking`.
- New copy constants for `unavailable` (`LOCATION_UNAVAILABLE` / retry) and `denied` (`LOCATION_DENIED_COPY` / "Open settings" via `Linking.openSettings()`); `undetermined` shows `FINDING_LOCATION` with no action.
- `useCurrentPosition()` destructures `status` and `retry` now (previously only `coords`).

### app/src/app/__tests__/(tabs)/nearby.test.tsx

- Extends the existing denied-GPS test to assert the settings button fires `Linking.openSettings`.
- Adds a test for the `undetermined` pending state asserting NO actionable buttons render (`queryByLabelText` for both action labels returns null).
- Adds a test for the `unavailable` state asserting Retry calls the hook's `retry` mock and `fetchNearby` is never invoked.

### app/src/app/__tests__/(tabs)/MapScreen.test.tsx

- Removed both hook-level mocks. The provider-rejection recovery test now exercises the real `useCurrentPosition` hook through the shared `expo-location` mock, proves Retry invokes permission acquisition again, and proves manual viewport browsing remains available.

### Removed duplicate permission boundary

- Deleted `app/src/features/locations/useDeniedLocationState.ts` and `app/src/features/locations/__tests__/useDeniedLocationState.test.ts`; no production or test reference remains.

### app/src/features/locations/useCurrentPosition.ts + its test

- `PermissionStatus` gains a fourth value: `'unavailable'`.
- Hook return type gains `retry: () => void`, backed by an `attempt` counter that re-runs the effect.
- The permission call and the GPS-fix call are now both wrapped in one `try/catch`; any rejection from either sets `status: 'unavailable'` (never an unhandled rejection).
- An `active` boundary flag, set false in the effect's cleanup, guards every `setState` call against firing after unmount — including mid-flight on `retry()`.
- New tests cover: permission-provider rejection then successful retry, GPS-acquisition rejection, a permission result arriving after unmount (must not call `getCurrentPositionAsync`), a GPS fix arriving after unmount (must not throw/update), and a provider rejection arriving after unmount.

## Runtime Boundary And Mock Audit

- `MapScreen` (`index.tsx`) and `NearbyScreen` (`nearby.tsx`) are now BOTH single-permission-boundary consumers of `useCurrentPosition` only. Confirm no other screen, layout, or provider still imports `useDeniedLocationState` or duplicates a foreground-permission request — a second real `requestForegroundPermissionsAsync()` call in production (even from a screen not covered by this queue) would reproduce the original Round 6 #1 risk elsewhere.
- `MapScreen.test.tsx` uses the real hook through mocked `expo-location`; `nearby.test.tsx` mocks `useCurrentPosition` directly. Confirm both boundaries and the Nearby mock shape against the real return contract.
- Check `retry()` re-entrancy. The effect cleanup runs on every `attempt` dependency change as well as unmount, setting the previous attempt's `active` flag false before the next effect; verify this prevents a superseded attempt from overwriting newer state.
- Confirm `Linking.openSettings()` is mocked in the test (not calling the real OS API in Jest) and that the mock is asserted for call count, not just presence.

## Required Verdict Format (from CODEX.md)

```md
## Codex Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

scope_hash: sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d

### Reviewed Queue
- List every queued file inspected for this verdict.

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, and required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Runtime Boundary Check
- Call-path and mock-boundary assessment, including any production behavior not covered by tests.

### Approved
- What is correct or ready to merge.
```

## Local Verification Evidence (Claude-run, re-verify independently)

- `npm run typecheck` in `app/`: exit 0, no errors.
- `npm run lint` in `app/`: exit 0; 0 errors, 30 disclosed pre-existing warnings (BOM + a few others), none new.
- `npm run test:coverage -- --runInBand` in `app/`: 46/46 suites, 389/389 tests, 100% coverage on `features/**`/`lib/**`, clean process exit (no `--forceExit` needed), 34.6s. The suite/test count decreased only because the orphaned hook's one suite/three tests were deleted.
- `node --test .claude/hooks/check-review-artifacts.test.js`: 15/15 pass, including stale-approval invalidation after changed bytes are re-staged.
- `git diff --cached --check`: exit 0; staged queue fingerprint independently printed as the hash above.
- pgTAP (`supabase/tests/phase5prep_*.test.sql`) still NOT executed — no Docker in this environment. Tracked override, unchanged from prior rounds.
- No live Supabase push, no device UAT performed. The ACL forward migration `20260710121534` remains local/undeployed pending its own separately authorized push.

## What To Do

1. Independently re-run or re-verify the commands above (or explain why you can't).
2. Re-inspect all 49 queued files from the staged index/disk, including both deleted paths, four new workflow-contract paths, and the active-state documents.
3. Judge whether Round 6's three findings are actually closed, including complete removal of the orphaned duplicate hook.
4. Judge the new re-entrancy question above (rapid Retry double-press) as an open question if you can't rule it out from static inspection alone.
5. Write your verdict to `.claude/codex-review-latest.md`, labeled `Round 8`, repeat the exact `scope_hash` line above, and print it.
