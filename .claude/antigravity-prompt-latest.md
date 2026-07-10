<!-- review-manifest
reviewer: antigravity
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

# P0 Remediation Batch - Fresh Review Round 8 For Antigravity

## Goal

Your last saved verdict, `.claude/antigravity-review-latest.md`, is **Round 5: APPROVE**. Since then, Codex ran two more review rounds against this same batch and found real issues in the app-code portion, which were fixed without your re-review:

- **Codex Round 5** found the location-detail fetch error state was unreachable in practice and that `useCurrentPosition` left GPS-provider failures as an unhandled rejection with no recovery path. Both were fixed.
- **Codex Round 6** then found MapScreen still mounted a second, duplicate permission-request hook (`useDeniedLocationState`) alongside the fix, and that Nearby's denied/undetermined GPS states were still a dead end with no recovery action. Both were fixed, and a scope gap (a missing test file in the review queue) was corrected too. Codex Round 6's full verdict, including its findings and what it asked for, is preserved at `.claude/codex-review-latest.md` for your reference — do not assume it is resolved just because Claude says so; re-verify from disk.
- **Codex Round 7** approved all app/SQL/state fixes but found the hook bound approvals only to filenames, not exact staged bytes. The 49-file staged queue now has deterministic fingerprint `sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d`; both packets and verdicts must repeat it, and 15/15 hook fixtures prove a changed re-staged byte invalidates prior approvals.

**Your Round 5 APPROVE is stale.** It predates all of the diffs below. Treat this as a full fresh review of the current 49-file staged queue, not an incremental patch review. Verify the exact fingerprint above independently and inspect every queued path.

## What Changed Since Your Round 5 APPROVE

### Batch A - Codex Round 5 fixes (detail-fetch + GPS-provider recovery)

- `app/src/app/(components)/LocationDetailSheet.tsx` — the error branch was moved ahead of the `detail === undefined` loading-skeleton check (previously the error state was unreachable because the skeleton check came first and `detail` stays `undefined` on error too). Added a "Retry loading location details" button calling `detailQuery.refetch()`.
- `app/src/features/locations/useCurrentPosition.ts` — added a fourth `PermissionStatus` value `'unavailable'`, wrapped both the permission call and the GPS-fix call in one `try/catch` (previously an unhandled promise rejection), added a `retry()` method backed by an `attempt` counter, and an `active` boundary flag guarding all `setState` calls against firing after unmount.
- Matching test updates in `LocationDetailSheet.test.tsx`, `LocationDetailSheet.updateCode.test.tsx`, `useLocationDetail.test.ts` (rename-only, already in your Round 5 scope), and new `useCurrentPosition.test.ts` cases for provider-rejection-then-retry, GPS-rejection, and three post-unmount-arrival races.

### Batch B - Codex Round 6 fixes (duplicate permission hook + Nearby dead end + queue gap)

- `app/src/app/(tabs)/index.tsx` (MapScreen) — removed the `useDeniedLocationState` import/call entirely (it was a SECOND live `requestForegroundPermissionsAsync()` call running in parallel with `useCurrentPosition`, with only a fulfillment handler and no unmount guard). MapScreen now derives all manual-search/unavailable UI purely from `useCurrentPosition()`'s own `status`, and added a `manualBrowseEnabled` local toggle (reset when `coords` becomes non-null) plus a Retry button for the `unavailable` case.
- `app/src/app/(tabs)/nearby.tsx` — added distinct copy/actions for `unavailable` (Retry via `retryPosition()`), `denied` (new "Open settings" button via `Linking.openSettings()`), and `undetermined` (non-actionable pending copy, no buttons).
- `app/src/app/__tests__/(tabs)/MapScreen.test.tsx` — rewritten to drive the real `useCurrentPosition` through mocked `expo-location` calls instead of mocking `useDeniedLocationState`/`useCurrentPosition` directly, so the test now exercises the actual hook composition instead of hiding it behind two separate mocks.
- `app/src/app/__tests__/(tabs)/nearby.test.tsx` — new assertions for the settings button, the non-actionable undetermined state, and the unavailable-state retry path.
- `.claude/review-queue.txt` — added `app/src/features/locations/__tests__/useCurrentPosition.test.ts`, which Codex Round 6 flagged as an omitted protected file.
- `app/src/features/locations/useDeniedLocationState.ts` and its standalone test were deleted after becoming orphaned; both deletions are queued, and a repository scan finds no remaining reference.

Full diffs for every file in Batch A and Batch B are available via `git diff HEAD -- <path>` for each path listed above — read them directly from disk rather than trusting this summary; this packet is not proof.

## Runtime Boundary And Mock Audit - Specific Questions

This is exactly the failure category (parent layout / duplicate boundary / mocked-away production behavior) your Round 5 verdict's own "Runtime Boundary Check" section said was sound, before Codex found it wasn't. Please scrutinize particularly hard:

1. Confirm MapScreen and NearbyScreen are now the ONLY two production call sites requesting foreground location permission, and that neither one, nor any other screen/provider/layout in the app, still imports `useDeniedLocationState` or independently calls `Location.requestForegroundPermissionsAsync()`.
2. `useCurrentPosition`'s `retry()` re-runs the effect via an `attempt` counter. Confirm React's dependency-change cleanup sets the prior effect's `active` flag false before the next attempt, preventing a stale superseded attempt from overwriting newer state.
3. `MapScreen.test.tsx` now drives the real hook through `expo-location` mocks rather than mocking the hook directly — confirm this test genuinely exercises the production hook composition (no residual second mock reintroducing a hidden boundary).
4. Confirm `nearby.test.tsx`'s `Linking.openSettings` mock is asserted for call behavior, not just presence, and that it does not call a real OS API under Jest.

## Claim And State Audit - Specific To This Packet

- `.planning/project-audit-2026-07-09.md`'s "Remediation Update - 2026-07-10" section now claims both Codex Round 5 and Round 6 findings are fixed, references 46 suites / 389 tests, and that "Map now uses the real shared hook as its sole permission boundary." Independently verify this claim against `index.tsx`, `nearby.tsx`, and the deleted-hook paths rather than accepting the doc's word.
- `.beads/context/execution-state.md` and `.planning/STATE.md` — confirm they do not still direct a recovery agent to redo any earlier batch and correctly describe the gate as open pending this Round 8 pair.
- The ACL forward migration `20260710121534` remains local/undeployed exactly as your Round 5 verdict already noted — confirm nothing in this batch silently deployed it or changed that status.

## Local Verification Evidence (Claude-run, re-verify independently)

- `npm run typecheck` in `app/`: exit 0, no errors.
- `npm run lint` in `app/`: exit 0; 0 errors, 30 disclosed pre-existing warnings, none new.
- `npm run test:coverage -- --runInBand` in `app/`: 46/46 suites, 389/389 tests, 100% coverage on `features/**`/`lib/**`, clean process exit, 34.6s. The count decreased only because the orphaned hook's one suite/three tests were deleted.
- `node --test .claude/hooks/check-review-artifacts.test.js`: 15/15 pass, including stale-approval invalidation after changed queued bytes are re-staged.
- `git diff --cached --check`: exit 0; staged scope hash is the fingerprint above.
- pgTAP still not executed locally (no Docker) — unchanged tracked override.
- No live Supabase push, no device UAT performed.

## Required Verdict Format (from ANTIGRAVITY.md)

```md
## Antigravity Review - [change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

scope_hash: sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d

### Reviewed Queue
- List every queued file inspected for this verdict.

### Issues
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, and required fix.

### Concerns
- Architectural or logic concerns that may need follow-up.

### Verification
- Commands run and results, or why verification was not run.

### Runtime Boundary Check
- Call-path and mock-boundary assessment, including any production behavior not covered by tests.

### Claim And State Audit
- Material packet claims independently confirmed or contradicted, plus active-state/handoff consistency.

### Approved
- What is correct and ready.
```

Before APPROVE, confirm (per ANTIGRAVITY.md): every queued file was semantically inspected, not merely named; every material packet claim above was checked against repository evidence; active state/handoff artifacts agree with actual work; mocked tests are not presented as proof of production behavior. Write your verdict to `.claude/antigravity-review-latest.md`, labeled `Round 8`, repeat the exact `scope_hash` line above, and print it.
