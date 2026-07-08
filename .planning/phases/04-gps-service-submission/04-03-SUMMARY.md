---
phase: 04-gps-service-submission
plan: 03
subsystem: ui
tags: [expo-location, zod, react-native, tdd]

requires:
  - phase: 04-gps-service-submission
    provides: 04-01's submit_location RPC signature and live schema
provides:
  - useGpsSample hook (high-accuracy GPS sample, mock/accuracy/timestamp, {denied:true} sentinel)
  - submitLocation RPC client wrapper (D-09 sensitivity mapping, D-17 conditional PIN)
  - submitSchema Zod validation (required name/policyTag, D-05 label-only address, conditional PIN guard)
affects: [04-04, 04-05]

tech-stack:
  added: []
  patterns:
    - "Generated Supabase RPC Args types mark SQL-defaulted params as optional (no `| null`) and required-but-nullable params as non-nullable — use `?? undefined` for the former (omitting the key triggers the SQL default) and a targeted cast for the latter, rather than passing explicit `null`."

key-files:
  created:
    - app/src/features/submit/types.ts
    - app/src/features/submit/useGpsSample.ts
    - app/src/features/submit/submitLocation.ts
    - app/src/features/submit/submitSchema.ts
    - app/src/features/submit/__tests__/useGpsSample.test.ts
    - app/src/features/submit/__tests__/submitLocation.test.ts
    - app/src/features/submit/__tests__/submitSchema.test.ts

key-decisions:
  - "submit_location RPC args use `undefined` (not `null`) for every SQL-defaulted optional param — matches the generated Args type and is runtime-equivalent (omitting a key triggers the same NULL default)."

patterns-established:
  - "RPC arg type friction pattern documented inline in submitLocation.ts for future RPC wrapper modules (updateAccessCode, confirmAccessCode in 04-04) to follow the same convention."

requirements-completed: [REQ-GPS-VALIDATE, REQ-SUBMIT, REQ-SENSITIVITY, REQ-TIMING]

duration: ~1h10m (across original executor dispatch + orchestrator-completed recovery after a stall)
completed: 2026-07-08
---

# Phase 4: GPS Service & Submission — Plan 04-03 Summary

**Client submission service layer: high-accuracy GPS hook, `submit_location` RPC wrapper, and Zod validation schema for the SubmitFlow wizard — all TDD test-first at 100% coverage.**

## Performance

- **Tasks:** 3 (useGpsSample + types, submitLocation, submitSchema)
- **Files modified:** 7 (4 source, 3 test)

## Accomplishments
- `useGpsSample` requests `Accuracy.BestForNavigation`, normalizes iOS `mocked: undefined` → `false`, and returns a `{denied: true}` sentinel on permission denial (never throws).
- `submitLocation` maps `sensitive` → `'sensitive' | undefined` (D-09) and forwards `accessCode` only when `policyTag === 'code_required'` (D-17), rethrowing raw RPC errors unchanged so the wizard (04-05) owns error-copy mapping.
- `submitSchema` enforces required name/policyTag, treats `address` as label-only/optional (D-05), and flags `accessCode` via `superRefine` if present under a non-`code_required` tag.

## Task Commits

1. **Task 1: useGpsSample hook + types.ts (test-first)** - `33e3327` (feat)
2. **Task 2: submitLocation RPC wrapper (test-first)** - `cb98e54` (feat)
3. **Task 2 fix: use `undefined` not `null` for optional RPC args** - `eb3aa74` (fix)
4. **Task 3: submitSchema Zod validation (test-first)** - `9cd6564` (feat)

## Files Created/Modified
- `app/src/features/submit/types.ts` - `GpsSample`, `GpsDenied`, `SubmitInput` shapes
- `app/src/features/submit/useGpsSample.ts` - high-accuracy GPS sample hook
- `app/src/features/submit/submitLocation.ts` - `submit_location` RPC wrapper
- `app/src/features/submit/submitSchema.ts` - SubmitFlow Zod schema
- `app/src/features/submit/__tests__/*.test.ts` - 3 test files, all green at 100% coverage

## Decisions Made
- No deviation from D-04/D-05/D-09/D-17/D-19/D-20 decisions locked in 04-CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Correctness — blocking] Generated RPC Args type rejects explicit `null` for optional/nullable params**
- **Found during:** Task 2 (`submitLocation`), post-merge typecheck
- **Issue:** `npx tsc --noEmit` failed with 5 errors — the generated `submit_location` Args type marks SQL-defaulted params (`p_address`, `p_access_sensitivity`, `p_access_code`, `p_timing_tip`) as optional (`?:`, no `| null`), and `p_accuracy_m` (no SQL default) as required `number` with no `| null`, even though the RPC body explicitly checks `p_accuracy_m is null`.
- **Fix:** Changed the four SQL-defaulted fields from `?? null` to `?? undefined` (omitting the key triggers the same NULL default at the DB level — runtime-equivalent); added a targeted, commented cast for `p_accuracy_m` since it's genuinely nullable at runtime but not modeled that way for required args by the type generator.
- **Files modified:** `app/src/features/submit/submitLocation.ts`, `app/src/features/submit/__tests__/submitLocation.test.ts` (updated assertions from `null` to `undefined`)
- **Verification:** `npx tsc --noEmit` clean; full jest suite green (328/328).
- **Committed in:** `eb3aa74`

---

**Total deviations:** 1 auto-fixed (1 blocking type-correctness issue). No scope creep.

## Issues Encountered

**Executor stall (recovered in-place):** The original executor dispatch for this plan stalled with "no progress for 600s" mid-Task-2, after Task 1 (`useGpsSample`) was already cleanly committed. Per the established Phase 3 recovery pattern (verify via `git log`/`git status` in the worktree before discarding), the worktree was inspected, found clean with no uncommitted partial work, and Tasks 2–3 were completed in-place by the orchestrator rather than restarting from scratch.

One jest run showed a single flaky timeout in `nearby.test.tsx` (pre-existing, untouched by this plan) while running concurrently with the 04-02 worktree's build/push activity on the same machine — confirmed non-regression by re-running in isolation (passed) and re-running the full suite once 04-02's worktree activity finished (328/328 passed, no failures).

## User Setup Required
None.

## Next Phase Readiness
- 04-04 (pending/code client services) and 04-05 (SubmitFlow wizard UI) can now proceed — both consume `useGpsSample`, `submitLocation`, and `submitSchema` as building blocks.

---
*Phase: 04-gps-service-submission*
*Completed: 2026-07-08*
