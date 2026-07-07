---
phase: 03-read-path-map
verified: 2026-07-07T00:00:00Z
status: gaps_found
score: 12/13 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The pgTAP correctness suite (supabase/tests/phase3_read_rpcs.test.sql, ~22 assertions) proves the RPC-layer moderation/family_mode/D-08/antimeridian/coalesce/config-cap properties against a real PostgreSQL+PostGIS instance"
    status: partial
    reason: "The pgTAP file exists, is well-formed (24 is()/ok() assertions across 10 correctness properties, including a new CR-02 chill_spot null-include case added 2026-07-07), and every property it claims to test is independently confirmed present in the migration SQL by direct code reading in this verification pass. However, `supabase test db --local` has NEVER been executed in any environment for this phase (both 03-01-SUMMARY.md and 03-02-SUMMARY.md explicitly flag this — no Docker CLI available). This verification pass also has no Docker access and cannot execute it. SC2 (four-clause moderation exclusion), SC3 (family_mode exclusion), SC4 (nearest-by-meters ordering), and SC8 (moderation/family fixtures confirmed absent) are therefore verified by static SQL review only, not by a passing automated test run against a live database — this is exactly the gap class that let CR-02 (chill_spot null-include violation) slip through undetected until a manual post-execution code review caught it."
    artifacts:
      - path: "supabase/tests/phase3_read_rpcs.test.sql"
        issue: "Written and reviewed but never executed (`supabase test db --local` requires Docker, unavailable in every session touching this phase so far)."
    missing:
      - "Run `supabase start && supabase db reset && supabase test db --local` on a Docker-capable machine and confirm all assertions pass (in particular the new CR-02 chill_spot case at test lines ~127-131)."
      - "If a failure surfaces, it must be fixed before Phase 4 builds further RPCs on top of this read path."
---

# Phase 3: Read Path & Map Verification Report

**Phase Goal:** The map renders real bathroom locations fetched from Supabase via PostGIS RPCs. Public search excludes deleted/shadowbanned/suppressed records. Emergency mode reads nearest location.
**Verified:** 2026-07-07
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria SC1–SC12)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---------|--------|----------|
| 1 | MapScreen renders Mapbox map with pins from `search_locations_bbox` | ✓ VERIFIED | `app/src/app/(tabs)/index.tsx` — `MapView`→`ShapeSource cluster`→`useLocationsBbox` wired; `MapScreen.test.tsx` passes; `useLocationsBbox.ts` calls `rpc('search_locations_bbox', ...)`. |
| 2 | RPC returns only published/non-deleted/non-shadowbanned/non-suppressed | ✓ VERIFIED (static) | Both `search_locations_bbox` branches and `search_locations_nearby` in `20260704010002_phase3_search_rpcs.sql` (as amended by `20260707010000_...fix.sql`) contain `l.deleted_at is null and l.suppressed_at is null and l.shadowban_status = false`. **Not confirmed by an executed test** — see gap below. |
| 3 | RPC additionally excludes `access_sensitivity='sensitive'` when `family_mode=true`, enforced server-side | ✓ VERIFIED (static) | `v_family` read via `auth.uid()` inside the RPC body (never a client param); `(not v_family or l.access_sensitivity is distinct from 'sensitive')` present in both RPCs. Client never sends `family_mode` to read RPCs (`useLocationsBbox`/`useNearby` types have no such field). Not confirmed by an executed pgTAP run — see gap below. |
| 4 | `search_locations_nearby` returns nearest ordered by distance (meters) | ✓ VERIFIED | `order by l.coordinates <-> st_setsrid(...)::geography` (KNN, ascending); `distance_m` computed via `st_distance`; `useNearby.test.ts` asserts non-decreasing `distanceM` on the mapped client output. |
| 5 | LocationDetail shows name, policy tag, confidence score, last verified | ✓ VERIFIED | `LocationDetailSheet.tsx` renders `detail.name`, policy badge, confidence pill (`"Tier — N GPS verifications"`), relative "Verified N ago"; `get_location_detail` RPC supplies all fields; `LocationDetailSheet.test.tsx` passes. |
| 6 | Denied GPS → recenter + manual search + "Search this area", no dead end (narrowed D-34) | ✓ VERIFIED | `useDeniedLocationState.ts` + `index.tsx` render `[LOCKED ERR-01]` copy verbatim + a working "Search this area" button when denied; **CR-01 crash fix confirmed landed** (both the button `onPress` guard and the `queryFn` defensive branch check `viewport !== null` — commit `03e47b4`). No external geocoding added (confirmed: no new geocoding package in `package.json`). |
| 7 | No-results state named, distinct from filtered-empty, with "Search this area" | ✓ VERIFIED | `index.tsx`/`nearby.tsx` both branch on `hasActiveFilter` to show `EMPTY_HEADING`/`FILTERED_EMPTY_HEADING` with the `[LOCKED]` copy; `MapScreen.test.tsx` asserts both states + the Clear-filters-only-when-filtered behavior. |
| 8 | Shadowbanned/deleted/suppressed/family-excluded fixtures confirmed absent from results | ✗ PARTIAL | Seed fixtures for all four cases exist in `supabase/seed.sql` (rows tagged sensitive/suppressed/shadowbanned/deleted) and pgTAP assertions target them, but **the suite that proves absence has never been run** (Docker unavailable in every session to date). See gap. |
| 9 | Plan 03-01 adds `locations.suppressed_at` before RPCs reference it | ✓ VERIFIED | `20260704010000_phase3_suppressed_at.sql` adds the nullable column, rebuilds the partial GiST index with `suppressed_at is null`, and revokes base-table `SELECT` from `anon`/`authenticated` (T-03-24 hardening, beyond original plan scope). |
| 10 | All screens pass the Phase 1.5 Component Acceptance Checklist before Codex review | ✓ VERIFIED | Checklist cited and itemized in 03-03-SUMMARY.md (Visual Tokens/Accessibility/Error States/Emergency-n/a) and referenced in 03-04/03-05-SUMMARY.md; no raw hex/magic numbers found in any Phase 3 screen/component file (Colors/spacing/typography/radius tokens used throughout). |
| 11 | Nearby tab renders the same set as a sorted, screen-reader-accessible list, no Mapbox dependency | ✓ VERIFIED (code) / pending device confirmation | `app/src/app/(tabs)/nearby.tsx` has zero `@rnmapbox` imports; every row carries `accessibilityRole="button"` + a name/distance/confidence `accessibilityLabel` + `accessibilityHint`; sorts via server-side `useNearby` KNN order; `nearby.test.tsx` passes. Actual VoiceOver/TalkBack announcement is deferred to end-of-phase device UAT (expected per `workflow.human_verify_mode`, not a gap). |
| 12 | Settings has a `family_mode` toggle wired to extended `update_profile`; enabling it activates SC3's filter | ✓ VERIFIED (code) / pending device confirmation | `profile.tsx` `Switch` bound to `useFamilyMode()`; `setFamilyMode` posts only `{ new_family_mode }` (never `new_display_name`); RPC coalesces both columns (confirmed in migration + `update_profile` SQL) so the display name cannot be nulled. `profile.test.tsx` asserts `accessibilityRole==='switch'` (RN `Switch` defaults this natively — confirmed in `node_modules/react-native/Libraries/Components/Switch/Switch.js:255`) and that toggling calls `setFamilyMode` with the flipped boolean. End-to-end "sensitive location disappears" effect is deferred to device UAT (expected, not a gap). |

**Score:** 12/13 must-haves verified (the 13th — pgTAP execution — is PARTIAL, a real standing gap, counted against the score per the adversarial standard even though the underlying SQL is independently confirmed correct by direct code review).

### Cross-AI Review Fix Verification (2026-07-05 REQUEST CHANGES → revised plans)

| Finding | Reviewer | Status | Evidence |
|---|---|---|---|
| `update_profile` display-name wipe on family-mode-only call | Antigravity (CRITICAL) + Codex (HIGH) | ✓ FIXED | `20260704010003_phase3_family_mode_rpc.sql`: `display_name = coalesce(new_display_name, display_name), family_mode = coalesce(new_family_mode, family_mode)`. `useFamilyMode.ts` `setFamilyMode` sends only `{ new_family_mode }`. |
| Bbox index-bypassing cast (`coordinates::geometry &&`) | Antigravity (MAJOR) | ✓ FIXED | Both `20260704010002_...` and the CR-02 replacement `20260707010000_...` keep `l.coordinates` raw and cast the envelope: `l.coordinates && st_makeenvelope(...)::geography`. |
| D-08 null-include violated by planned filter SQL | Antigravity (MAJOR) | ✓ FIXED (open_now/wheelchair/changing/high_conf); Chill Spot's own null-include gap found later — see CR-02 below | `is_open_now is not false`, tag "no data" escape branches, `confidence_tier is null` all present. |
| Antimeridian crossing crash | Antigravity (MAJOR) | ✓ FIXED | Both bbox RPC versions branch on `min_lng > max_lng` and union two `st_makeenvelope` calls; pgTAP test targets this (unexecuted, see gap). |
| Denied-GPS "manual city/address search" scope mismatch vs. PROJECT/ROADMAP/UI-SPEC | Codex (HIGH) | ✓ RESOLVED by decision, not code | D-34 approved 2026-07-05: ROADMAP SC6 and UI-SPEC ERR-01 explicitly revised to the narrower recenter+pan+"Search this area" scope. Implemented exactly as narrowed — confirmed no geocoding SDK in `package.json`. |
| `max_pins_per_viewport` seeded but not read back by RPC | Codex (MEDIUM) | ✓ FIXED | `search_locations_bbox` reads `app_config.max_pins_per_viewport` server-side and applies `limit least(max_pins, v_max_pins)`. |
| `gpsConsent.ts` wrongly named as the current-position source | Codex (MEDIUM) | ✓ FIXED | New `useCurrentPosition.ts` hook is the single live-coordinate source; `gpsConsent.ts` untouched (consent-only); MapScreen/Nearby/LocationDetailSheet all consume `useCurrentPosition`. |

### Post-Execution Code Review Fix Verification (03-REVIEW.md, 2026-07-07)

| Finding | Status | Evidence |
|---|---|---|
| CR-01: MapScreen crash — denied-GPS "Search this area" dereferences null `viewport` via `viewport!` | ✓ FIXED | `app/src/app/(tabs)/index.tsx` commit `03e47b4`: `queryFn: () => (viewport !== null ? useLocationsBbox(viewport, filters) : EMPTY_FC)` AND the button's `onPress={() => { if (viewport !== null) bboxQuery.refetch(); }}` — double-guarded. **Gap noted:** no dedicated regression test exercises pressing "Search this area" while `viewport` is still `null` (the exact race the bug required); `MapScreen.test.tsx` tests the denied-state render and the (already-settled-viewport) refetch behavior separately, not the null-viewport race itself. Non-blocking (the fix is structurally sound and doubly defensive) — flagged as a WARNING, not a gap. |
| CR-02: `filter_chill_spot` violates D-08 null-include (`chill_spot = true` excludes null rows) | ✓ FIXED, and confirmed pushed | New migration `20260707010000_phase3_chill_spot_null_include_fix.sql` replaces both `search_locations_bbox` branches and `search_locations_nearby`'s `filter_chill_spot` clause with `l.chill_spot is not false` (matches the `is_open_now` pattern). Seed row 16 (`chill_spot: null`) and a new pgTAP assertion (lines ~127-131) added. Commit message states "pushed to the live linked project" — **this verification pass has no Supabase MCP/DB-query tool available and cannot independently confirm the live push**; the migration file itself is present, correctly written, and is the newest file in the local migration sequence (would apply on the next `db push`/`db reset` regardless). Treated as verified-in-code with an unconfirmed-live-state caveat (INFO, not a gap — same class of limitation as the broader pgTAP-execution gap above). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260704010000_phase3_suppressed_at.sql` | suppressed_at column + index + RLS lockdown | ✓ VERIFIED | Column, index rebuild, RLS policy, base-table SELECT revoke all present. |
| `supabase/migrations/20260704010001_phase3_max_pins_config.sql` | app_config tunable | ✓ VERIFIED | `max_pins_per_viewport` = '200' row present. |
| `supabase/migrations/20260704010002_phase3_search_rpcs.sql` + `20260707010000_...fix.sql` | 3 read RPCs, moderation+family+D-08+antimeridian+config-cap | ✓ VERIFIED | All properties present in SQL; CR-02 superseded by the fix migration. |
| `supabase/migrations/20260704010003_phase3_family_mode_rpc.sql` | update_profile coalesce extension | ✓ VERIFIED | `coalesce()` on both columns confirmed. |
| `supabase/seed.sql` | dev-only moderation/D-08/antimeridian fixtures | ✓ VERIFIED | Sensitive/suppressed/shadowbanned/deleted/null-data/antimeridian/chill_spot-null rows all present; loaded only on `db reset` per `config.toml`. |
| `supabase/tests/phase3_read_rpcs.test.sql` | pgTAP correctness suite | ⚠️ WRITTEN, UNEXECUTED | 24 assertions across 10+ properties; never run against a live Postgres in any session (Docker unavailable). See gap. |
| `app/src/lib/database.types.ts` | regenerated types | ✓ VERIFIED | Contains `search_locations_bbox`, `search_locations_nearby`, `get_location_detail`, `suppressed_at` (8 matches via grep); `npx tsc --noEmit` clean. |
| `app/src/features/locations/{types,useLocationsBbox,useLocationDetail,useNearby,useCurrentPosition,useFamilyMode,formatDistance}.ts` | client data layer | ✓ VERIFIED | All present, 100% branch/line/function coverage confirmed via `npm test -- --coverage`. |
| `app/src/features/filters/useFiltersStore.ts` | AND-logic, null-include, session-persist/cold-start-reset store | ✓ VERIFIED | `PROCESS_SESSION_ID` + `mergePersistedFilters` implements D-05/D-06 correctly; 100% coverage. |
| `app/src/features/locations/useMapViewport.ts` | debounced viewport + zoom cutoff | ✓ VERIFIED | 400ms debounce via `setTimeout`, `PIN_ZOOM_CUTOFF=11`, unmount-safe timer cleanup; 100% coverage. |
| `app/src/app/(tabs)/index.tsx` (MapScreen) | Mapbox map, clustering, user dot, chip row, error banner, denied/empty states | ✓ VERIFIED | All present and wired; CR-01 fix confirmed landed. |
| `app/src/app/(components)/LocationDetailSheet.tsx` | peek/half/full sheet, Get Directions, hidden action buttons | ✓ VERIFIED | D-12/13/14/16/17/18/19/20/24 all confirmed implemented by direct read. |
| `app/src/app/(tabs)/nearby.tsx` | accessible distance-sorted list | ✓ VERIFIED | No Mapbox import; a11y props on every row; reuses `LocationDetailSheet`. |
| `app/src/app/(tabs)/profile.tsx` | family_mode Switch | ✓ VERIFIED | `Switch` wired to `useFamilyMode`; replaces the old "Account / Coming soon" placeholder. |
| `app/src/app/(components)/FilterChipRow.tsx` | 5 accessible chips bound to store | ✓ VERIFIED | All 5 chips present with correct UI-SPEC order and a11y attributes. |
| `app/src/features/locations/useDeniedLocationState.ts` | permission-state hook | ✓ VERIFIED | Follows `gpsConsent.ts` convention; reuses `useCurrentPosition`'s `PermissionStatus` type per design. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| RPCs | `public.users.family_mode` | `auth.uid()` server-side read | ✓ WIRED | Confirmed in both bbox/nearby/detail RPC bodies; never a client parameter. |
| `search_locations_bbox` | `app_config.max_pins_per_viewport` | server-side read + `least()` clamp | ✓ WIRED | Confirmed; client `max_pins` can only narrow. |
| `MapScreen` | `useLocationsBbox` | TanStack `useQuery` keyed on `[viewport, filters]` | ✓ WIRED | Confirmed; refetches on filter/viewport change. |
| `MapScreen` | `useCurrentPosition` | reads live coords, forwards to sheet | ✓ WIRED | `coords?.userLat ?? null` passed as prop. |
| `LocationDetailSheet` | `useLocationDetail` | forwards `userLat`/`userLng` → RPC-echoed `distanceM` | ✓ WIRED | `useLocationDetail(locationId, userLat ?? undefined, userLng ?? undefined)`; distance line conditionally rendered only when non-null. |
| `LocationDetailSheet` | native maps app | `Linking.openURL` with lat/lng | ✓ WIRED | `directionsUrl()` builds platform-specific deep link; test asserts `Linking.openURL` called with lat/lng. |
| `nearby.tsx` | `useNearby` / `LocationDetailSheet` | current coords feed both | ✓ WIRED | Same `useCurrentPosition` source as MapScreen; row press opens sheet with id + coords. |
| `profile.tsx` Switch | `useFamilyMode` → `update_profile` | `onValueChange` → `setFamilyMode` | ✓ WIRED | Confirmed; user-scoped query key `['familyMode', session?.user.id]`. |
| `FilterChipRow` | `useFiltersStore` | chip press → `toggle(key)` | ✓ WIRED | No local duplicate state; store selector used directly. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| MapScreen pins | `bboxQuery.data` (`FeatureCollection`) | `useLocationsBbox` → `supabase.rpc('search_locations_bbox', ...)` | Yes — real PostGIS query against `public.locations` (not a static/empty stub) | ✓ FLOWING |
| Nearby rows | `nearbyQuery.data` (`NearbyLocation[]`) | `useNearby` → `supabase.rpc('search_locations_nearby', ...)` | Yes — real KNN query | ✓ FLOWING |
| LocationDetailSheet fields | `detailQuery.data` | `useLocationDetail` → `supabase.rpc('get_location_detail', ...)` | Yes — real row lookup + distance computation | ✓ FLOWING |
| Family mode switch value | `familyMode` | `useFamilyMode` → `.from('users').select('family_mode')` | Yes — real column read, user-scoped | ✓ FLOWING |
| **Note:** all of the above flow to a **live Supabase project** (`ebmzhjmmtmldhrojkdqw`, per `supabase/.temp/project-ref`) with migrations applied per 03-01-SUMMARY.md's push log — but the RPC bodies' *correctness* under those live conditions is only proven by the never-executed pgTAP suite, not by this data-flow trace (which only confirms wiring, not SQL correctness). | | | | |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Jest suite (all Phase 3 + prior-phase tests) | `cd app && npm test` | 38 suites / 294 tests passed, 0 failed | ✓ PASS |
| 100% coverage gate on `src/features/**` + `src/lib/**` | `cd app && npm test -- --coverage` | 100% stmts/branch/funcs/lines on every features/lib file (types.ts excluded, type-only) | ✓ PASS |
| TypeScript strict compile | `cd app && npx tsc --noEmit -p tsconfig.json` | No errors | ✓ PASS |
| No debt markers (TBD/FIXME/XXX) in Phase 3 files | `grep -rn "TBD\|FIXME\|XXX" <phase-3 files>` | 0 matches | ✓ PASS |
| pgTAP RPC correctness suite | `supabase test db --local` | **NOT RUN** — no Docker in this environment | ✗ SKIP (real gap, see above) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this project; no probes declared in any Phase 3 PLAN/SUMMARY. Step 7c: SKIPPED (no probes applicable — the closest analog, the pgTAP suite, is covered above as a standing execution gap, not a probe).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| REQ-MAP | 03-01, 03-02, 03-03 | View map of bathrooms near GPS location | ✓ SATISFIED | MapScreen + bbox RPC + useCurrentPosition. |
| REQ-SEARCH | 03-01, 03-05 | Search fallback for denied GPS (narrowed D-34) | ✓ SATISFIED | Denied-state recenter + Search this area. |
| REQ-FILTER | 03-01, 03-02, 03-05 | Filter by Chill Spot/wheelchair/changing/cleanliness/open | ✓ SATISFIED | 5 chips, AND logic, D-08 null-include (incl. CR-02 fix). |
| REQ-EMERGENCY | 03-01 | Emergency Mode nearest-location RPC (UI is Phase 8) | ✓ SATISFIED (RPC-only, as scoped) | `search_locations_nearby` built and callable; UI explicitly out of Phase 3 scope. |
| REQ-DETAIL | 03-01, 03-02, 03-03 | Tap listing → full details | ✓ SATISFIED | LocationDetailSheet, reused by both Map and Nearby. |
| REQ-FAMILY | 03-01 | family_mode=true hides sensitive locations (RPC-layer) | ✓ SATISFIED (code); end-to-end pending device UAT + pgTAP | Server-side `auth.uid()` read confirmed in all 3 RPCs. |
| REQ-NEARBY | 03-02, 03-04 | Sorted list alternative to map | ✓ SATISFIED | `nearby.tsx`, no Mapbox dependency, a11y semantics. |
| REQ-FAMILY-TOGGLE | 03-01, 03-02, 03-04 | Enable family_mode from Settings | ✓ SATISFIED | Switch wired to `useFamilyMode`/`update_profile` coalesce fix. |

No orphaned requirements — every phase requirement ID listed in the verification brief is claimed by at least one plan's `requirements:` frontmatter field, and each has corresponding implementation evidence above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/features/locations/useLocationsBbox.ts`, `useNearby.ts`, `useLocationDetail.ts` | various | `use*`-prefixed plain async functions called from non-hook `queryFn` contexts (WR-01, 03-REVIEW.md) | ⚠️ Warning | Likely trips `react-hooks/rules-of-hooks` lint; naming-only, does not affect runtime correctness. Not fixed as part of the CR-01/CR-02 follow-up commit — carried forward, non-blocking. |
| `useCurrentPosition.ts:39-62`, `useDeniedLocationState.ts:34-40` | — | No unmount guard around async permission chain (WR-02) | ⚠️ Warning | Correctness smell (setState after unmount), not a crash in React 18; not fixed. |
| `useCurrentPosition.ts:40`, `useDeniedLocationState.ts:35` | — | Two hooks independently call `requestForegroundPermissionsAsync` on the same screen (WR-03) | ⚠️ Warning | Duplicated logic, no single source of truth for the permission decision; not fixed. |
| `app/src/app/(tabs)/index.tsx` | 146,160,164,174,180 | Pervasive `as never` casts erase type safety on Mapbox props (WR-04) | ⚠️ Warning | Silences structural checking; not fixed. |
| `formatDistance.ts:14-22` | — | Region-less locale fallback could misclassify a language subtag as a region (IN-01) | ℹ️ Info | Small blast radius, not fixed. |
| `useLocationsBbox.ts:27` | — | `max_pins` client param defined but never sent by any real call site (IN-02) | ℹ️ Info | Speculative unused surface; not fixed. |
| `LocationDetailSheet.tsx:104-114` | — | `hoursLines` silently drops non-flat-string hour shapes with no distinguishing signal (IN-03) | ℹ️ Info | Cosmetic risk for a future richer `hours` shape; not fixed. |
| `MapScreen.test.tsx` | — | No dedicated regression test for the exact CR-01 null-viewport race (press "Search this area" before first viewport commit) | ⚠️ Warning (new, this verification pass) | The fix is present and doubly defensive, but nothing in the test suite would catch a future regression of this specific race. |

No 🛑 Blocker anti-patterns and no unresolved TBD/FIXME/XXX debt markers found in any Phase 3 file.

### Human Verification Required

The following items were deliberately deferred by all 5 plans' Task 3 (`checkpoint:human-verify`, `gate="blocking"`) to end-of-phase UAT per this project's `workflow.human_verify_mode` default (end-of-phase). This is expected/correct per the project's harness — NOT a gap. Aggregated from 03-03/03-04/03-05-SUMMARY.md's "Human Verification Needed" sections:

### 1. Mapbox map rendering + clustering (03-03)

**Test:** Run `cd app && npx expo start --dev-client` on a device/simulator. Open the Map tab; confirm the tile renders immediately, pins appear shortly after (seed data near Eugene, OR), colored by policy tag, with a cluster count badge. Pan/zoom and confirm the ~400ms refetch and the "Zoom in to see individual locations" cutoff. Confirm the user-location blue dot is distinct from pins. Toggle device dark mode and confirm the map style follows.
**Expected:** All of the above render correctly with no crash.
**Why human:** Native Mapbox rendering, gesture handling, and OS dark-mode switching are not observable through jest.

### 2. LocationDetail bottom sheet gestures + real distance (03-03)

**Test:** Tap a pin; confirm the sheet opens at peek, drags to half/full via gesture, shows name/distance/policy/confidence/"Hours not yet available", and that the distance shown matches your real device distance to that pin. Tap "Get Directions" and confirm the native maps app opens. Confirm there is no close button and that both swipe-down and tap-outside dismiss it.
**Expected:** Gesture-driven snap points work; distance is accurate; Get Directions opens the OS maps app; dismiss works both ways.
**Why human:** `@gorhom/bottom-sheet` animation/gesture behavior and native app-switching are not observable through jest.

### 3. RPC-failure banner behavior (03-03)

**Test:** If testable, simulate an RPC failure (e.g., airplane mode) and confirm the error banner + Retry appears while previously-loaded pins remain visible.
**Expected:** Banner shows, pins persist, Retry recovers.
**Why human:** Requires a real network-failure condition on-device.

### 4. Nearby screen-reader pass (03-04)

**Test:** Enable VoiceOver (iOS) or TalkBack (Android). Swipe through Nearby rows and confirm each announces name + distance + confidence and "Opens location details".
**Expected:** Every row is announced correctly with no silent/unlabeled rows.
**Why human:** Screen-reader spoken output cannot be asserted by jest — only that the accessibility props exist, not that OS assistive tech renders them correctly.

### 5. family_mode end-to-end effect + display-name preservation (03-04)

**Test:** Toggle "Family mode" ON in Settings. Confirm the display name is unchanged after toggling (proves the coalesce fix in practice, not just in code). Return to Map and Nearby; confirm the seeded `access_sensitivity='sensitive'` location(s) disappear from both. Toggle OFF; confirm they reappear.
**Expected:** Sensitive locations vanish/reappear correctly; display name never changes.
**Why human:** This is the true end-to-end proof of SC3/SC12 against the live database + a real signed-in session — the closest thing to the missing pgTAP execution for this specific property, so treat this check as especially important given the pgTAP gap above.

### 6. Filter AND-logic, session-persist/cold-start reset (03-05)

**Test:** Toggle two filter chips; confirm only locations matching BOTH appear (not either). Navigate away and back; confirm filters persist. Fully kill and relaunch the app; confirm filters reset to none. Select filters matching nothing; confirm the filtered-empty state + Clear filters (distinct from truly-empty).
**Expected:** AND logic, not OR; session persistence; cold-start reset; distinct empty states.
**Why human:** Requires a real app kill/relaunch cycle and interactive multi-chip selection — not observable through the unit-level store tests alone.

### 7. Denied-GPS fallback (03-05)

**Test:** Deny location permission via OS settings; confirm the map shows the manual-search entry + ERR-01 copy and a working "Search this area" button — no dead-end blank screen. Pan to an empty area and confirm "Search this area" re-runs the query for the current viewport.
**Expected:** No dead end; recenter + pan + Search this area works as narrowed per D-34.
**Why human:** Requires toggling a real OS permission setting and observing the resulting native permission-denial UX.

### Gaps Summary

Phase 3's client-side implementation is thorough, well-tested (294/294 Jest tests green, 100% coverage on `src/features/**`/`src/lib/**`, clean `tsc`), and directly demonstrates that both the pre-execution cross-AI review findings (Antigravity + Codex, 7 issues) and the post-execution code-review findings (CR-01, CR-02) were genuinely fixed in the shipped code — not just claimed in prose. All 5 plans' requirement IDs are accounted for, no orphaned requirements exist, and no debt markers or blocking anti-patterns were found.

The one substantive gap is that **the pgTAP correctness suite (`supabase/tests/phase3_read_rpcs.test.sql`) has never been executed against a real Postgres/PostGIS instance**, in any session across this phase's entire lifecycle (03-01 execution, 03-02 execution, and this verification pass all independently lack Docker). This is the only mechanism that would prove — rather than merely make plausible by SQL inspection — that the four-clause moderation filter, the family_mode exclusion, the nearest-by-meters ordering, the D-08 null-include behavior (including the CR-02 fix), the antimeridian handling, and the `update_profile` coalesce semantics actually behave correctly against live data. The fact that CR-02 (a real, documented-contract-violating bug) was only caught by a *manual* post-execution code review — and had zero pgTAP coverage at the time — is direct evidence that static SQL reading is not a full substitute for running this suite.

This is an environment/infrastructure limitation, not a code-authoring failure, and it does not block the client-side read-path functionality from working — but it is a real, standing risk that Phase 4/5 will build additional RPCs and triggers on top of a foundation whose only automated correctness proof has never actually run. Recommend running `supabase start && supabase db reset && supabase test db --local` on a Docker-capable machine before or shortly after starting Phase 4, and treating any pgTAP failure there as a Phase 3 regression to fix immediately.

**This looks like an acceptable, temporary deviation given the environment constraint.** To formally accept it and unblock Phase 4 without re-litigating this gap, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "The pgTAP correctness suite proves the RPC-layer moderation/family_mode/D-08/antimeridian/coalesce/config-cap properties against a real PostgreSQL+PostGIS instance"
    reason: "Docker unavailable in every session to date; SQL manually verified correct by two independent review passes (cross-AI pre-execution review + post-execution code review, which caught and fixed the one real defect, CR-02); acceptable to proceed with the standing action item to run supabase test db --local on a Docker-capable machine at the first opportunity."
    accepted_by: "<user>"
    accepted_at: "<ISO timestamp>"
```

---

*Verified: 2026-07-07*
*Verifier: Claude (gsd-verifier)*
