---
phase: 04-gps-service-submission
plan: 04
subsystem: api
tags: [supabase, rpc, geojson, react-native, tanstack-query, access-code, pending-submissions]

# Dependency graph
requires:
  - phase: 04-gps-service-submission (04-01)
    provides: get_my_pending_submissions + withdraw_submission RPCs (server-scoped by auth.uid())
  - phase: 04-gps-service-submission (04-02)
    provides: update_access_code / confirm_access_code / get_access_code stage-then-confirm RPCs + D-24 gate
  - phase: 03 (locations)
    provides: LocationFeatureCollection GeoJSON shapes + useLocationsBbox RPC→FeatureCollection transform analog
provides:
  - useMyPendingSubmissions — authed-only pending-pin query → GeoJSON carrying verification progress
  - withdrawSubmission — withdraw_submission RPC wrapper (caller-scoped, raw-error rethrow)
  - updateAccessCode / confirmAccessCode / getAccessCode — stage-then-confirm client wrappers
  - Pending* GeoJSON transform types (submit/types.ts)
affects: [04-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RPC→FeatureCollection transform mirrored from useLocationsBbox for a second (pending) map source"
    - "Thin supabase.rpc wrappers (deleteAccount/updateProfile shape) with raw-error rethrow and no client-side navigation/refetch"

key-files:
  created:
    - app/src/features/submit/useMyPendingSubmissions.ts
    - app/src/features/submit/withdrawSubmission.ts
    - app/src/features/submit/updateAccessCode.ts
    - app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts
    - app/src/features/submit/__tests__/withdrawSubmission.test.ts
    - app/src/features/submit/__tests__/updateAccessCode.test.ts
  modified:
    - app/src/features/submit/types.ts

key-decisions:
  - "useMyPendingSubmissions returns a pending-specific FeatureCollection (PendingSubmissionFeatureCollection) rather than the published LocationFeatureCollection, so properties can carry confirmationCount + expiresAt (D-27) without polluting the Phase 3 published-pin property type."
  - "get_my_pending_submissions is called with NO arguments — scoping is entirely server-side (auth.uid()); no client-side 'my submissions' filter (T-04-14)."

patterns-established:
  - "Pending map layer: separate PendingSubmission* GeoJSON types feed a second ShapeSource (04-06), coordinates in [lng, lat] GeoJSON order."
  - "Access-code wrappers are transport-only: stage (update) vs promote (confirm) are distinct calls; the different-user gate stays server-side (T-04-15) and no code value is logged (T-04-16)."

requirements-completed: [REQ-PENDING, REQ-CODE-WRITE]

# Metrics
duration: ~20min
completed: 2026-07-08
---

# Phase 4 Plan 04: Pending-Submission & Access-Code Service Layer Summary

**Client service layer for the pending-pin map source, submission withdrawal, and the stage-then-confirm access-code (PIN) flow — three test-first Supabase RPC modules at 100% coverage.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-08T07:40:00Z (approx)
- **Completed:** 2026-07-08T07:59:33Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- `useMyPendingSubmissions` fetches the signed-in user's pending submissions via the no-arg `get_my_pending_submissions` RPC and transforms rows into a GeoJSON FeatureCollection whose features carry `confirmationCount` + `expiresAt` (D-27, no refetch), coordinates in `[lng, lat]` order.
- `withdrawSubmission` issues the caller-scoped `withdraw_submission` RPC and rethrows raw errors — no navigation/refetch inside (caller invalidates `['pendingSubmissions', uid]`).
- `updateAccessCode` / `confirmAccessCode` / `getAccessCode` deliver the D-21/D-24 stage-then-confirm wrappers; the promotion gate stays server-side and no code value is logged.
- All three modules test-first (RED → GREEN), each at 100% coverage; `tsc --noEmit` clean; full suite 343/343 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: useMyPendingSubmissions query → GeoJSON** - `56c1709` (feat)
2. **Task 2: withdrawSubmission wrapper** - `91227d6` (feat)
3. **Task 3: update/confirm/get access-code wrappers** - `1d349c6` (feat)

_TDD: each task was written test-first (failing test confirmed RED) then implemented to GREEN; test + implementation committed together per task._

## Files Created/Modified
- `app/src/features/submit/useMyPendingSubmissions.ts` - no-arg pending query → PendingSubmissionFeatureCollection
- `app/src/features/submit/withdrawSubmission.ts` - withdraw_submission one-arg wrapper
- `app/src/features/submit/updateAccessCode.ts` - update/confirm/get access-code wrappers
- `app/src/features/submit/types.ts` - added PendingSubmissionRpcRow / PendingSubmissionProperties / PendingSubmissionFeature / PendingSubmissionFeatureCollection
- `app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts` - 6 tests (no-arg call, [lng,lat], properties, empty/null, error)
- `app/src/features/submit/__tests__/withdrawSubmission.test.ts` - 3 tests (arg mapping, void resolve, raw rethrow)
- `app/src/features/submit/__tests__/updateAccessCode.test.ts` - 6 tests (arg mapping + raw rethrow for all three)

## Decisions Made
- **Pending-specific FeatureCollection type:** `useMyPendingSubmissions` returns `PendingSubmissionFeatureCollection` (new type in submit/types.ts) rather than the Phase 3 `LocationFeatureCollection`. The published property type carries `confidenceTier`/`verificationCount`/etc.; the pending sheet instead needs `confirmationCount` + `expiresAt`. A pending-specific type keeps both surfaces honest and avoids mutating the Phase 3 published-pin types (plan explicitly authorized extending submit/types.ts for this). The shape mirrors `LocationFeatureCollection` so the map's second `ShapeSource` (04-06) transforms identically.
- **No-arg RPC call:** `get_my_pending_submissions` is invoked with a single positional argument (name only). Scoping is server-side; no client filter is applied (T-04-14).

## Deviations from Plan

None - plan executed exactly as written. RPC arg types (per the 04-03 friction note) required no `?? undefined` / cast workarounds here: `update_access_code` (`p_code`, `p_location_id`), `confirm_access_code`/`get_access_code` (`p_location_id`), and `withdraw_submission` (`p_submission_id`) are all required, non-nullable string args with no SQL-default optionality, so straightforward mapping typechecked clean.

## Issues Encountered

- **Worktree lacked `node_modules`:** created a directory junction from `app/node_modules` to the main repo's `node_modules` (git-ignored) so jest/tsc could run. No source or tracked-file impact.
- **Flaky pre-existing test (out of scope):** `app/src/app/__tests__/(tabs)/nearby.test.tsx` failed once on a full-suite run (`findByText` async timeout under parallel load) but passed 14/14 in isolation and the full suite passed 343/343 on rerun. Unrelated to the 04-04 submit modules. Logged to `deferred-items.md` for a later stabilization task.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 04-06 (UI) can now wire: the pending map `ShapeSource` + pending-status sheet (`useMyPendingSubmissions` → `confirmationCount`/`expiresAt`), the destructive Withdraw button (`withdrawSubmission`), and the "Update door code" stage-then-confirm UI (`updateAccessCode` → `confirmAccessCode`, `getAccessCode` for the authed current-code read).
- No blockers.

---
*Phase: 04-gps-service-submission*
*Completed: 2026-07-08*
