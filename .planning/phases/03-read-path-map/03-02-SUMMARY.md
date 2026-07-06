---
phase: 03-read-path-map
plan: 02
subsystem: api
tags: [react-query, zustand, mmkv, expo-location, expo-localization, geojson, msw, supabase-rpc, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Live read RPCs (search_locations_bbox, search_locations_nearby, get_location_detail) + update_profile family_mode extension + authoritative database.types.ts"
provides:
  - "features/locations data layer: useLocationsBbox (+GeoJSON), useLocationDetail, useNearby, useCurrentPosition, useFamilyMode, formatDistance"
  - "features/filters Zustand store (AND-logic chips, MMKV session-persist, cold-start reset)"
  - "Public-safe camelCase location types + GeoJSON FeatureCollection type + CurrentPosition type (no door-code field)"
  - "Shared MSW handlers for the four Phase 3 RPCs + typed location fixtures"
  - "useCurrentPosition — the SINGLE live-coordinate source 03-03/03-04 must consume (gpsConsent.ts exposes no coords)"
affects: [03-03-map, 03-04-nearby-family-toggle, 03-05-filters-ui]

# Tech tracking
tech-stack:
  added: ["@gorhom/bottom-sheet@5.2.14", "expo-localization@~55.0.16"]
  patterns:
    - "Plain async data functions (profileStats analog) — useQuery/user-scoping lives in screens, except intrinsically user-scoped useFamilyMode"
    - "Shared toMapLocation snake→camel mapper reused by bbox/nearby/detail"
    - "GeoJSON FeatureCollection transform with [lng,lat] Point geometry for Mapbox ShapeSource"
    - "Zustand persist + MMKV with a per-process session token to distinguish cold start (reset) from within-session navigation (preserve)"

key-files:
  created:
    - app/src/features/locations/types.ts
    - app/src/features/locations/useLocationsBbox.ts
    - app/src/features/locations/useLocationDetail.ts
    - app/src/features/locations/useNearby.ts
    - app/src/features/locations/useCurrentPosition.ts
    - app/src/features/locations/useFamilyMode.ts
    - app/src/features/locations/formatDistance.ts
    - app/src/features/filters/useFiltersStore.ts
    - app/src/test/mswServer.ts
    - app/src/test/fixtures/locations.ts
  modified:
    - app/package.json
    - app/app.config.ts
    - app/jest.config.js
    - app/jest.setup.ts

key-decisions:
  - "Read hooks are plain async functions (not React hooks); TanStack useQuery + user-scoping deferred to the screens (03-03/04/05)"
  - "useCurrentPosition is the one shared expo-location coordinate source; gpsConsent.ts stays consent-only"
  - "formatDistance uses the 0.1-mi feet threshold (RESEARCH code + acceptance 'sub-0.1mi'), so 500m→'0.3 mi' — the plan's '(500,true)→feet' example was arithmetically inconsistent"
  - "Filters cold-start reset implemented via a per-process session token compared in the persist merge()"
  - "Aligned the react-native-mmkv jest mock + store to the installed v4 API (createMMKV factory, remove()) — the mock assumed the removed v3 new-MMKV()/delete() API"

patterns-established:
  - "toMapLocation shared mapper (null-safe ?? defaults) as the single snake→camel boundary"
  - "Session-token-guarded Zustand+MMKV persistence for session-only client state"

requirements-completed: [REQ-MAP, REQ-DETAIL, REQ-FILTER, REQ-NEARBY, REQ-FAMILY-TOGGLE]

# Metrics
duration: ~55min
completed: 2026-07-06
---

# Phase 3 Plan 02: Read-Path Client Data Layer Summary

**Interface-first features/locations data layer — bbox→GeoJSON, detail (distanceM), distance-sorted nearby, a shared expo-location coordinate source, user-scoped family_mode read/write, locale distance formatting, and a Zustand+MMKV filters store — all at 100% branch coverage under TDD.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (Tasks 2 & 3 TDD: RED→GREEN)
- **Files created:** 10 source/test-infra + 7 test files
- **Files modified:** 4 (package.json, app.config.ts, jest.config.js, jest.setup.ts)
- **Tests:** full suite 249 passed / 32 suites; new modules 100% lines/branches/functions/statements

## Accomplishments
- Eight source modules + shared MSW/fixture test infra, defined first so 03-03/04/05 wire against stable, tested contracts.
- `useCurrentPosition` established as the single live-coordinate source (Codex MEDIUM fix) — map and Nearby both forward its `{userLat,userLng}` into `useLocationDetail`/`useNearby`.
- 100% coverage gate on `src/features/**` maintained; `npx tsc --noEmit` clean.

## Exact exported contracts (for 03-03 / 03-04 / 03-05)

### `features/locations/types.ts`
- **camelCase `MapLocation`:** `{ id, name, lat, lng, policyTag, confidenceTier, verificationCount, lastVerifiedAt, isOpenNow, chillSpot }`
- **`NearbyLocation`** = `MapLocation` + `distanceM: number`
- **`LocationDetail`** = `MapLocation` + `{ address: string|null, hours: unknown, distanceM: number|null }` — **no door-code field**
- **GeoJSON:** `LocationFeatureCollection` → `features[]` of `LocationFeature` = `{ type:'Feature', geometry:{ type:'Point', coordinates:[lng,lat] }, properties: LocationFeatureProperties }`
  - **`LocationFeatureProperties` keys:** `id, name, policyTag, confidenceTier, verificationCount, lastVerifiedAt, isOpenNow, chillSpot`
- **`CurrentPosition`** = `{ userLat: number; userLng: number } | null`
- snake-case wire rows also exported: `BboxRpcRow`, `NearbyRpcRow`, `LocationDetailRpcRow`

### `useLocationsBbox.ts`
- `useLocationsBbox(viewport: BboxViewport, filters?: BboxRpcFilters): Promise<LocationFeatureCollection>`
  - `BboxViewport` = `{ minLng, minLat, maxLng, maxLat }` → RPC args `{ min_lng, min_lat, max_lng, max_lat, ...filters }`
  - `BboxRpcFilters` (all optional): `filter_open_now, filter_chill_spot, filter_wheelchair, filter_changing, filter_high_conf, max_pins`
- `toMapLocation(row: BboxRpcRow): MapLocation` — exported shared mapper (`verificationCount ?? 0`, `isOpenNow ?? false`, `chillSpot ?? false`; policyTag/confidenceTier/lastVerifiedAt pass through nullable)

### `useLocationDetail.ts`
- `useLocationDetail(id: string, userLat?: number, userLng?: number): Promise<LocationDetail>`
  - Forwards `{ location_id, user_lat, user_lng }` only when BOTH coords supplied; otherwise `{ location_id }`
  - Maps `distance_m → distanceM` (null when coords omitted); throws `'Location not found'` on empty result

### `useNearby.ts`
- `useNearby(userLat: number, userLng: number, filters?: NearbyRpcFilters): Promise<NearbyLocation[]>`
  - `NearbyRpcFilters`: `result_limit, filter_open_now, filter_chill_spot, filter_wheelchair, filter_changing, filter_high_conf`
  - Preserves the RPC's ascending distance order (non-decreasing by `distanceM`)

### `useCurrentPosition.ts` — THE single live-coordinate source (NOT gpsConsent.ts)
- `useCurrentPosition(): { coords: CurrentPosition; status: 'granted'|'denied'|'undetermined'; isStale: boolean }`
  - Wraps expo-location `requestForegroundPermissionsAsync` + `getCurrentPositionAsync`
  - Returns `coords: null` on denied/undetermined/pre-fix; **never throws** on denied
  - `isStale` = fix older than `POSITION_FRESHNESS_MS` (exported, 60_000)
  - **03-03 (Map) and 03-04 (Nearby) MUST consume this** for the `userLat`/`userLng` they pass into `useLocationDetail`/`useNearby`. Does not duplicate gpsConsent.ts's consent DB write.

### `formatDistance.ts`
- `formatDistance(meters: number, usesMiles: boolean): string` — imperial: `<0.1mi → 'N ft'` else `'N.N mi'`; metric: `<1000m → 'N m'` else `'N.N km'`
- `usesMilesForLocale(): boolean` — expo-localization region ∈ {US,GB,LR,MM}, Intl-locale trailing-region fallback

### `useFamilyMode.ts` (user-scoped)
- `familyModeQueryKey(userId: string | undefined) => ['familyMode', userId]` (**query-key shape**; user-id-scoped to block cross-user cache leak)
- `getFamilyMode(userId: string): Promise<boolean>` — `.from('users').select('family_mode').eq('id',userId).single()`, `?? false` default
- `setFamilyMode(value: boolean): Promise<void>` — `rpc('update_profile', { new_family_mode: value })` **only** (never sends `new_display_name`)
- `useFamilyMode()` hook → `{ familyMode, isLoading, isError, setFamilyMode, isSaving }`; `queryKey: familyModeQueryKey(session?.user.id)`, `enabled: session !== null`

### `features/filters/useFiltersStore.ts`
- Zustand store state (all default false, D-05): `openNow, chillSpot, wheelchair, changing, highConf`
- **Actions:** `toggle(key: FilterKey)`, `clearAll()`
- **Selector:** `activeRpcFilters()` → `{ filter_open_now, filter_chill_spot, filter_wheelchair, filter_changing, filter_high_conf }`
- Exports: `EMPTY_FILTERS`, `FILTERS_STORAGE_KEY`, `PROCESS_SESSION_ID`, `mmkvFilterStorage`, `mergePersistedFilters(persisted, current, processId)`
- Persistence: MMKV, session-persist within a process (D-06); cold start (new process token) resets to empty (D-05)

## Task Commits

1. **Task 1: packages + MSW + fixtures + types** - `babf4c1` (feat)
2. **Task 2 RED: read-hook + formatDistance tests** - `80301f2` (test)
3. **Task 2 GREEN: read hooks + formatDistance** - `2eb001d` (feat)
4. **Task 3 RED: useFamilyMode + filters store tests** - `d2e9cd7` (test)
5. **Task 3 GREEN: useFamilyMode + filters store** - `6121d7a` (feat)

## Files Created/Modified
- `app/src/features/locations/{types,useLocationsBbox,useLocationDetail,useNearby,useCurrentPosition,useFamilyMode,formatDistance}.ts` - data layer
- `app/src/features/filters/useFiltersStore.ts` - Zustand filter store
- `app/src/test/mswServer.ts` - MSW handlers for the four RPCs + `setupMswLifecycle()`
- `app/src/test/fixtures/locations.ts` - typed RPC-row fixtures (High/Medium/Low + null-data D-08)
- `app/package.json` - @gorhom/bottom-sheet + expo-localization (no supercluster)
- `app/app.config.ts` - expo-localization config plugin
- `app/jest.config.js` - excluded `src/test/**` from the coverage gate (test infra)
- `app/jest.setup.ts` - react-native-mmkv mock aligned to v4 (createMMKV/remove)

## Decisions Made
- Read hooks are plain async functions; the screens own `useQuery` + user-scoping (mirrors features/profile). `useFamilyMode` is the exception (intrinsically user-scoped).
- `formatDistance` feet threshold is 0.1 mi (matches RESEARCH code example + acceptance's "sub-0.1mi"); see Deviation 1.
- Filters cold-start reset via a per-process token compared in persist `merge()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `formatDistance` plan example was arithmetically inconsistent**
- **Found during:** Task 2 (formatDistance)
- **Issue:** The plan's behavior example "(500, usesMiles=true) → feet" contradicts both the RESEARCH code (`mi < 0.1` feet threshold) and the acceptance criterion's "sub-0.1mi feet branch" — 500 m is ≈0.31 mi, well above 0.1 mi.
- **Fix:** Implemented the documented 0.1-mi threshold; 500 m therefore renders as `"0.3 mi"`. Tested the true feet branch with a genuinely sub-0.1mi value (100 m → `"328 ft"`) plus the 1000 m metric boundary.
- **Files modified:** app/src/features/locations/formatDistance.ts, __tests__/formatDistance.test.ts
- **Verification:** 100% branch coverage; the ft/mi/m/km branches + 1000m boundary all asserted.
- **Committed in:** `2eb001d`

**2. [Rule 3 - Blocking] react-native-mmkv jest mock assumed the removed v3 API**
- **Found during:** Task 3 (filters store)
- **Issue:** Installed react-native-mmkv is v4, where `MMKV` is a type-only export and the value factory is `createMMKV()`, with `remove(key)` (no `delete`). The shared jest.setup mock and any `new MMKV()` usage would break tsc and diverge from runtime.
- **Fix:** Store uses `createMMKV()` + `mmkv.remove()`; updated the jest.setup mock to expose `createMMKV` (and a compatible `MMKV`) backed by a shared Map with v4 method names.
- **Files modified:** app/src/features/filters/useFiltersStore.ts, app/jest.setup.ts, __tests__/useFiltersStore.test.ts
- **Verification:** `npx tsc --noEmit` clean; full suite 249 tests green.
- **Committed in:** `6121d7a`

**3. [Rule 3 - Blocking] Test-infra coverage exclusion**
- **Found during:** Task 1
- **Issue:** `src/test/**` (MSW handlers, fixtures) is caught by the `src/**` coverage collector but is support code, not product code under the 100% gate.
- **Fix:** Added `!src/test/**` to `collectCoverageFrom` in jest.config.js.
- **Files modified:** app/jest.config.js
- **Verification:** Full suite green with the gate intact on `src/features/**` + `src/lib/**`.
- **Committed in:** `babf4c1`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All necessary for correctness/consistency and to match the installed toolchain. No scope creep — no new product surface added beyond the plan's file list.

## Issues Encountered
- Jest prints "A worker process has failed to exit gracefully" — a benign teardown artifact from TanStack Query's default gc timer in the `useFamilyMode` hook test. Jest force-exits; all 249 tests pass deterministically and coverage is unaffected. Non-blocking; noted for the screen plans that mount QueryClients.

## Threat Flags
None — no new security surface beyond the plan's `<threat_model>`. Client carries no door-code field (types + detail hook verified), family_mode write posts only `new_family_mode`, and `useCurrentPosition` holds coords in memory only.

## Known Stubs
None — every module is fully wired and tested. `LocationDetail.hours` is typed `unknown` and `distanceM` may be null by design (RPC contract), not a stub.

## User Setup Required
None — no external service configuration required. (expo-localization is a config-plugin dependency; it takes effect on the next native/dev-client build, which is already part of the Phase 1 EAS workflow.)

## Next Phase Readiness
- 03-03 (Map), 03-04 (Nearby + family toggle), 03-05 (Filters UI) can wire directly against the signatures above with no codebase exploration.
- Screens must wrap these async functions in `useQuery` with **user-scoped** keys (see profile.tsx precedent) and consume `useCurrentPosition` for live coordinates.
- Standing gap carried from 03-01: the pgTAP RPC suite still needs a Docker-capable environment to actually execute before Phase 3 final verification.

## Self-Check: PASSED

All 10 created source/test-infra files + SUMMARY.md verified on disk; all 5 task commits (`babf4c1`, `80301f2`, `2eb001d`, `d2e9cd7`, `6121d7a`) present in git history.

---
*Phase: 03-read-path-map*
*Completed: 2026-07-06*
