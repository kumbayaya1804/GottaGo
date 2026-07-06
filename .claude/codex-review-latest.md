# Codex Review - Phase 3 Read Path & Map Plans

**VERDICT: REQUEST CHANGES**

## Summary

The Phase 3 plan set is close: the wave ordering is coherent, the server-side moderation/family_mode boundary is mostly in the right layer, and the test plan correctly separates SQL/RPC correctness from React Native rendering checks. I would not start Wave 1 yet because two requirements are currently planned in a way that will fail later waves: the `family_mode` toggle writes through an RPC signature that cannot support family-mode-only calls, and the denied-GPS/manual-search flow no longer has a real city/address search mechanism despite the roadmap and UI spec still requiring one. There is also a medium configuration gap around `max_pins_per_viewport` being seeded but not actually used as the tunable source of truth.

## Reviewed Files

- `.claude/codex-prompt-latest.md`
- `CODEX.md`
- `CLAUDE.md`
- `docs/agent-harness.md`
- `docs/review-severity.md`
- `docs/stale-info-scan.md`
- `.planning/stale-info-scan-latest.md`
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/phases/03-read-path-map/03-CONTEXT.md`
- `.planning/phases/03-read-path-map/03-RESEARCH.md`
- `.planning/phases/03-read-path-map/03-PATTERNS.md`
- `.planning/phases/03-read-path-map/03-VALIDATION.md`
- `.planning/phases/03-read-path-map/03-UI-SPEC.md`
- `.planning/phases/03-read-path-map/03-01-PLAN.md`
- `.planning/phases/03-read-path-map/03-02-PLAN.md`
- `.planning/phases/03-read-path-map/03-03-PLAN.md`
- `.planning/phases/03-read-path-map/03-04-PLAN.md`
- `.planning/phases/03-read-path-map/03-05-PLAN.md`
- `app/src/features/auth/gpsConsent.ts`
- `app/src/features/profile/updateProfile.ts`
- `supabase/migrations/20260627000004_profile_rpcs.sql`

## Strengths

- The security-critical read boundary is correctly assigned to SQL RPCs: all three read RPCs are planned to enforce `deleted_at is null`, `suppressed_at is null`, `shadowban_status = false`, and server-derived `family_mode` via `auth.uid()` instead of client filtering (`03-01-PLAN.md:161-165`, `03-01-PLAN.md:173-178`).
- The plan explicitly avoids `setof locations`, `select l.*`, and `access_instructions` in new public read RPCs, which addresses the highest-risk column-leak path from the existing radius RPC (`03-01-PLAN.md:164-171`).
- The wave dependency chain is mostly sound: 03-01 creates RPCs/types, 03-02 builds tested data contracts, 03-03/04/05 consume those contracts in screens (`03-02-PLAN.md:93-127`, `03-03-PLAN.md:81-98`, `03-04-PLAN.md:68-85`, `03-05-PLAN.md:67-82`).
- The validation plan hits the right layers: pgTAP for moderation/family_mode/access-code/nearest-N RPC behavior, Jest for mapping and state, and device verification for Mapbox, bottom-sheet gestures, screen reader output, and filter/permission behavior (`03-VALIDATION.md:41-54`, `03-VALIDATION.md:79-85`).

## Concerns

- **[HIGH] `update_profile` cannot support the planned family-mode-only write.** Plan 03-01 replaces `update_profile` with `update_profile(new_display_name text, new_family_mode boolean default null)` and keeps `display_name = new_display_name` (`03-01-PLAN.md:166`, `03-01-PLAN.md:179`). But Plan 03-02 defines `setFamilyMode(value)` as `supabase.rpc('update_profile', { new_family_mode: value })` (`03-02-PLAN.md:200`, `03-02-PLAN.md:204`), and Plan 03-04 wires the Settings switch through that family-mode-only call (`03-04-PLAN.md:128-135`). PostgREST will not have the required `new_display_name` argument for that call, or the implementation will risk clearing `display_name` if it later defaults to null without coalescing. This breaks ROADMAP SC12 before the toggle can work. Required fix: make both fields optional in the RPC contract (`new_display_name text default null, new_family_mode boolean default null`) and update with `display_name = coalesce(new_display_name, display_name)` plus `family_mode = coalesce(new_family_mode, family_mode)`, or create a dedicated authenticated `set_family_mode` RPC. Add SQL/client tests that prove a family-mode-only call changes only `family_mode`, and a display-name-only call still works.

- **[HIGH] The denied-GPS "manual city/address search" requirement is not actually planned.** PROJECT requires searching bathrooms in any city/area with manual city/address search when GPS is denied (`.planning/PROJECT.md:29-32`), ROADMAP repeats that Phase 3 requirement and SC6 (`.planning/ROADMAP.md:117-126`), and the UI spec's locked GPS-denied state says the map opens to manual city/address search with Google Places and an active focused search bar (`03-UI-SPEC.md:127`). Plan 03-05 instead says no Google Places or external geocoding dependency, and that denied mode "recenters/keeps the last viewport and relies on pan + Search this area" (`03-05-PLAN.md:76-77`, `03-05-PLAN.md:98`, `03-05-PLAN.md:128`). That is a pan-and-refetch fallback, not a city/address search. Required fix: either implement a minimal address/city resolution contract in Phase 3, including key management, privacy/logging constraints, empty/error states, and tests, or explicitly revise PROJECT/ROADMAP/UI-SPEC before review so the phase no longer claims city/address search.

- **[MEDIUM] `max_pins_per_viewport` is seeded but not used as the authoritative tunable.** The plan says `app_config.max_pins_per_viewport` is the bbox RPC limit source (`03-01-PLAN.md:34`, `03-01-PLAN.md:62-65`, `03-01-PLAN.md:135`), but the actual RPC contract still accepts `max_pins integer default 200` and applies `limit max_pins` (`03-01-PLAN.md:162`), while the client hook passes `max_pins` (`03-02-PLAN.md:168`). The pgTAP item only checks that bbox respects a passed max, not that changing `app_config` changes server behavior (`03-01-PLAN.md:196`). This undercuts D-32's admin-tunable requirement. Required fix: have the RPC resolve the cap from `app_config` server-side when no lower caller limit is intended, clamp any caller-provided limit defensively, and add a test that updates `app_config` then observes the changed cap.

- **[MEDIUM] The current-position source for map/detail/Nearby distance is under-specified and partially misidentified.** Plan 03-03 tells implementers to read `app/src/features/auth/gpsConsent.ts` as the Phase 2 GPS-permission/location source (`03-03-PLAN.md:106-109`) and to track current coordinates from that source or `expo-location` (`03-03-PLAN.md:118`). The actual `gpsConsent.ts` only requests foreground permission and records consent; it never exposes current coordinates (`app/src/features/auth/gpsConsent.ts:19-29`). Since LocationDetail distance and Nearby sorting depend on forwarding real `userLat/userLng`, the plans should name one tested source for current position instead of leaving duplicated screen-level Expo Location calls in thin screens. Required fix: add or name a small current-location hook/service, with permission-denied/null/stale cases, then have Map and Nearby consume it consistently.

## Suggestions

- Add one acceptance criterion to 03-01 that explicitly exercises all intended `update_profile` call shapes against the generated `database.types.ts` args, not only a grep for `new_family_mode`.
- Add one SC coverage table to the phase summary before execution. Right now SC2/3/4/8/9/11 are well covered, but SC6 and SC12 need the fixes above.
- Treat manual device checks as gates only after the automated contracts are corrected; otherwise device verification will discover issues that the plan could catch earlier.

## Risk Assessment

Overall risk is **MEDIUM-HIGH** until the above fixes land. The core security posture is directionally good: public reads are server-filtered, sensitive columns are omitted, and SQL-layer tests are planned. The execution risk is that two visible Phase 3 commitments, city/address search and family-mode activation, currently do not line up with their implementation contracts. Starting Wave 1 without correcting them would produce downstream churn in 03-02 through 03-05 and could leave ROADMAP SC6/SC12 falsely marked complete.

## Verification

- Re-read `.claude/codex-prompt-latest.md` from disk for the active review scope.
- Read the standing review contract and severity rules from `CODEX.md`, `CLAUDE.md`, `docs/agent-harness.md`, `docs/review-severity.md`, `docs/stale-info-scan.md`, and `.planning/stale-info-scan-latest.md`.
- Read the requested Phase 3 planning packet from disk, including PROJECT, ROADMAP, CONTEXT, RESEARCH, and all five plan files.
- Also inspected `03-PATTERNS.md`, `03-VALIDATION.md`, `03-UI-SPEC.md`, `gpsConsent.ts`, `updateProfile.ts`, and the existing `update_profile` migration to verify the suspected contract mismatches.
- Ran targeted `rg`/line-window checks for `update_profile`, `new_family_mode`, `max_pins_per_viewport`, `max_pins`, denied GPS/manual search, geocoding, and current-location references.
- No implementation tests were run because this is a pre-execution plan review.

**VERDICT: REQUEST CHANGES**
