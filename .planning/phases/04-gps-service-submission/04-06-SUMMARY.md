---
phase: 04-gps-service-submission
plan: 06
subsystem: ui
tags: [mapbox, react-native, expo]

requires:
  - phase: 04-gps-service-submission
    provides: 04-04's useMyPendingSubmissions/withdrawSubmission/updateAccessCode client building blocks
provides:
  - Submitter-only pending-pin map layer (separate ShapeSource, RESEARCH Pattern 4)
  - PendingStatusSheet (verification progress, no Rate/Report/Directions)
  - WithdrawConfirmModal (D-30 confirm-before-destructive)
  - LocationDetailSheet "Update door code" stage-then-confirm UI (D-23/D-24)
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - app/src/app/(components)/PendingStatusSheet.tsx
    - app/src/app/(components)/WithdrawConfirmModal.tsx
  modified:
    - app/src/app/(tabs)/index.tsx
    - app/src/app/(components)/LocationDetailSheet.tsx

key-decisions:
  - "Pending pins render via a SEPARATE ShapeSource (id=pendingLocations, gated enabled:!!session), not a change to Phase 3's search RPCs or the existing published-locations ShapeSource — matches RESEARCH Pattern 4."
  - "Device walkthrough (Task 3) deferred as a tracked device-UAT item — no physical device available in this environment, consistent with Phase 3's precedent and plan 04-05's identical deferral earlier in this same phase."

patterns-established: []

requirements-completed: [REQ-PENDING]

duration: ~35min
completed: 2026-07-08
---

# Phase 4: GPS Service & Submission — Plan 04-06 Summary

**Submitter-only pending-pin map layer, PendingStatusSheet with withdraw flow, and a stage-then-confirm "Update door code" UI on the published LocationDetailSheet — the final plan closing out Phase 4.**

## Performance

- **Tasks:** 2 of 3 automated (Task 3 is a device-only checkpoint, deferred — see below)
- **Files modified:** 6

## Accomplishments
- Pending pins are submitter-scoped (`enabled: !!session`) and render via a separate `ShapeSource`, leaving Phase 3's shipped search RPCs and published-location layer completely untouched.
- `PendingStatusSheet` shows dynamic "N of 2 GPS verifications received" progress (D-27) with no Rate/Report/Directions row (it's not a published location yet).
- `WithdrawConfirmModal` implements D-30's confirm-before-destructive pattern; on confirm, the pin disappears from the map entirely (D-29 "as if never submitted").
- `LocationDetailSheet` gained a signed-in-only "Update door code" action implementing D-23/D-24's stage-then-confirm gate — proposing a new code shows a pending-confirmation state, never an immediate overwrite; anonymous users are routed to `AuthRequiredModal`.

## Task Commits

1. **Task 1: Pending-pin map layer + PendingStatusSheet + WithdrawConfirmModal** - `722cb3a` (feat)
2. **Task 2: "Update door code" stage-then-confirm UI on LocationDetailSheet** - `30c44e7` (feat)
3. **Task 3: Device walkthrough** - DEFERRED (see Deviations)

## Files Created/Modified
- `app/src/app/(components)/PendingStatusSheet.tsx` - verification progress + withdraw entry point
- `app/src/app/(components)/WithdrawConfirmModal.tsx` - D-30 confirm dialog
- `app/src/app/(tabs)/index.tsx` - added the submitter-scoped pending-pin `ShapeSource` + tap routing
- `app/src/app/(components)/LocationDetailSheet.tsx` - added the "Update door code" stage-then-confirm action

## Decisions Made
- No deviation from D-23/D-24/D-26/D-27/D-28/D-29/D-30 decisions locked in 04-CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test path convention**
- **Found during:** Task 1
- **Issue:** Plan listed test paths under `app/src/app/(components)/__tests__/`, but the established project convention (matching every sibling component test, and the same convention already applied in 04-05) places tests at `app/src/app/__tests__/(components)/`.
- **Fix:** Placed `PendingStatusSheet.test.tsx` and `LocationDetailSheet.updateCode.test.tsx` at the conventional mirror-dir location so imports resolve and jest discovers them consistently with the rest of the suite.
- **Verification:** Both test files run and pass under the existing jest config.

**2. [Rule 3 — Blocking] Import-chain breakage in existing suites**
- **Found during:** Task 1/2 (adding `useSession` to `index.tsx` and `LocationDetailSheet.tsx`)
- **Issue:** Wiring in `useSession` pulled `SessionProvider → supabase → AsyncStorage` into two existing test suites (`MapScreen.test.tsx`, `LocationDetailSheet.test.tsx`), breaking them at import time.
- **Fix:** Added local `useSession` (and `useMyPendingSubmissions`/`updateAccessCode`) mocks to restore both suites, plus new wiring assertions in `MapScreen.test.tsx` covering the pending query's disabled-when-anon / enabled-when-signed-in states and sheet mounting with `submission: null`.
- **Files modified:** `app/src/app/__tests__/(tabs)/MapScreen.test.tsx`, `app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx`
- **Verification:** Full jest suite green (47 suites, 378 tests); `npx tsc --noEmit` clean.

---

**Total deviations:** 2 auto-fixed (1 path convention, 1 import-chain test fix). No scope creep — both necessary for correctness/consistency, not new features.

## Issues Encountered

**Task 3 device walkthrough — DEFERRED, not performed.** Native Mapbox pin rendering, submitter-scoped visibility across accounts, and real-device withdraw/code-update flows cannot be exercised in jest, and no physical device or simulator is available in this development environment. Consistent with Phase 3's precedent, plan 04-05's identical deferral earlier in this same phase, and this project's `workflow.human_verify_mode = end-of-phase` default, this item is recorded as a tracked, deferred device-UAT item rather than silently skipped or faked. It will surface in `04-HUMAN-UAT.md` / `04-VERIFICATION.md` at end-of-phase verification. The manual walkthrough steps (pending pin visibility/scoping, withdraw confirm-and-disappear, door-code update signed-out/signed-in states, Component Acceptance Checklist §20) are documented in `04-06-PLAN.md`'s Task 3.

## User Setup Required
None.

## Next Phase Readiness
- This is the last plan in Phase 4 — all 6 plans (04-01 through 04-06) are now complete.
- **Device-UAT backlog for end-of-phase verification (2 items, both from this phase):** SubmitFlow wizard walkthrough (04-05) and pending-pin/withdraw/code-update walkthrough (this plan, 04-06). Both documented with exact steps in their respective PLAN.md Task 3 sections.
- **Carryover risk:** Phase 3's pgTAP suite has never run (no Docker); Phase 4 adds 2 more pgTAP suites (`phase4_submit.test.sql`, `phase4_access_code.test.sql`) with the same tracked no-Docker override.

---
*Phase: 04-gps-service-submission*
*Completed: 2026-07-08*
