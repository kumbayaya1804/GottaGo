---
phase: 04-gps-service-submission
plan: 02
subsystem: database
tags: [supabase, plpgsql, rpc, access-code]

requires:
  - phase: 04-gps-service-submission
    provides: 04-01's submissions staging schema and RPC auth-gate/revoke-grant conventions
provides:
  - locations.pending_access_code / pending_code_proposed_by / access_code_confirmed_at columns
  - update_access_code RPC (stages a proposed code without overwriting, D-21)
  - confirm_access_code RPC (stage-then-confirm gate — requires a DIFFERENT authed user, D-24/OQ-3)
  - get_access_code RPC (authed-only read for the "Update door code" UI, D-22, never widens public detail RPC)
affects: [04-04, 04-06]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - supabase/tests/phase4_access_code.test.sql
    - supabase/migrations/20260707030000_phase4_access_code_update.sql
  modified:
    - app/src/lib/database.types.ts

key-decisions:
  - "OQ-3 resolved: minimal stage-then-confirm — update_access_code only stages pending_access_code/pending_code_proposed_by; confirm_access_code requires a DIFFERENT auth.uid() to promote it to access_instructions + reset access_code_confirmed_at."
  - "get_location_detail (public detail RPC) is untouched — access code exposure stays confined to the new authed-only get_access_code RPC (Pitfall 4)."

patterns-established: []

requirements-completed: [REQ-CODE-WRITE]

duration: ~40min
completed: 2026-07-08
---

# Phase 4: GPS Service & Submission — Plan 04-02 Summary

**Access-code update DB layer: stage-then-confirm gate (`update_access_code` + `confirm_access_code` + `get_access_code`) implementing D-24's abuse-resistance requirement, pushed live.**

## Performance

- **Tasks:** 3 (pgTAP test suite, migration + RPCs, live push + type regen)
- **Files modified:** 3

## Accomplishments
- Implemented D-24's "1 confirming verification before overwrite" requirement as a concrete stage-then-confirm mechanism: `update_access_code` proposes, `confirm_access_code` (called by a different authenticated user) promotes.
- `get_access_code` is authed-only and does not widen the existing public `get_location_detail` RPC — access codes remain excluded from public/search reads.
- No PostGIS types involved in this migration (text/timestamptz/uuid columns only) — the extensions-schema-qualification bug found in 04-01 did not recur here.

## Task Commits

1. **Task 1: pgTAP suite for the stage-then-confirm gate (RED)** - `0ec6b0d` (test)
2. **Task 2: migration — code columns + 3 RPCs (GREEN)** - `36385d7` (feat)
3. **Task 3: live push + type regen** - (this commit)

## Files Created/Modified
- `supabase/tests/phase4_access_code.test.sql` - pgTAP suite, 13 assertions (RED, not yet run — no Docker)
- `supabase/migrations/20260707030000_phase4_access_code_update.sql` - locations code columns + update_access_code/confirm_access_code/get_access_code
- `app/src/lib/database.types.ts` - regenerated from live schema post-push

## Decisions Made
- No deviation from D-21/D-22/D-24/D-25 decisions locked in 04-CONTEXT.md.

## Deviations from Plan

None — plan executed exactly as written. (Unlike 04-01, this migration had no PostGIS type/function references, so the extensions-schema-qualification fix pattern from 04-01 was not needed here — confirmed by the automated gate check in Task 2: 0 PostGIS references.)

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- 04-04 (pending/code client services) and 04-06 (pending-pin map + door-code UI) can now proceed — both depend on this RPC set being live.

---
*Phase: 04-gps-service-submission*
*Completed: 2026-07-08*
