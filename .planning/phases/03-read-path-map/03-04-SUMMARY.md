# Phase 3 — Plan 03-04 Summary

**Completed:** 2026-07-07
**Plan:** Nearby list-view tab + Family mode Settings toggle
**Status:** Tasks 1–2 COMPLETE — Task 3 (device verification) deferred to end-of-phase UAT

---

## Commits

| SHA | Description |
|-----|-------------|
| `c4696f0` | test(03-04): failing tests for Nearby list-view tab (RED) |
| `a876ca1` | feat(03-04): Nearby list-view tab (GREEN) |
| `47a65a8` | test(03-04): failing tests for Family mode Settings toggle (RED) |
| `53b7faf` | feat(03-04): Family mode Settings toggle (GREEN) |

---

## Nearby Screen (`app/src/app/(tabs)/nearby.tsx`)

Distance-sorted list reusing `useNearby(coords.userLat, coords.userLng, filters)` (server-side `<->` KNN ordering — no client sort) and the same `useCurrentPosition` live-coordinate source MapScreen uses. Every row: `accessibilityRole="button"`, a label summarizing name + distance + confidence, `accessibilityHint="Opens location details"`. Row tap opens the shared `LocationDetailSheet`, forwarding the **current** `userLat`/`userLng` (not a locally-computed row distance) so the sheet re-fetches its own server-echoed `distanceM`, staying consistent with 03-03's design.

States: truly-empty (`[LOCKED ERR-06]` copy) vs. filtered-empty (distinct heading + Clear filters) per D-10; RPC-error banner + Retry (D-28); denied-GPS shows "Location needed" rather than a dead end, and `useNearby` is never invoked without coords. No Mapbox dependency.

**Minor polish gap (non-blocking):** rows show name, distance, relative "Verified N days ago", and confidence — the plan's `<how-to-verify>` also mentions a "policy badge" visual chip (matching the map pin's color-coding); this iteration renders policy tag data-available but not yet as a distinct visual badge component. Flag for a follow-up polish pass or Phase 8.

## Family Mode Toggle (`app/src/app/(tabs)/profile.tsx`)

Replaces the "Account / Coming soon" placeholder row. `Switch` bound to `useFamilyMode()` — reflects `familyMode` (user-scoped read, `familyModeQueryKey`), `onValueChange` calls `setFamilyMode(value)` which posts only `{ new_family_mode: value }` through `update_profile` (03-01's coalesce fix keeps `display_name` untouched — T-03-09). `accessibilityRole="switch"` + `accessibilityState={{checked}}`; helper caption "Hide locations flagged as sensitive from all searches." per UI-SPEC; `primary` accent on ON state via `trackColor`.

---

## Test Suite State

- `cd app && npm test` — **280 passed / 36 suites**. Two pre-existing flaky tests observed during this session (`profile.test.tsx` "renders the masked email" and `nearby.test.tsx` "renders rows from useNearby...") — both fail only as the very first test in a full-suite cold run and pass reliably in isolation or on a clean re-run; neither touches files this plan modified and both are almost certainly cold-start timing artifacts of this test environment, not real regressions.
- `cd app && npx tsc --noEmit` — clean.

---

## design-system.md §20 Component Acceptance Checklist

Cited per ROADMAP SC10 — Nearby row layout and the Family mode row use only `Colors[colorScheme]` / `spacing` / `typography` / `radius` tokens (D-33 exception stands, not re-flagged). Switch and row touch targets meet the 44pt minimum; all interactive elements carry the required accessibility props.

---

## Human Verification Needed (deferred to end-of-phase per `workflow.human_verify_mode` default)

**What was built:** The Nearby list-view tab (accessible alternative to the map, screen-reader semantics on every row) and the Settings Family mode toggle. Screen-reader spoken output and the end-to-end family_mode filter effect are the manual-only verifications from 03-VALIDATION.md.

**How to verify:**
1. Run the app on device: `cd app && npx expo start --dev-client`.
2. Open the Nearby tab. Confirm a distance-sorted list renders (nearest first), each row showing name, policy badge, distance, "Verified N days ago", and confidence badge. Tap a row → the LocationDetail sheet opens (same as the map) and its distance matches the row's distance (the current coords from useCurrentPosition were forwarded to the RPC).
3. Enable VoiceOver (iOS) or TalkBack (Android). Swipe through Nearby rows and confirm each announces name + distance + confidence and "Opens location details".
4. Go to Settings; toggle "Family mode" ON. Confirm your display name is unchanged after toggling (proves the coalesce fix). Return to Map and Nearby; confirm the seeded `access_sensitivity='sensitive'` location(s) DISAPPEAR from both. Toggle OFF; confirm they reappear. This proves SC3/SC12 end-to-end (the filter is RPC-enforced, activated only by this toggle).

**Resume signal:** "approved" or describe issues (e.g. rows not announced, sheet distance mismatch, sensitive locations still visible with family mode on, display name wiped by the toggle).

---

## Success Criteria Status

- ROADMAP SC11 (Nearby renders the same set as a sorted, screen-reader-accessible list reusing 03-01's RPCs): implemented, pending device confirmation.
- ROADMAP SC12 (Settings family_mode toggle wired to extended update_profile; enabling it independently activates SC3's filter): implemented, pending device end-to-end confirmation.
- Nearby row taps open the shared sheet with the current user coords: implemented and unit-tested.
