# Phase 04 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are outside the current plan's scope.

## Flaky test: `app/src/app/__tests__/(tabs)/nearby.test.tsx`

- **Found during:** 04-04 execution (full-suite verification run).
- **Symptom:** Intermittent single-test failure (`await findByText('High Confidence Cafe')`)
  under full-suite parallel load. Passes 14/14 when the `nearby` tests run in isolation,
  and the full suite passed 343/343 on immediate rerun.
- **Root cause (suspected):** async `findByText` timeout under parallel jest worker
  contention — a test-isolation/timing flake, not a product defect.
- **Why deferred:** Pre-existing file, unrelated to the 04-04 submit service modules
  (`useMyPendingSubmissions` / `withdrawSubmission` / `updateAccessCode`). Out of scope
  per the executor scope boundary.
- **Suggested follow-up:** Stabilize the assertion (increase `findBy` timeout or await the
  loading state deterministically) in a dedicated maintenance task.
