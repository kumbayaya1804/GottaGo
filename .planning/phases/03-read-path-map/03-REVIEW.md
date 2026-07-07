---
phase: 03-read-path-map
reviewed: 2026-07-07T07:19:42Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - app/app.config.ts
  - app/jest.config.js
  - app/jest.setup.ts
  - app/package.json
  - app/src/app/(components)/FilterChipRow.tsx
  - app/src/app/(components)/LocationDetailSheet.tsx
  - app/src/app/(tabs)/index.tsx
  - app/src/app/(tabs)/nearby.tsx
  - app/src/app/(tabs)/profile.tsx
  - app/src/app/__tests__/(components)/FilterChipRow.test.tsx
  - app/src/app/__tests__/(components)/LocationDetailSheet.test.tsx
  - app/src/app/__tests__/(tabs)/MapScreen.test.tsx
  - app/src/app/__tests__/(tabs)/nearby.test.tsx
  - app/src/app/__tests__/(tabs)/profile.test.tsx
  - app/src/features/filters/__tests__/useFiltersStore.test.ts
  - app/src/features/filters/useFiltersStore.ts
  - app/src/features/locations/__tests__/formatDistance.test.ts
  - app/src/features/locations/__tests__/useCurrentPosition.test.ts
  - app/src/features/locations/__tests__/useDeniedLocationState.test.ts
  - app/src/features/locations/__tests__/useFamilyMode.test.ts
  - app/src/features/locations/__tests__/useLocationDetail.test.ts
  - app/src/features/locations/__tests__/useLocationsBbox.test.ts
  - app/src/features/locations/__tests__/useMapViewport.test.ts
  - app/src/features/locations/__tests__/useNearby.test.ts
  - app/src/features/locations/formatDistance.ts
  - app/src/features/locations/types.ts
  - app/src/features/locations/useCurrentPosition.ts
  - app/src/features/locations/useDeniedLocationState.ts
  - app/src/features/locations/useFamilyMode.ts
  - app/src/features/locations/useLocationDetail.ts
  - app/src/features/locations/useLocationsBbox.ts
  - app/src/features/locations/useMapViewport.ts
  - app/src/features/locations/useNearby.ts
  - app/src/lib/database.types.ts
  - app/src/test/fixtures/locations.ts
  - app/src/test/mswServer.ts
  - supabase/migrations/20260704010000_phase3_suppressed_at.sql
  - supabase/migrations/20260704010001_phase3_max_pins_config.sql
  - supabase/migrations/20260704010002_phase3_search_rpcs.sql
  - supabase/migrations/20260704010003_phase3_family_mode_rpc.sql
  - supabase/seed.sql
  - supabase/tests/phase3_read_rpcs.test.sql
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-07-07T07:19:42Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

Reviewed the Phase 3 read-path (map + nearby-list + location-detail) client code and its
three supporting Supabase RPCs/migrations. The moderation/RLS design (suppressed_at,
family_mode server-side lookup, base-table SELECT revocation) is solid and well tested by
the pgTAP suite. However, two Critical defects were found: (1) a client-side crash path in
MapScreen where the denied-location "Search this area" affordance can invoke the bbox query
with a `null` viewport via an unchecked non-null assertion, and (2) a server-side D-08
null-include contract violation — `filter_chill_spot` in both `search_locations_bbox` and
`search_locations_nearby` excludes rows with unknown (`null`) `chill_spot` data, contradicting
the migration's own documented D-08 policy and the client-side test fixtures that assume the
opposite. This exact case has zero pgTAP coverage, which is how it slipped through.

Four Warnings and three Info items are also listed below, covering naming conventions that
likely trip the `react-hooks/rules-of-hooks` lint rule, missing unmount-safety in the GPS
hooks, duplicated permission-request logic across two hooks, and pervasive `as never` type
escapes in MapScreen.

## Critical Issues

### CR-01: MapScreen can crash by dereferencing a null viewport via `viewport!`

**File:** `app/src/app/(tabs)/index.tsx:90` (queryFn), `app/src/app/(tabs)/index.tsx:198-207` (triggering button)

**Issue:** `bboxQuery`'s `queryFn` is `() => useLocationsBbox(viewport!, filters)`, and
`viewport` is `null` until the first debounced `onRegionChange` commit fires
(`useMapViewport.ts:59`, 400ms after the map settles — see `VIEWPORT_DEBOUNCE_MS`). The
query is `enabled: viewport !== null && !belowPinThreshold && !showManualSearch`, so it will
not *auto*-fetch while `viewport` is null. However, the denied-GPS overlay's "Search this
area" button (rendered whenever `showManualSearch` is true, independent of `viewport`) calls
`bboxQuery.refetch()` directly:

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={SEARCH_THIS_AREA}
  onPress={() => bboxQuery.refetch()}
  style={styles.cardButton}
>
```

TanStack Query's `refetch()` bypasses the `enabled` gate by design — it always invokes
`queryFn` when called imperatively. If a user (or an automated test) taps "Search this area"
before the map has ever emitted a settled region-change event (e.g., permission is denied at
launch, so the fallback card renders almost immediately, and the first `onRegionChange`
commit is still up to 400ms+ away), `queryFn` runs with `viewport === null`, and
`viewport!` silences the compiler while `useLocationsBbox` immediately destructures
`viewport.minLng` — throwing `TypeError: Cannot read properties of null (reading 'minLng')`
and crashing the screen.

**Fix:** Guard the callback (and/or the queryFn) against a null viewport:

```tsx
onPress={() => {
  if (viewport !== null) bboxQuery.refetch();
}}
```

or make `useLocationsBbox` / the queryFn defensive:

```ts
queryFn: () => {
  if (viewport === null) return EMPTY_FC;
  return useLocationsBbox(viewport, filters);
},
```

### CR-02: `filter_chill_spot` violates the migration's own D-08 null-include contract

**File:** `supabase/migrations/20260704010002_phase3_search_rpcs.sql:106,141` (`search_locations_bbox`), `:222` (`search_locations_nearby`)

**Issue:** The migration's header comment states the D-08 design principle explicitly:

> (a) D-08 null-include: a row with missing underlying data is INCLUDED when the filter is
> active, never hidden

This is correctly implemented for `filter_open_now` (`l.is_open_now is not false` — null
survives), `filter_high_conf` (`l.confidence_tier is null or l.confidence_tier = 'High'`), and
the tag-based `filter_wheelchair` / `filter_changing` (explicit "no tags at all" escape
branch). But `filter_chill_spot` uses strict equality with no null escape:

```sql
and (not filter_chill_spot or l.chill_spot = true)
```

Since `chill_spot` is a nullable boolean (`chill_spot boolean | null` per
`app/src/lib/database.types.ts`), a row with `chill_spot IS NULL` (missing data) evaluates
`NULL = true` → `NULL`, which is falsy in a `WHERE` clause — the row is silently **excluded**
when `filter_chill_spot` is active. This is the opposite of the documented D-08 behavior and
inconsistent with the sibling `is_open_now` filter in the very same function, which uses
`is not false` specifically to null-include.

This is untested: `supabase/seed.sql`'s row 09 (the dedicated D-08 "no tags" fixture) has
`chill_spot: false` (not null), and `supabase/tests/phase3_read_rpcs.test.sql` §6 tests D-08
null-include only for `open_now`, `confidence_tier`, and the two tag filters — never for
`chill_spot`. The client-side fixture (`app/src/test/fixtures/locations.ts` row 4, "Unknown
Data Restroom", `chill_spot: null`) exists specifically to exercise this D-08 case, but the
client only mocks canned RPC responses — it never exercises the real SQL predicate, so this
gap was invisible to the test suite on either side of the stack.

**Fix:** Apply the same null-include pattern used for `is_open_now` in both RPCs:

```sql
and (not filter_chill_spot or l.chill_spot is not false)
```

And add a pgTAP case mirroring §6's existing D-08 assertions (a seed row with
`chill_spot = null` that must appear in results when `filter_chill_spot` is active).

## Warnings

### WR-01: Data-fetch functions are named with the `use` prefix but are not hooks, and are invoked from non-hook contexts

**File:** `app/src/features/locations/useLocationsBbox.ts:56`, `app/src/features/locations/useNearby.ts:21`, `app/src/features/locations/useLocationDetail.ts:13`

**Issue:** `useLocationsBbox`, `useNearby`, and `useLocationDetail` are plain `async`
functions (no hook calls inside them) but are named as if they were React hooks. They are
invoked from inside `queryFn` callbacks that are neither components nor hooks:

- `app/src/app/(tabs)/index.tsx:90` — `queryFn: () => useLocationsBbox(viewport!, filters)`
- `app/src/app/(tabs)/nearby.tsx:62` — `queryFn: () => useNearby(coords!.userLat, coords!.userLng, filters)`
- `app/src/app/(components)/LocationDetailSheet.tsx:130-131` — `queryFn: () => useLocationDetail(...)`

`eslint-config-expo` bundles `eslint-plugin-react-hooks`, whose `rules-of-hooks` rule flags
any call to a `use*`-named function from a function that is neither a component nor a
`use*`-named hook — regardless of whether the callee actually calls other hooks internally.
`queryFn` (an anonymous/inferred-named callback passed as an object property) satisfies
neither condition, so this pattern is very likely to trip that lint rule and/or mislead future
maintainers into treating these as hooks (e.g. trying to call another hook inside them, or
calling them conditionally without realizing they're plain functions).

**Fix:** Rename to non-hook-looking names, e.g. `fetchLocationsBbox`, `fetchNearby`,
`fetchLocationDetail`, keeping the existing hooks (`useCurrentPosition`, `useFamilyMode`, etc.)
that legitimately use React hook internals as the only `use*`-prefixed exports.

### WR-02: `useCurrentPosition` / `useDeniedLocationState` have no unmount guard around their async permission chain

**File:** `app/src/features/locations/useCurrentPosition.ts:39-62`, `app/src/features/locations/useDeniedLocationState.ts:34-40`

**Issue:** Both hooks kick off an async `Location.requestForegroundPermissionsAsync().then(...)`
chain in a `useEffect` with no cancellation/`isMounted` guard and no cleanup function. If the
owning screen unmounts before the promise resolves (e.g., fast navigation away from the Map
or Nearby tab immediately after mount), `setState`/`setPermission` will still be called on an
unmounted component. React 18 no longer logs a console warning for this, but it is still a
correctness smell (wasted work, potential to interact badly with concurrent rendering / Strict
Mode double-invocation) and diverges from the cleanup pattern already used correctly in
`useMapViewport.ts:80-86`.

**Fix:** Track a mounted flag (or use an `AbortController`-style ref) and skip the state
update if the effect has been cleaned up:

```ts
useEffect(() => {
  let cancelled = false;
  Location.requestForegroundPermissionsAsync().then((perm) => {
    if (cancelled) return;
    // ...
  });
  return () => { cancelled = true; };
}, []);
```

### WR-03: Two hooks independently call the OS foreground-permission API on the same screen

**File:** `app/src/features/locations/useCurrentPosition.ts:40`, `app/src/features/locations/useDeniedLocationState.ts:35`, consumed together in `app/src/app/(tabs)/index.tsx:73-74`

**Issue:** `MapScreen` mounts both `useCurrentPosition()` and `useDeniedLocationState()`, and
each independently calls `Location.requestForegroundPermissionsAsync()` in its own effect on
mount. This means two concurrent, uncoordinated calls into the native permission API for the
same logical decision. The code comments acknowledge the two hooks are "complementary" and
that `useDeniedLocationState` "reuses [`useCurrentPosition`'s] `PermissionStatus` enum rather
than inventing a parallel shape" — but it does not reuse the actual permission-fetching
call, only the type. This is duplicated logic with no single source of truth for the
permission decision, and there's no protection against the two hooks momentarily disagreeing
if the two native calls resolve out of order or a platform queues/dedupes them differently.

**Fix:** Have `useDeniedLocationState` derive `showManualSearch` from `useCurrentPosition()`'s
`status` field instead of issuing its own independent permission request, or lift a single
shared permission-status hook that both consume.

### WR-04: Pervasive `as never` casts erase type safety on Mapbox props in MapScreen

**File:** `app/src/app/(tabs)/index.tsx:144,158,162,172,178`

**Issue:** MapScreen casts `onRegionChange`, `shape`, `onPress`, `textField`, and `circleColor`
all `as never` to satisfy the `@rnmapbox/maps` prop types. `as never` is a stronger escape
hatch than `as any` — it tells the compiler "this value can never occur here," which silently
suppresses all structural checking on these props (including future refactors that change the
shape of `handleShapePress`, `pinColor`, or `featureCollection`). A local, narrower type (even
a hand-written `as unknown as ExpectedPropType`) would preserve at least some safety net if the
Mapbox types improve or the surrounding code changes shape.

**Fix:** Prefer a scoped `as unknown as <ExpectedType>` or a small wrapper type over `as never`
so a genuine type mismatch introduced later isn't silently accepted.

## Info

### IN-01: `currentRegion()` fallback can mistake a bare language subtag for a region code

**File:** `app/src/features/locations/formatDistance.ts:14-22`

**Issue:** When `expo-localization` doesn't supply a region, the fallback splits the Intl
locale string on `-` and takes the last segment as the "region" if it's 2 letters long:

```ts
const segments = intlLocale.split('-');
const candidate = segments[segments.length - 1];
return candidate.length === 2 ? candidate.toUpperCase() : null;
```

For a region-less locale like `'en'` (no `-XX` suffix), `segments` is `['en']` and
`candidate` is `'en'` — a *language* subtag, not a region — which happens to be 2 letters and
so passes the length check, producing a synthetic "region" of `'EN'`. `'EN'` isn't in
`MILE_REGIONS`, so today this doesn't change behavior, but the logic itself conflates language
and region subtags and would silently misclassify a real device locale in this shape (this
fallback branch is only exercised when `expo-localization` fails to report a region at all,
so the practical blast radius is small, hence Info rather than Warning).

**Fix:** Only treat the segment as a region if the locale string actually contained a `-`
separator (i.e., `segments.length > 1`), rather than accepting a single-segment locale's own
language code as a region candidate.

### IN-02: `BboxRpcFilters.max_pins` is defined but never sent by any real call site

**File:** `app/src/features/locations/useLocationsBbox.ts:27`

**Issue:** `BboxRpcFilters` declares an optional `max_pins?: number`, and the RPC/migration
support a client-supplied `max_pins` that the server clamps against `app_config`. No
production code path (MapScreen, `useFiltersStore.activeRpcFilters()`) ever sets it — it's
only exercised in `useLocationsBbox.test.ts`. Harmless, but it's speculative/unused surface
that could be removed or explicitly deferred to whichever phase adds a client-tunable pin
density control.

**Fix:** Either wire it up from a real UI control, or drop it from the client-facing type
until a caller exists, to avoid unused-but-plausible-looking API surface.

### IN-03: `hoursLines` silently drops non-string hour values with no fallback signal

**File:** `app/src/app/(components)/LocationDetailSheet.tsx:104-114`

**Issue:** For object-shaped `hours`, only entries whose value is a `string` are kept; any
other value shape (e.g., a nested `{ open, close }` object per day) is filtered out with no
distinguishing signal from "hours truly absent." If the RPC ever returns a richer/nested
`hours` shape, the sheet will render the "Hours not yet available" copy even though data does
exist, which could look like a data-completeness regression rather than the intentional
`hours === null` case (D-18).

**Fix:** Consider a defensive fallback state distinct from "no hours data" for the case where
`hours` is present but not the recognized flat string-map shape, or document that
`get_location_detail` is contractually guaranteed to only ever return a flat string map.

---

_Reviewed: 2026-07-07T07:19:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
