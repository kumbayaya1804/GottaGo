---
phase: 03-read-path-map
plan: 03
subsystem: map-read-ui
tags: [rnmapbox, native-clustering, gorhom-bottom-sheet, tanstack-query, expo-location, expo-linking, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: "search_locations_bbox / get_location_detail RPCs + database.types.ts"
  - phase: 03-02
    provides: "useLocationsBbox, useLocationDetail(id, userLat?, userLng?), useCurrentPosition, formatDistance"
provides:
  - "useMapViewport — 400ms-debounced viewport->bbox + belowPinThreshold zoom-out cutoff (features/, 100% covered)"
  - "MapScreen ((tabs)/index.tsx) — Mapbox native-clustered pins, user dot, viewport refetch, RPC-failure banner, forwards current coords into the sheet"
  - "LocationDetailSheet ((components)/) — @gorhom/bottom-sheet peek/half/full detail incl. Get Directions; forwards userLat/userLng into useLocationDetail"
affects: [03-04-nearby-family-toggle, 03-05-filters-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debounced viewport hook in features/ (covered) keeps the screen a thin wrapper"
    - "Mapbox native ShapeSource cluster:true; single-pin color via a `match` on policyTag (data-driven, not React state)"
    - "Screen owns TanStack useQuery(queryFn: useLocationsBbox); on error TanStack retains last data so stale pins persist (D-28)"
    - "Component forwards live coords (useCurrentPosition) into useLocationDetail so distanceM is RPC-echoed (never client-computed)"

key-files:
  created:
    - app/src/features/locations/useMapViewport.ts
    - app/src/features/locations/__tests__/useMapViewport.test.ts
    - app/src/app/(components)/LocationDetailSheet.tsx
    - app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
    - app/src/app/__tests__/(tabs)/MapScreen.test.tsx
  modified:
    - app/src/app/(tabs)/index.tsx
    - app/jest.setup.ts

key-decisions:
  - "Single-pin rendering uses a CircleLayer with circleColor = match-on-policyTag (no bundled pin image assets exist this phase) — honors the §20 data-driven-pin-color rule while remaining device-renderable without asset registration"
  - "Cluster bubbles render in the primary accent + count; dominant-policy-tag cluster color (clusterProperties aggregation) deferred as a visual refinement"
  - "MapScreen sources current coords from useCurrentPosition (03-02), NOT gpsConsent.ts (Codex MEDIUM) — gpsConsent records consent only, exposes no coords"
  - "Runtime Mapbox public token read from EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (config-plugin download token is build-time only)"

requirements-completed: [REQ-MAP, REQ-DETAIL]

# Metrics
duration: ~50min
completed: 2026-07-06
---

# Phase 3 Plan 03: MapScreen + LocationDetail Bottom Sheet Summary

**The tested 03-02 data hooks become the visible read surface: a Mapbox map with native-clustered, policy-tag-colored pins driven by search_locations_bbox, a debounced viewport refetch with a zoom-out cutoff, a user-location blue dot, an RPC-failure banner that preserves stale pins, and a full @gorhom/bottom-sheet LocationDetail (peek/half/full) whose peek distance is the real server-echoed distanceM forwarded from the live user coords.**

## Performance
- **Duration:** ~50 min
- **Tasks:** 2 automated (both TDD RED→GREEN); Task 3 is a device checkpoint deferred to end-of-phase UAT (see below)
- **Files created:** 5 (1 hook + 3 test files + 1 component)
- **Files modified:** 2 (MapScreen index.tsx, jest.setup.ts mock)
- **Tests:** full suite 269 passed / 35 suites; useMapViewport at 100% lines/branches/functions/statements

## Task Commits
1. **Task 1a — useMapViewport hook + test (100% cov)** — `467f7bf` (feat)
2. **Task 2 — LocationDetailSheet + test** — `5533fd8` (feat)
3. **Task 1b — MapScreen + test + jest.setup mock extension** — `e903147` (feat)

> Task order note: Task 2's component (LocationDetailSheet) was built before Task 1's MapScreen so every intermediate commit typechecks — MapScreen imports the sheet, so the sheet had to exist first. Each commit is independently green (tests + tsc).

## Exact contracts (for 03-04 / 03-05)

### `features/locations/useMapViewport.ts`
- `useMapViewport(): { viewport: MapBbox | null; zoom: number | null; belowPinThreshold: boolean; onRegionChange(region: MapRegionFeature): void }`
  - `MapBbox` = `{ minLng, minLat, maxLng, maxLat }` — feed straight into `useLocationsBbox`.
  - `MapRegionFeature` = `{ properties: { visibleBounds: [[maxLng,maxLat] /*NE*/, [minLng,minLat] /*SW*/], zoomLevel } }` (the rnmapbox `onRegionDidChange` payload subset).
  - `onRegionChange` is wired to `MapView.onRegionDidChange`; commits are debounced `VIEWPORT_DEBOUNCE_MS` (400ms, exported) after motion stops (D-01), coalescing rapid changes into ONE update.
  - `belowPinThreshold` = committed `zoom < PIN_ZOOM_CUTOFF` (exported, 11) — when true the caller shows the zoom-in card and skips fetching (D-04/D-32).
  - Committed viewport persists for the hook's lifetime; resets only on remount/cold start (D-03). The hook holds no persistence itself.

### `app/src/app/(components)/LocationDetailSheet.tsx` — prop contract + open/dismiss API
- **Props:** `{ locationId: string | null; userLat: number | null; userLng: number | null; onDismiss: () => void }` (default export).
  - `locationId === null` → the sheet renders nothing (closed). Set it to a location id to open at peek (30%).
  - `userLat`/`userLng` are the CURRENT user coords MapScreen sources from `useCurrentPosition`. The sheet forwards them into `useLocationDetail(locationId, userLat ?? undefined, userLng ?? undefined)` — it does NOT compute distance. `distanceM` is the server-echoed `ST_Distance`; the distance line is omitted when `distanceM` is null (never a client guess).
  - `onDismiss` fires when the sheet closes by gesture (BottomSheet `onChange` index === -1). Dismiss is swipe-down / tap-outside only — no close button (D-17).
- **Content tiers:** peek = name (h2) / distance (subhead) / policy-tag badge / confidence badge ("High — 14 GPS verifications", singular at count 1, D-15); half = hours or "Hours not yet available" (D-18) + address; relative "Verified N ago" via date-fns (D-16). Action row shows ONLY Get Directions this phase (D-13/D-20); Verify/Rate/Report are absent, no access code anywhere (D-24). Get Directions opens the native maps app via `Linking.openURL` (iOS `maps:`, Android `geo:`, web Google Maps), no auth gate (D-21).
- **Wiring:** the sheet owns its own `useQuery(['locationDetail', locationId, userLat, userLng])`, so it must be mounted under the app's `QueryClientProvider` (already present in `_layout.tsx`). `GestureHandlerRootView` is already at the root (Pitfall 7 satisfied).

### `app/src/app/(tabs)/index.tsx` — MapScreen
- Sources current user coords from **`useCurrentPosition()` (03-02)**, not gpsConsent.ts. Reads `{ userLat, userLng } | null` and forwards `coords?.userLat ?? null` / `coords?.userLng ?? null` into `LocationDetailSheet` on pin tap. Nulls before the first fix / when denied → sheet shows no distance line.
- Owns `useQuery(['locationsBbox', viewport], queryFn: () => useLocationsBbox(viewport!))`, `enabled: viewport !== null && !belowPinThreshold`. Filters arg intentionally omitted (defaults to `{}`) until **03-05** wires the Zustand filters store.
- Map: `MapView` (styleURL switches light/dark via `useColorScheme`, D-25) → `Camera` (defaultSettings center on live coords, else the dev-seed center) → built-in `UserLocation` blue dot (D-26) → `ShapeSource cluster clusterRadius={50} clusterMaxZoomLevel={14}` with a cluster `CircleLayer` + count `SymbolLayer` + single-pin `CircleLayer` whose `circleColor` is a `match` on `policyTag`.

### How 03-05 mounts the filter chip row + empty states onto index.tsx (no conflict)
- Add the horizontal chip row as an **absolutely-positioned overlay** anchored to the top of the `screen` View (sibling of `MapView`, above the error banner) — the map already fills via `StyleSheet.absoluteFill`, so the chip row overlays cleanly without touching the map layer tree.
- Wire the filters store output into the `useQuery` call by passing `activeRpcFilters()` as the 2nd arg to `useLocationsBbox(viewport!, filters)` and adding `filters` to the `queryKey`. No structural change to the ShapeSource block is needed.
- Add the truly-empty (ERR-06) and filtered-empty (D-10) center cards using the same `centerOverlay`/`card` style pattern already present for the zoom-out card, gated on `bboxQuery.data?.features.length === 0` + whether any filter is active. The denied-GPS (ERR-01) state and its manual-search affordance also mount as overlays here.

## Component Acceptance Checklist (from docs/design/design-system.md §20)

### Visual Tokens
- [x] All color values reference `Colors[colorScheme].tokenName` — no raw hex in either component's StyleSheet (pin/cluster/confidence/policy colors all come from tokens; the Mapbox `match` expression is fed token values, not literals).
- [x] All text sizes reference `typography.ts` — no inline `fontSize` numbers.
- [x] All spacing values reference `spacing.ts` / `radius.ts` — no magic numbers.
- [ ] Dark mode tested — **deferred to Task 3 device UAT** (map style + sheet in OS dark mode; jest cannot observe native Mapbox theming).
- [x] Policy tag badge colors match §8 — `code_required` badge uses token `pinCodeRequired`; badge text uses `textInverse` on colored pills (the sheet's policy badge is a colored pill, not the §8 light-bg chip; confidence pill for `confidenceMedium` uses `textPrimary`, not white, per §9).
- [x] Confidence badge colors match §9 — `confidenceMedium` pill text uses `textPrimary` (not white).

### Accessibility
- [x] All tappable elements have a non-empty `accessibilityLabel` (Get Directions; Retry banner button).
- [x] All tappable elements have `accessibilityRole="button"`.
- [x] `accessibilityHint` added where the outcome isn't obvious (Get Directions → "Opens the native maps app to this location").
- [x] `accessibilityState` — n/a: no disabled/selected/checked/expanded controls ship this phase (action row is a single always-enabled button).
- [x] Rating inputs — n/a (ratings are Phase 8; hidden per D-14).
- [x] No color-only status — policy/confidence badges pair color WITH text; the error banner pairs color with copy + a text Retry affordance. (Map canvas is visual-only per D-27; Nearby is the accessible alternative, 03-04.)
- [x] Touch targets ≥44pt — Get Directions button minHeight 48; Retry has hitSlop.
- [x] No `numberOfLines` on critical labels (name, distance, error copy) — none applied.
- [ ] iOS Larger Text (+5) — **deferred to Task 3 device UAT**.

### Error States
- [x] RPC-failure (D-28) handled — banner + Retry; previously-loaded pins remain (TanStack retains last data). Sheet has its own generic "Couldn't load this location" fallback.
- [x] No dead end — the error banner's Retry is a tappable recovery affordance; the zoom-out card resolves by zooming in.
- [x] Auth-required (ERR-10) — n/a: Get Directions has no auth gate (D-21); no auth-gated action ships this phase.
- [x] Failed-verification copy (ERR-09) — n/a (verification is Phase 4). Banner copy is generic and never surfaces server error text (T-03-12).

### Emergency Mode
- [x] Emergency tokens — n/a: no emergency element ships in Phase 3 (Emergency Mode = Phase 8); `colors.emergency` is not used.
- [x] ≥56pt emergency action height — n/a this phase.
- [x] Emergency dismiss explicit — n/a this phase.
- [x] Emergency reachability ≤2 taps — n/a this phase.

## Human Verification Needed (deferred to end-of-phase)

Per the project's default `workflow.human_verify_mode = end-of-phase`, Task 3 (a `checkpoint:human-verify` device gate) was NOT executed as a blocking stop — there is no device/simulator attached to this session, and native Mapbox rendering + @gorhom/bottom-sheet gestures are not observable through jest. It is recorded here verbatim for end-of-phase UAT and is NOT marked complete.

**What was built (to verify on device):** MapScreen (Mapbox map, native-clustered pins, user-location blue dot, 400ms viewport refetch, zoom-out cutoff, RPC-failure banner with stale pins) and the LocationDetail bottom sheet (peek/half/full snap points, confidence badge, RPC-echoed distance, Get Directions to native maps, swipe/tap-outside dismiss). These are the two manual-only surfaces from 03-VALIDATION.md.

**How to verify:**
1. Run on a device/simulator (EAS dev client — Mapbox cannot run in Expo Go): `cd app && npx expo start --dev-client`.
2. Open the Map tab. Confirm the map tile renders immediately and bathroom pins appear shortly after (seed data near Eugene, OR). Confirm pins are colored by policy tag and clusters show a count badge.
3. Pan/zoom; confirm pins refetch ~400ms after motion stops, and zooming far out replaces pins with "Zoom in to see individual locations".
4. Confirm your own location shows as a distinct blue dot.
5. Tap a pin; confirm the sheet opens at peek, drags to half/full, shows name/distance/policy/confidence and "Hours not yet available"; confirm the distance matches your real distance to that pin (proving MapScreen forwarded your coords from useCurrentPosition into the RPC); tap "Get Directions" and confirm the native maps app opens; confirm NO close button and that swipe-down / tap-outside both dismiss.
6. Toggle device dark mode; confirm the map style follows.
7. (If testable) simulate an RPC failure; confirm the error banner + Retry appears and existing pins stay visible.

**Resume signal:** Type "approved", or describe issues (wrong pin colors, sheet doesn't dismiss, directions don't open, distance missing/wrong).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] node_modules absent in the worktree; expo-localization missing from the shared install**
- **Found during:** Task 1 (first test run)
- **Issue:** The worktree had no `node_modules`, and the main repo's install was stale — `expo-localization` (declared in package.json by 03-02, first-party Expo, already slopcheck-`[OK]` in 03-02) was not installed, so `npx tsc --noEmit` failed on the pre-existing `formatDistance.ts` import.
- **Fix:** Junctioned the worktree's `app/node_modules` to the main repo's install, then ran `npm install` (no new package names introduced — it syncs node_modules to the already-declared, already-audited manifest). This is a toolchain sync, not a package addition, so it is outside the Rule 3 package-install exclusion (no new/slop-risk name was chosen).
- **Files modified:** none (environment only; junction is gitignored).
- **Verification:** `npx tsc --noEmit` clean; full suite 269 green.

**2. [Rule 3 - Blocking] @rnmapbox/maps jest mock lacked CircleLayer / UserLocation / default StyleURL**
- **Found during:** Task 1b (MapScreen render test)
- **Issue:** The 03-02 mock only exported string components for MapView/Camera/ShapeSource/SymbolLayer and a named `setAccessToken`; MapScreen needs `CircleLayer`, `UserLocation`, and `Mapbox.StyleURL` (default export). The plan's Task-1 read list explicitly anticipated extending the mock ("extend for CircleLayer if missing").
- **Fix:** Rewrote the mock to render every layer/source as a passthrough `View` (so screen tests can query non-native children) and to expose a default export with `setAccessToken` + `StyleURL`. No other suite imports Mapbox, so no regression (269 tests still green).
- **Files modified:** app/jest.setup.ts
- **Verification:** full suite green; MapScreen test mounts and asserts the map tile + state cards.

### Judgment calls (documented, not defects)
- **Single-pin CircleLayer instead of SymbolLayer/iconImage:** the UI-SPEC sketch shows a `SymbolLayer` with `iconImage` `match`, but no bundled pin image assets exist this phase and registering them is device-only work. A single-pin `CircleLayer` with `circleColor` = `match` on `policyTag` fully honors the §20 rule ("pin color is a data-driven Mapbox `match`, not React state") and renders on device with zero asset registration. A reviewer wanting iconImage symbols can add pin assets in a follow-up without changing the data flow.
- **Cluster bubble color:** rendered in `primary` accent + count rather than the dominant policy-tag color; dominant-color aggregation via `clusterProperties` is deferred as a visual refinement (does not affect correctness or the read contract).

## Threat Flags
None — no new security surface beyond the plan's `<threat_model>`. The sheet renders only `useLocationDetail` fields (03-01 omits access_instructions; test asserts no access-code text — T-03-11); the error banner shows generic copy, never server error text (T-03-12); no lat/lng/address is logged — current coords flow only into the get_location_detail RPC (HTTPS) and Get Directions passes coords only to the OS maps intent (T-03-13). No new package installs (T-03-SC).

## Known Stubs
None that block the plan goal. Two intentional, documented scope boundaries:
- MapScreen calls `useLocationsBbox(viewport!)` with filters defaulted to `{}` — the filter chip row + store wiring is explicitly 03-05's scope (D-05..D-08). Pins render fully unfiltered today, which is correct behavior, not a stub.
- `LocationDetail.hours` renders `{key: value}` lines for object payloads and the explicit "Hours not yet available" copy when null (D-18); real hours data lands in a later phase.

## User Setup Required
- **`EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`** must be set (public Mapbox access token) for the runtime map to render tiles. The `@rnmapbox/maps` config-plugin `RNMapboxMapsDownloadToken` in app.config.ts is build-time only (native SDK fetch) and does NOT authorize runtime tile access. This is a device-UAT prerequisite for Task 3.

## Next Phase Readiness
- 03-04 (Nearby + family toggle) can reuse `LocationDetailSheet` as-is (same props) for row taps, and `useCurrentPosition` for its coords.
- 03-05 (Filters UI) mounts the chip row + empty/denied states as top-anchored overlays on `(tabs)/index.tsx` and passes `activeRpcFilters()` into `useLocationsBbox` + the `queryKey` (see the "How 03-05 mounts…" contract above).
- Device UAT (Task 3) and the Antigravity + Codex review gate remain before phase close (per CLAUDE.md reviewer contract — the user runs the reviewers).

## Self-Check: PASSED

All 6 created/modified source + test files verified on disk; all 3 task commits (`467f7bf`, `5533fd8`, `e903147`) present in git history. Required gates re-run green: `npm test -- src/features/locations/__tests__/useMapViewport.test.ts` passes at 100% coverage; `npx tsc --noEmit` clean; full suite 269 passed / 35 suites.

---
*Phase: 03-read-path-map*
*Completed: 2026-07-06*
