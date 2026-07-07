# Phase 3 — Plan 03-05 Summary

**Completed:** 2026-07-06
**Plan:** Filter chips + denied-GPS fallback (last read-path surface)
**Status:** Tasks 1–2 COMPLETE — Task 3 (device verification) deferred to end-of-phase UAT

---

## Commits

| SHA | Description |
|-----|-------------|
| `fd5f1e1` | feat(03-05): denied-location state hook + FilterChipRow component |
| `8c610b1` | test(03-05): failing tests for chip row mount + denied fallback + empty states (RED) |
| `597bd89` | feat(03-05): mount chip row + denied fallback + empty/filtered-empty states (GREEN) |

---

## D-34 Scope Confirmation

Decision D-34 (denied-GPS fallback narrowed to recenter + "Search this area", no external geocoding) was **approved 2026-07-05** before this plan executed — not a live decision during this run. Implemented exactly as approved: no geocoding provider, no persistent search-bar component. `ROADMAP.md` SC6 and `03-UI-SPEC.md` ERR-01 already carry the narrowing note from the approval; no further wording revision was needed here.

---

## FilterChipRow Contract

`app/src/app/(components)/FilterChipRow.tsx` — default export, no props. Reads `useFiltersStore` directly (five chips: Changing Table, Wheelchair, Chill Spot, Open Now, Clean: 4+). Each chip: `accessibilityRole="button"`, `accessibilityLabel={label}`, `accessibilityState={{selected}}`, primary-fill when active. Toggling calls the store's `toggle(key)` — no local filter state, no duplicate logic.

## useDeniedLocationState API

`app/src/features/locations/useDeniedLocationState.ts` — exports `useDeniedLocationState(): { permission: 'granted'|'denied'|'undetermined', showManualSearch: boolean }`. Wraps `expo-location.requestForegroundPermissionsAsync()` following the Phase 2 `gpsConsent.ts` convention; reuses `useCurrentPosition`'s `PermissionStatus` type rather than a parallel shape. `showManualSearch` is true only when `permission === 'denied'`.

## MapScreen (`index.tsx`) Additions

- `FilterChipRow` mounted absolutely at the top of the screen (no search-bar component exists — see 03-UI-SPEC.md's 2026-07-05 narrowing note).
- `useLocationsBbox` query key now includes `activeRpcFilters()`; toggling a chip re-queries (D-07, AND logic enforced server-side).
- When `showManualSearch`: chip row and pins hidden, `[LOCKED ERR-01]` copy shown verbatim with a "Search this area" button (`bboxQuery.refetch()`), no dead end.
- `isEmptyResult` derived from `bboxQuery.isSuccess && features.length === 0 && !showManualSearch`; distinguishes truly-empty (`hasActiveFilter === false`) from filtered-empty (`hasActiveFilter === true`) using the `[LOCKED]` copy from 03-UI-SPEC.md. Filtered-empty adds a "Clear filters" button calling `useFiltersStore().clearAll()`.
- Preserves 03-03's RPC-error banner + stale-pins behavior (D-28) and the pin-tap → `LocationDetailSheet` coordinate forwarding — neither was touched.

---

## Test Suite State

- `cd app && npm test` — **283 passed / 37 suites** (one pre-existing flaky test in `profile.test.tsx`, unrelated to this plan — untouched file, passes reliably in isolation and on a clean full-suite re-run; not caused by this work).
- `cd app && npx tsc --noEmit` — clean.
- New MapScreen tests (12 total, 7 new for this plan): chip row renders on grant, chip toggle re-queries with filter, denied state hides chips + shows ERR-01 + no dead end, truly-empty vs filtered-empty distinction, Search this area re-query, Clear filters reset.

---

## design-system.md §20 Component Acceptance Checklist

Cited per ROADMAP SC10 — `FilterChipRow` and the MapScreen overlay additions use only `Colors[colorScheme]` / `spacing` / `typography` / `radius` tokens (no raw hex/magic numbers; D-33 exception for the Phase 1.5 token set stands, not re-flagged). All interactive elements (chips, Search this area, Clear filters) meet the 44pt minimum touch target and carry `accessibilityRole`/`accessibilityLabel`/`accessibilityState` where applicable.

---

## Human Verification Needed (deferred to end-of-phase per `workflow.human_verify_mode` default)

**What was built:** The filter chip row (AND logic, session persistence), the denied-GPS manual-search fallback (narrowed scope per D-34: recenter + Search this area), and the distinct truly-empty vs filtered-empty states on the MapScreen — the interactive filter/permission behaviors not observable through jest.

**How to verify:**
1. Run the app: `cd app && npx expo start --dev-client`.
2. On the Map tab, toggle filter chips. Confirm the pin set narrows with AND logic (selecting two chips shows only locations matching both), active chips show the primary fill, and a location missing that data is still shown (not silently hidden).
3. Navigate to another tab and back; confirm filters persist. Fully kill and relaunch the app; confirm filters reset to none.
4. Select filters that match nothing; confirm "No bathrooms match your filters" with a Clear filters affordance (distinct from the truly-empty state). Tap Clear filters; confirm pins return.
5. Deny location permission (OS settings); confirm the map shows the manual search entry + ERR-01 copy and a Search this area button — no dead-end blank screen (recenter + Search this area, per D-34).
6. Pan to an empty area; confirm "Search this area" re-runs the query for the current viewport.

**Resume signal:** "approved" or describe issues (e.g. filters use OR instead of AND, denied state dead-ends, empty states not distinct).

---

## Success Criteria Status

- ROADMAP SC6 (denied permission → no-dead-end fallback): implemented, pending device confirmation.
- SC7 (named no-results state with Search this area): implemented and distinct from filtered-empty, pending device confirmation.
- REQ-FILTER (AND logic D-07, null-include D-08): delivered — AND/null-include already enforced server-side (03-01), this plan wires the client trigger only.
- No external geocoding dependency added (OQ-4 / D-34): confirmed — `expo-location` only, no new packages.
