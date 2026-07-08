---
phase: 04-gps-service-submission
plan: 05
subsystem: ui
tags: [react-hook-form, zod, react-native, expo-location]

requires:
  - phase: 04-gps-service-submission
    provides: 04-03's useGpsSample/submitLocation/submitSchema client building blocks
provides:
  - SubmitFlow 3-step wizard (app/src/app/(tabs)/submit.tsx) — auth gate, Step 1/2/3, Success screen
  - SensitivityConfirmModal (D-15 confirm-before-submit dialog)
affects: [04-06]

tech-stack:
  added: []
  patterns:
    - "Accessible status indicators (good/poor GPS accuracy) use text glyphs (checkmark/warning) as siblings of locked copy, not an icon library — this project has no @expo/vector-icons or similar dependency; map pins use Mapbox SymbolLayer, not React icon components."

key-files:
  created:
    - app/src/app/(tabs)/submit.tsx
    - app/src/app/(components)/SensitivityConfirmModal.tsx
    - app/src/app/__tests__/(tabs)/submit.test.tsx

key-decisions:
  - "Test file placed at app/src/app/__tests__/(tabs)/submit.test.tsx (mirror-dir convention matching all 14 existing app tests), not the plan's literal app/src/app/(tabs)/__tests__/ path."
  - "Device walkthrough (Task 3) deferred as a tracked device-UAT item — no physical device available in this environment, consistent with Phase 3's 7 already-deferred device-UAT items and workflow.human_verify_mode=end-of-phase default. Recorded, not silently skipped; will surface in the phase's end-of-phase HUMAN-UAT.md."

patterns-established: []

requirements-completed: [REQ-SUBMIT, REQ-SENSITIVITY, REQ-TIMING, REQ-CODE-WRITE]

duration: ~50min
completed: 2026-07-08
---

# Phase 4: GPS Service & Submission — Plan 04-05 Summary

**3-step SubmitFlow wizard (auth gate, sensitivity toggle + confirm dialog, conditional PIN, live GPS confirm, Success screen) — composed from 04-03's tested building blocks, no reimplementation.**

## Performance

- **Tasks:** 2 of 3 automated (Task 3 is a device-only checkpoint, deferred — see below)
- **Files modified:** 3

## Accomplishments
- Whole wizard is auth-gated from the start (D-18) — signed-out users see `AuthRequiredModal`, the form never mounts.
- Step 1: name, D-04 free-text/autocomplete-toggle address affordance, policy tag picker, accessibility checkboxes, D-13 sensitivity `Switch` + D-12 explainer.
- Step 2: hours, D-17 conditional PIN field (D-19 locked copy), timing tip.
- Step 3: live GPS accuracy readout, ERR-01/02/03 error states, 56pt CTA gated on valid GPS.
- D-15 sensitivity confirmation dialog fires before final submit when the toggle is ON.
- Success screen ("Location Submitted!" / "Back to Map" per locked copy).
- All LOCKED copy from 04-UI-SPEC.md used verbatim; Component Acceptance Checklist static checks (no raw hex, no inline fontSize) pass.

## Task Commits

1. **Task 1: Wizard scaffold + Step 1 + Step 2 + sensitivity dialog** - `08b786c` (feat)
2. **Task 2: Step 3 GPS confirm + submit wiring + Success screen** - `9a4c9f7` (feat)
3. **Task 3: Device walkthrough** - DEFERRED (see Deviations)

## Files Created/Modified
- `app/src/app/(tabs)/submit.tsx` - the full 3-step wizard (replaces the Phase 3 placeholder)
- `app/src/app/(components)/SensitivityConfirmModal.tsx` - D-15 confirm-before-submit dialog
- `app/src/app/__tests__/(tabs)/submit.test.tsx` - 11 tests, all green

## Decisions Made
- No deviation from D-04/D-05/D-08/D-12/D-13/D-15/D-17/D-18/D-19 decisions locked in 04-CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — environment setup] Worktree had no `node_modules`**
- **Found during:** Task 1 setup
- **Issue:** Fresh git worktree has no installed dependencies; jest/tsc cannot run.
- **Fix:** Created a git-ignored directory junction to the main repo's already-vetted `app/node_modules` install. No package installed, no network access, no tracked-file impact.
- **Verification:** `npm test` and `npx tsc --noEmit` both run successfully from the worktree.

**2. [Design-system adaptation] No icon library in this project**
- **Found during:** Task 2 (Step 3 GPS accuracy status indicators)
- **Issue:** design-system.md §18.4 requires color+icon+text pairing (WCAG 1.4.1) for status indicators, but this project has no `@expo/vector-icons` or similar dependency (confirmed via grep — zero Ionicons usage anywhere; map pins render via Mapbox `SymbolLayer`, not React icon components), and installing a new package is out of scope for this plan (Rule 3 exclusion).
- **Fix:** Used accessible text glyphs (✓ good / ⚠ poor/error) as siblings of the locked copy — satisfies the same color+icon+text redundancy requirement without a new dependency.
- **Files modified:** `app/src/app/(tabs)/submit.tsx`
- **Verification:** Manual review against design-system.md §18.4 intent; no new package in `package.json`.

**3. [Path — project convention] Test file location**
- **Found during:** Task 1
- **Issue:** Plan's `files_modified` listed `app/src/app/(tabs)/__tests__/submit.test.tsx`, but all 14 existing `app/src/app/__tests__/**` tests use a mirror-dir convention (`app/src/app/__tests__/(tabs)/*.test.tsx`), not co-located `__tests__` folders per route group.
- **Fix:** Placed the test at `app/src/app/__tests__/(tabs)/submit.test.tsx`, matching the established codebase convention over the plan's literal path.
- **Verification:** Test discovered and run correctly by the existing jest config; matches sibling test files exactly.

---

**Total deviations:** 3 auto-fixed (1 environment setup, 1 design-system adaptation, 1 path convention). No scope creep — all necessary for correctness/consistency, not new features.

## Issues Encountered

**Task 3 device walkthrough — DEFERRED, not performed.** Real GPS accuracy readings, OS permission prompts, and the Android mock-location detection path cannot be exercised in jest — this is a device-only verification, and no physical device is available in this development environment. Consistent with Phase 3's precedent (7 device-UAT items already deferred there) and this project's `workflow.human_verify_mode = end-of-phase` default, this item is recorded as a tracked, deferred device-UAT item rather than silently skipped or faked. It will surface in `04-HUMAN-UAT.md` / `04-VERIFICATION.md` at end-of-phase verification. The manual walkthrough steps (auth gate, sensitivity toggle + explainer, conditional PIN, live accuracy gating, D-15 confirm dialog, Success screen, Component Acceptance Checklist §20) are documented in `04-05-PLAN.md`'s Task 3 for whenever a device becomes available.

**Known scope gap (not a defect):** Step 1 renders accessibility checkboxes (Changing table, Wheelchair) per the UI-SPEC's surface inventory, but their values are captured as local component state only and are **not forwarded on submit** — `submit_location` (04-01) and `SubmitInput`/`submitSchema` (04-03) expose no accessibility-tag parameters this phase. No data is silently lost (nothing was ever submittable through this path); wiring these fields is deferred to whichever future phase extends the schema to carry them.

## User Setup Required
None.

## Next Phase Readiness
- 04-06 (pending-pin map layer + PendingStatusSheet + door-code UI) can now proceed independently — it doesn't depend on 04-05's wizard, only on 04-02/04-04's RPCs.
- **Device-UAT backlog for end-of-phase verification:** SubmitFlow wizard walkthrough (this plan) — see `04-05-PLAN.md` Task 3 for exact steps.

---
*Phase: 04-gps-service-submission*
*Completed: 2026-07-08*
