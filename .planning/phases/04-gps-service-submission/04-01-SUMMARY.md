---
phase: 04-gps-service-submission
plan: 01
subsystem: database
tags: [postgis, supabase, plpgsql, rpc, gps]

requires:
  - phase: 03-read-path-map
    provides: submissions table shape, app_config thresholds pattern, RPC auth-gate/revoke-grant conventions
provides:
  - submissions staging columns (name, coordinates, address, policy_tag, access_sensitivity, hours, access_instructions, access_code_confirmed_at, timing_tip)
  - submit_location RPC (server-authoritative GPS validation + pending-row insert, confirmation_count=1)
  - get_my_pending_submissions RPC (auth.uid()-scoped pending pins)
  - withdraw_submission RPC (owner-only pending-row delete)
affects: [04-02, 04-03, 04-04, 04-06]

tech-stack:
  added: []
  patterns:
    - "PostGIS types/functions must be schema-qualified (extensions.geography, extensions.st_makepoint, etc.) inside any function with `set search_path = public` — bare references resolve only under a session search_path that happens to include `extensions`, which supabase db push's migration-application session does NOT provide."

key-files:
  created:
    - supabase/tests/phase4_submit.test.sql
    - supabase/migrations/20260707020000_phase4_submission_staging.sql
  modified:
    - app/src/lib/database.types.ts

key-decisions:
  - "Option A (RESEARCH §Pattern 1): pending bathroom data lives ONLY on the submissions row; no locations row created until Phase 5's publish gate."
  - "OQ-2 resolved: confirmation_count=1 on the submissions row is the creator-initial verification event — no verification_events row pre-publish (its location_id FK is NOT NULL and no location exists yet)."
  - "get_my_pending_submissions is a SEPARATE, authed-only RPC — Phase 3's search_locations_bbox/_nearby are untouched, not modified to add a submitter_id JOIN."

patterns-established:
  - "Schema-qualify every PostGIS type/function reference (extensions.geography, extensions.geometry, extensions.st_setsrid, extensions.st_makepoint, extensions.st_x, extensions.st_y, etc.) in any SECURITY DEFINER function that sets `search_path = public`, and in any bare column-type declaration applied via `supabase db push`."

requirements-completed: [REQ-SUBMIT, REQ-GPS-VALIDATE, REQ-PENDING, REQ-SENSITIVITY, REQ-TIMING, REQ-CODE-WRITE]

duration: ~35min (across 2 executor dispatches + orchestrator-completed checkpoint)
completed: 2026-07-07
---

# Phase 4: GPS Service & Submission — Plan 04-01 Summary

**Submission write-path DB layer: 9 staging columns on `submissions` + 3 SECURITY DEFINER RPCs (`submit_location`, `get_my_pending_submissions`, `withdraw_submission`), pushed live with a PostGIS schema-qualification fix.**

## Performance

- **Tasks:** 3 (pgTAP test suite, migration + RPCs, live push + type regen)
- **Files modified:** 3

## Accomplishments
- Resolved the phase's central storage question as Option A: pending submissions never touch `locations`, so Phase 3's five shipped readers cannot leak pending data by construction.
- Server-side GPS validation (`mocked`, accuracy > `max_accuracy_m`, freshness > `max_gps_age_s`) collapses to a single generic `'gps rejected'` error (SC7 — no reason leaked).
- `get_my_pending_submissions` is a new, separate, authed-only RPC — Phase 3's search RPCs were not touched.
- Discovered and fixed a real PostGIS schema-qualification bug that blocked the live push (see Issues Encountered) — this likely also affects already-shipped Phase 3 RPCs; flagged separately to the user, not fixed here.

## Task Commits

1. **Task 1: pgTAP correctness suite (test-first / RED)** - `6b39e40` (test)
2. **Task 2: migration — staging columns + 3 RPCs (GREEN)** - `cb8ddf6` (feat)
3. **Task 2 fix: schema-qualify PostGIS refs as `extensions.*`** - `d2c8648` (fix)
3. **Task 3: live push + type regen** - (this commit)

## Files Created/Modified
- `supabase/tests/phase4_submit.test.sql` - pgTAP suite, 18 assertions (RED, not yet run — no Docker)
- `supabase/migrations/20260707020000_phase4_submission_staging.sql` - staging columns + submit_location/get_my_pending_submissions/withdraw_submission
- `app/src/lib/database.types.ts` - regenerated from live schema post-push

## Decisions Made
- OQ-2: `confirmation_count=1` adopted for the creator-initial verification event, not a literal `verification_events` row (see 04-RESEARCH.md resolution).
- No deviation from D-01..D-30 decisions locked in 04-CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Correctness — blocking] PostGIS types/functions not schema-qualified**
- **Found during:** Task 3 (live push)
- **Issue:** `supabase db push` failed with `type "geography" does not exist`. Root-caused via direct SQL against the live project (Supabase MCP `execute_sql`): the `postgis` extension lives in the `extensions` schema; the role/session default `search_path` includes it, but a session with `search_path` explicitly restricted to `public` (confirmed as the effective context both for `supabase db push`'s migration-application session AND for any function declaring `set search_path = public`) does NOT resolve `geography`/`geometry`/`st_*` by bare name.
- **Fix:** Schema-qualified every PostGIS type and function reference in the migration as `extensions.geography`, `extensions.geometry`, `extensions.st_setsrid`, `extensions.st_makepoint`, `extensions.st_x`, `extensions.st_y`. Verified fix works via direct SQL test against the live DB before re-pushing.
- **Files modified:** `supabase/migrations/20260707020000_phase4_submission_staging.sql`
- **Verification:** `supabase db push` succeeded after the fix; `database.types.ts` regenerated and confirmed to contain the new RPCs and staging columns.
- **Committed in:** `d2c8648`

---

**Total deviations:** 1 auto-fixed (1 blocking correctness bug, caught before it could reach production as a silent runtime failure)
**Impact on plan:** Necessary fix — without it, `submit_location` and `get_my_pending_submissions` would have deployed successfully as functions (plpgsql body isn't validated at CREATE time) but failed at first invocation. No scope creep.

## Issues Encountered

**Cross-phase finding (not fixed in this plan — flagged to user separately):** Phase 3's already-shipped RPCs (`search_locations_bbox`, `search_locations_nearby`, `get_location_detail`) have the identical `set search_path = public` + bare `geography`/`geometry`/`st_*` reference pattern. Direct SQL testing against the live database confirms this pattern fails to resolve PostGIS types/functions under a `search_path=public`-only session. These RPCs have never been exercised against real GPS data (Phase 3's pgTAP suite never ran — no Docker; the 7 device-UAT items are still pending) — so it is plausible they are currently broken in production and this has gone undetected. This is out of scope for Phase 4 to fix silently; it needs its own investigation, fix, and live-push authorization cycle.

Also encountered: an expired Supabase personal access token blocked the first push attempt (`Unauthorized` on both `supabase link` and `supabase projects list`) — resolved when the user provided a fresh token, written to `~/.supabase-gsd-token` (never echoed).

## User Setup Required
None — no external service configuration required beyond the token refresh already completed.

## Next Phase Readiness
- 04-02 (access-code update RPCs) and 04-03 (client submission services) can now proceed — both depend on 04-01's schema being live.
- **Recommend:** investigate whether Phase 3's shipped RPCs have the same PostGIS schema-qualification bug, before trusting the read-path in production. This is a candidate for a small, separate fix-and-push cycle.

---
*Phase: 04-gps-service-submission*
*Completed: 2026-07-07*
