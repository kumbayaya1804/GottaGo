# Phase 3: Read Path & Map - Research

**Researched:** 2026-07-04
**Domain:** PostGIS spatial read RPCs (Supabase) + React Native map rendering (@rnmapbox/maps) + bottom-sheet detail + accessible list view
**Confidence:** HIGH (schema is live and inspected; stack is installed and version-verified; clustering discrepancy resolved against source code, not speculation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Map Viewport & Refresh**
- **D-01:** Auto-refetch `search_locations_bbox` as user pans/zooms, debounced 400ms after map stops moving.
- **D-02:** Reuse Phase 1.5 loading pattern (pins appear as data arrives; subtle non-blocking banner only if fetch exceeds 2s) — no new loading UI.
- **D-03:** Map viewport (center/zoom) persists within a session — returning to Map does NOT snap back to live GPS. Resets only on cold start.
- **D-04:** Beyond a max zoom-out threshold, stop loading individual pins and show "Zoom in to see individual locations". (Threshold: derived from D-15/D-32 pin cap — Claude's discretion.)

**Filters**
- **D-05:** Filter chips reset on cold start; no filter active by default on fresh launch.
- **D-06:** Filters persist within a session.
- **D-07:** Multiple selected filters use AND logic (match ALL selected, not any).
- **D-08:** Uniform policy across every data-dependent filter (Currently Open, Wheelchair, Changing Table, Cleanliness): a location with missing/null underlying data is INCLUDED by default, never silently excluded. Applies even though underlying data won't exist until Phase 4/8.

**No-Results State**
- **D-09:** "Search this area" re-runs the bbox query for the current viewport (NOT radius expansion).
- **D-10:** Distinguish "no bathrooms match your filters" (filtered-empty, with clear-filters affordance) from "no bathrooms found nearby" (truly empty).
- **D-11:** Keep the "Search this area" button even though auto-refetch (D-01) covers panning.

**LocationDetail Scope**
- **D-12:** Build the full peek/half/full bottom-sheet component matching Phase 1.5 design now (not a placeholder).
- **D-13:** Verify/Rate/Report action-row buttons are HIDDEN ENTIRELY (not shown-disabled) until their phases (4/8/6-7). Action row appears once first action (Verify, Phase 4) lands.
- **D-14:** Timing tips and ratings-summary sections hidden entirely until Phase 4/8 populate real data.
- **D-15:** Show the full designed confidence badge now (colored pill + tier text + verification count, e.g. "High — 14 GPS verifications") — `confidence_scores`/`verification_count` data already exists.
- **D-16:** "Last verified" displays as a relative label ("Verified 3 days ago"), not an exact timestamp.
- **D-17:** Dismiss via swipe-down or tap-outside — no explicit close button.
- **D-18:** When a location has no hours data, show explicit "Hours not yet available" copy rather than hiding the section.

**Directions (new addition)**
- **D-19:** Add "Get Directions" to the standard LocationDetail action row — opens the device's native maps app with destination coordinates (same mechanism as Emergency Mode's "Navigate").
- **D-20:** Positioned first/leftmost: `[Get Directions] [GPS Verify] [Rate] [Report]` (latter three hidden per D-13).
- **D-21:** No auth gate on Get Directions — available to anonymous browsers.

**Distance & Units**
- **D-22:** Distance is straight-line/geodesic (PostGIS `ST_Distance`), NOT routing/walking-time.
- **D-23:** Display units auto-detect by device locale (miles for US/UK-locale, km/m elsewhere).

**Anonymous User Access**
- **D-24:** Anonymous users see everything in search results and LocationDetail EXCEPT the access code.

**Map Visuals**
- **D-25:** Mapbox style switches light/dark matching app theme.
- **D-26:** Standard "you are here" blue-dot for live GPS via Mapbox built-in user-location layer.
- **D-27:** Map screen is visual-only — no pin-level screen-reader support required. Nearby list (D-29) is the accessible alternative.

**RPC / Network Failure**
- **D-28:** On full RPC failure, show explicit error banner + Retry — never fail silently. Previously-loaded (stale) pins remain visible under the banner.

**Scope Additions**
- **D-29:** Nearby list-view tab (accessible alt to map), new plan **03-04**, reuses same bbox/nearby RPC data, rendered as a sorted-by-distance list. Depends on 03-01.
- **D-30:** family_mode Settings toggle. Write path extends existing `update_profile` RPC (Phase 2, SECURITY DEFINER, authed-only) with an optional `family_mode` param. Folded into plan 03-04.
- **D-31:** Dev-only seed script/migration (~10-20 fake locations), dev/local only, never production. Geographic center = Claude's discretion (Eugene, OR suggested, not locked).
- **D-32:** Max pins per viewport (~200) as a tunable `app_config` value, not a hardcoded constant — admin-editable via Supabase Studio.
- **D-33:** Accepted exception — Phase 1.5 typography/spacing tokens exceed gsd-ui-checker generic thresholds. Do NOT re-flag. (Documentation exception, not implementation-relevant.)

### Claude's Discretion
- Exact geographic center/coordinates for dev seed data (D-31).
- Exact max zoom-out threshold for D-04's pin-loading cutoff.
- Clustering implementation approach — **RESOLVED in this research** (see Open Question OQ-1 → native `ShapeSource` clustering). ARCHITECTURE.md is authoritative; its "server returns raw points, client clusters visually" principle is fully satisfied by native Mapbox clustering.

### Deferred Ideas (OUT OF SCOPE)
- Emergency Mode UI (FAB, bottom sheet, mode chips) — Phase 8. Phase 3 builds only the `search_locations_nearby` RPC.
- Pending-pin display (submitter-only gray dashed pin) — Phase 4.
- Access code display + reveal UX — write path Phase 4; reveal gate Phase 8 (`08-02`).
- Ratings, timing tips, reports — Phases 8, 4, 6/7. LocationDetail sections built but hidden (D-14).
- Apple Sign-In / iOS parity — Phase 9.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID (from description) | Description | Research Support |
|-----------------------|-------------|------------------|
| REQ-MAP | User can view a map of bathrooms near their current GPS location | `search_locations_bbox` RPC (03-01) + `@rnmapbox/maps` MapView with `ShapeSource`/`SymbolLayer` native clustering (03-02). Pattern in §Architecture Pattern 1–2. |
| REQ-SEARCH | User can search for bathrooms in any city/area (manual search fallback for denied GPS) | GPS-denied state (ERR-01) opens manual place search; bbox RPC re-runs on viewport change. Note: address→coord geocoding (Google Places) is referenced in UI-SPEC — see Open Question OQ-4. |
| REQ-FILTER | Filter by Chill Spot / wheelchair / changing table / cleanliness / currently open | Filter params on bbox RPC following the EXISTING `get_locations_in_radius` tag-join convention (Pattern 3). Zustand filter store (03-03). Null-data → INCLUDED (D-08). |
| REQ-EMERGENCY | "Emergency Mode" one-tap nearest available bathroom | Phase 3 builds ONLY `search_locations_nearby` RPC (nearest-N via `<->` KNN). UI is Phase 8. |
| REQ-DETAIL | User can tap a listing to see full details | `get_location_detail(id)` RPC (03-01) + `@gorhom/bottom-sheet` peek/half/full sheet (03-02). |
| REQ-FAMILY | User with family_mode sees no `access_sensitivity = 'sensitive'` locations in any result (RPC-layer, not client) | Server-side enforcement: RPC reads caller's `users.family_mode` via `auth.uid()` and excludes `access_sensitivity = 'sensitive'`. Pattern 4. |
| REQ-NEARBY | User can view bathrooms in a sorted list (Nearby tab) | `(tabs)/nearby.tsx` reusing bbox/nearby RPC data as a sorted list; full a11y semantics (03-04, D-29). |
| REQ-FAMILY-TOGGLE | User can enable family_mode from Settings | Extend `update_profile` RPC with optional `family_mode` param; add `Switch` to `profile.tsx` (03-04, D-30). |
</phase_requirements>

## Summary

Phase 3 is a **PostGIS read-path phase with a React Native rendering layer on top**. Nearly all correctness-critical logic lives in three new SECURITY DEFINER RPCs (`search_locations_bbox`, `search_locations_nearby`, `get_location_detail`); the client is a thin display surface that must not re-implement any filtering. The live schema, migrations, and stack are all already in place and were inspected directly for this research — this is an integration phase, not greenfield.

The single most important finding: **an existing radius-search RPC (`get_locations_in_radius`, migration `20260624000002`) already establishes the exact pattern the new RPCs must follow** — geography casts, `ST_DWithin`/`<->` KNN ordering, and a `tags`-table EXISTS-subquery for wheelchair/changing-table/no-purchase/gender filters. The new RPCs should mirror this pattern's filter conventions rather than inventing new ones. Two schema realities constrain the design: (1) `suppressed_at` does **not yet exist** on `locations` and must be added by the 03-01 migration before any RPC references it; (2) `confidence_score`/`confidence_tier` are **TEXT tier labels** ('High'/'Medium'/'Low'), not numerics — so ARCHITECTURE.md's `ORDER BY confidence_score DESC` is invalid as written.

The clustering discrepancy (supercluster JS library vs. native `ShapeSource cluster:true`) is **resolved in favor of native Mapbox clustering**: both approaches take raw points from the server (the RPC response shape does NOT change), ARCHITECTURE.md's architectural principle ("server returns raw points, client clusters visually, no round-trips on zoom") is fully honored by native clustering, and STACK.md's more rendering-specific guidance plus the approved UI-SPEC both mandate the `ShapeSource` + `SymbolLayer` path. The standalone `supercluster` npm package should NOT be installed.

**Primary recommendation:** Build the three RPCs first (03-01) mirroring the existing `get_locations_in_radius` pattern — add `suppressed_at`, filter the four moderation clauses, enforce family_mode via `auth.uid()` server-side, return an explicit public column list (never `setof locations`), and add a `max_pins_per_viewport` app_config row. Then render with native `@rnmapbox/maps` clustering (no supercluster library) and `@gorhom/bottom-sheet` for detail.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bbox / nearby spatial search | Database (PostGIS RPC) | — | Distance math, spatial index use, and moderation filters must be server-authoritative (client is untrusted per ARCHITECTURE.md §1). |
| Shadowban / delete / suppress filtering | Database (RPC body + RLS) | — | ARCHITECTURE.md Cross-Component Contract #2: every public read ends in the four-clause filter. UI filtering is a defect. |
| family_mode / access_sensitivity filtering | Database (RPC via `auth.uid()`) | — | D-30 / SC3 explicitly require RPC-layer enforcement, not client-side. Client cannot be trusted to hide sensitive rows. |
| Pin cap (max per viewport) | Database (RPC `LIMIT`) | Config (app_config) | Server enforces the cap; value is admin-tunable (D-32). |
| Visual clustering | Client (Mapbox native `ShapeSource`) | — | Rendering-only concern; native SDK clusters raw points on-device with no round-trips (Pattern 1). |
| Viewport/filter state | Client (Zustand + session persistence) | — | Pure UI state (D-03/D-06); MMKV-backed persistence within session. |
| Distance display + unit formatting | Client | Database (`ST_Distance` value) | Server returns meters; client formats mi/km by device locale (D-22/D-23). |
| Get Directions deep-link | Client (native maps app) | — | Opens device maps with destination coords; no backend involvement (D-19). |
| family_mode write (toggle) | Database (`update_profile` RPC) | Client (`Switch`) | Authed-only SECURITY DEFINER write; client just posts the new value (D-30). |
| Detail fetch + access-code gating | Database (`get_location_detail` RPC) | Client | RPC decides whether to return the access code based on `auth.uid()`; client never filters it (D-24). |

## Standard Stack

All platform choices are locked from Phase 1 (see `CLAUDE.md` §Technology Stack). This phase adds two dependencies and reuses everything else.

### Core (already installed — versions verified in `app/package.json`)
| Library | Installed Version | Purpose | Why Standard |
|---------|-------------------|---------|--------------|
| `@rnmapbox/maps` | `^10.3.1` (latest = 10.3.1) [VERIFIED: npm registry] | Map rendering, native clustering, user-location layer | Locked Phase 1 map SDK; native `ShapeSource` clustering is the performance path (STACK.md §3). |
| `@supabase/supabase-js` | `^2.106.0` [VERIFIED: npm registry] | RPC client for the three read functions | Locked backend client; `.rpc()` is the mandated PostGIS access path. |
| `@tanstack/react-query` | `^5.100.11` [VERIFIED: npm registry] | Server-state cache for bbox/nearby/detail queries | Established Phase 2 pattern; user-id-scoped keys required (Codex WU-02-T5). |
| `zustand` | `^5.0.13` [VERIFIED: npm registry] | Filter + viewport client state | Locked client-state store; MMKV-persist for session persistence (D-06). |
| `expo-location` | `~55.1.10` [VERIFIED: npm registry] | Foreground GPS for the "near me" centering + blue dot | Locked; browse-mode GPS may be mocked (harmless — no verification here). |
| `expo-linking` | `~55.0.15` [VERIFIED: npm registry] | Get Directions native-maps deep link (D-19) | Already used in `profile.tsx`; `Linking.openURL` for `maps:`/`geo:` URIs. |
| `date-fns` | `^4.2.1` [VERIFIED: npm registry] | "Verified 3 days ago" relative label (D-16) | Installed; `formatDistanceToNow`. |
| `geolib` | `^3.3.14` [VERIFIED: npm registry] | Optional client-side distance for list display | Installed; server `ST_Distance` is authoritative, geolib only for cheap display if needed. |
| `react-native-reanimated` | `4.2.1` [VERIFIED: npm registry] | Required peer of bottom-sheet + map animations | Installed; satisfies `@gorhom/bottom-sheet` v5 peer. |
| `react-native-gesture-handler` | `~2.30.0` [VERIFIED: npm registry] | Required peer of bottom-sheet + swipe-to-dismiss | Installed; satisfies bottom-sheet gesture handling. |

### Supporting (NET-NEW — must be installed this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@gorhom/bottom-sheet` | `5.2.14` (latest) [CITED: UI-SPEC §Design System; VERIFIED: npm registry] | LocationDetail peek(30%)/half(55%)/full(90%) sheet (D-12) | 03-02. UI-SPEC mandates it. Requires reanimated + gesture-handler (both installed) + `GestureHandlerRootView` at root (already present per STACK.md structure). |
| `expo-localization` | Resolve via `npx expo install expo-localization` (registry latest 57.0.0) [ASSUMED — exact SDK-55 pin] | Device locale/region for mi-vs-km unit selection (D-23) | 03-02/03-04. Alternative: `Intl.NumberFormat` region check (no dependency) — see Alternatives. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `ShapeSource cluster:true` | `supercluster` (8.0.1) JS library + manual annotations | **REJECTED.** Adds a JS dependency and a manual region-change recompute loop; native SDK already clusters (it embeds supercluster natively). Native path is what STACK.md's >50-marker anti-pattern guidance points to. RPC shape is identical either way. |
| `expo-localization` | `Intl.NumberFormat(undefined,{style:'unit',unit:'mile'/'kilometer'}).resolvedOptions()` or `RNLocalize` | Avoids a new dependency, but region detection via `Intl` is less reliable across RN Hermes builds; `expo-localization` is first-party and cleaner. Planner may choose either — flag for the executor. |
| New bbox RPC returning `setof locations` | Explicit public composite/table return | **Use explicit column list.** `setof locations` leaks `shadowban_status`, `access_instructions` (the access code), `deleted_at`. See Pitfall 4. |

**Installation:**
```bash
cd app
npx expo install expo-localization          # SDK-55-matched version
npm install @gorhom/bottom-sheet             # 5.2.14
# DO NOT install supercluster — native ShapeSource clustering is used instead.
```

## Package Legitimacy Audit

Ran `slopcheck` (0.6.1) against both net-new packages. Both verdict `[OK]`. No postinstall scripts. Both have long-lived authoritative source repos.

| Package | Registry | Age | Source Repo | slopcheck | postinstall | Disposition |
|---------|----------|-----|-------------|-----------|-------------|-------------|
| `@gorhom/bottom-sheet` | npm | created 2020-07-31 (~6 yrs) | github.com/gorhom/react-native-bottom-sheet | [OK] | none | Approved — also mandated by approved UI-SPEC |
| `expo-localization` | npm | first-party (expo/expo monorepo) | github.com/expo/expo | [OK] | none | Approved — first-party Expo |

**Packages removed due to [SLOP]:** none
**Packages flagged [SUS]:** none
**`supercluster`:** intentionally NOT recommended (native clustering used) — not audited for install.

## Architecture Patterns

### System Architecture Diagram

```
                          Client (Expo / React Native)
  ┌───────────────────────────────────────────────────────────────────────┐
  │  MapScreen (tabs/index)         Nearby (tabs/nearby)   Settings(profile)│
  │   │ viewport bbox + zoom           │ same RPC data        │ family toggle│
  │   │ debounce 400ms (D-01)          │ sorted list          │             │
  │   ▼                                ▼                      ▼             │
  │  useLocationsBbox() ──┐   useNearby() ──┐        useMutation(update_    │
  │  (TanStack Query,      │                │         profile{family_mode}) │
  │   user-scoped key)     │                │                │             │
  │   │                    │                │                │             │
  │  ShapeSource+SymbolLayer (native cluster:true)  Zustand filter store   │
  │   │ pin color = match(policy_tag)   (AND logic, session-persist)       │
  │  LocationDetail (@gorhom/bottom-sheet)  ◄── tap pin / tap row          │
  │   │ useLocationDetail(id)                                              │
  └───┼───────────────────────────────────────────────────────────────────┘
      │  supabase.rpc(...)  (anon or authed JWT — HTTPS)
      ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │  Supabase PostgREST  →  SECURITY DEFINER SQL functions (search_path=…)  │
  │                                                                        │
  │  search_locations_bbox(min_lng,min_lat,max_lng,max_lat, filters…)      │
  │  search_locations_nearby(lat, lon, radius/limit, filters…)   [KNN <->] │
  │  get_location_detail(id)                                                │
  │      │                                                                 │
  │      ▼  every function body ends in:                                   │
  │   deleted_at IS NULL  AND suppressed_at IS NULL                        │
  │   AND shadowban_status = false  AND status published                  │
  │   AND (family_mode of auth.uid() ⇒ access_sensitivity <> 'sensitive')  │
  │   AND tag-join EXISTS filters   ORDER BY … LIMIT max_pins_per_viewport │
  └───────────────────────────────────────────────────────────────────────┘
      │  reads (GiST index idx_locations_coordinates_active)
      ▼
  Postgres + PostGIS: locations, tags, users(family_mode), app_config
```

### Recommended Project Structure (additions only)
```
app/src/
├── features/
│   └── locations/                # NEW — data layer (100% coverage gate applies)
│       ├── useLocationsBbox.ts   # TanStack Query hook, bbox + filters → search_locations_bbox
│       ├── useNearby.ts          # search_locations_nearby
│       ├── useLocationDetail.ts  # get_location_detail(id)
│       ├── useFamilyMode.ts      # read users.family_mode (user-scoped key)
│       ├── formatDistance.ts     # meters → mi/km by locale (D-23)
│       └── types.ts              # public-safe location shape (mirror RPC return)
│   └── filters/                  # NEW — Zustand store (D-05/06/07/08)
│       └── useFiltersStore.ts
├── app/(tabs)/
│   ├── index.tsx                 # MapScreen (03-02, 03-03) — currently a stub
│   ├── nearby.tsx                # Nearby list (03-04) — currently a stub
│   └── profile.tsx              # + family_mode Switch (03-04) — extend existing
├── app/(components)/
│   └── LocationDetailSheet.tsx   # NEW — @gorhom/bottom-sheet (route-group component folder, accepted pattern)
└── lib/database.types.ts         # REGENERATE after 03-01 migration (new RPCs + suppressed_at)

supabase/migrations/
├── <ts>_phase3_suppressed_at.sql # add locations.suppressed_at + update partial index
├── <ts>_phase3_search_rpcs.sql   # search_locations_bbox / _nearby / get_location_detail
├── <ts>_phase3_max_pins_config.sql # app_config('max_pins_per_viewport','200')
├── <ts>_phase3_family_mode_rpc.sql # extend update_profile with family_mode param
└── <ts>_dev_seed_locations.sql   # DEV-ONLY guard — ~10-20 fake rows (D-31)
```

### Pattern 1: Native Mapbox clustering (RESOLVES the supercluster discrepancy)
**What:** Feed raw points from the bbox RPC into a `ShapeSource` with `cluster={true}`; render clusters with a `CircleLayer`/`SymbolLayer` and un-clustered pins with a `SymbolLayer`. Pin color driven by a Mapbox `match` expression on `policy_tag` — NOT React state (UI-SPEC §Component Contract).
**When to use:** Always, for the map canvas. Do NOT put marker `View` children in `MapView` for >50 markers (STACK.md §3 anti-pattern — 5fps vs 60fps).
**Verified API** (`cluster`, `clusterRadius` default 50, `clusterMaxZoomLevel`, `clusterProperties`) [CITED: rnmapbox.github.io/docs/components/ShapeSource].
```tsx
// Source: rnmapbox.github.io ShapeSource docs + STACK.md §3 pattern
<MapboxGL.ShapeSource
  id="locations"
  cluster
  clusterRadius={50}
  clusterMaxZoomLevel={14}
  shape={featureCollection /* GeoJSON from RPC rows */}
  onPress={onPinOrClusterPress}
>
  <MapboxGL.SymbolLayer
    id="clusterCount"
    filter={['has', 'point_count']}
    style={{ textField: '{point_count}', textSize: 12 }}
  />
  <MapboxGL.CircleLayer
    id="clusters"
    filter={['has', 'point_count']}
    style={{ circleColor: /* dominant policy-tag color */, circleRadius: 18 }}
  />
  <MapboxGL.SymbolLayer
    id="singlePin"
    filter={['!', ['has', 'point_count']]}
    style={{
      iconImage: [
        'match', ['get', 'policy_tag'],
        'chill_spot', 'pin-chill',
        'code_required', 'pin-code',
        'public_facility', 'pin-public',
        'purchase_required', 'pin-purchase',
        'pin-public', // default
      ],
    }}
  />
</MapboxGL.ShapeSource>
```
**Why this honors ARCHITECTURE.md:** ARCHITECTURE.md Pattern 8 says "server returns up to ~200 raw points inside the bbox; client clusters visually … avoids round-trips on every zoom." Native `ShapeSource` clustering does exactly this — it clusters the raw points on-device with zero server round-trips. The Mapbox native SDK embeds the supercluster algorithm, so you get supercluster's behavior without the JS library. The RPC response shape (raw points) is identical under both interpretations.

### Pattern 2: bbox query on a geography column (the `::geometry` cast trap)
**What:** `coordinates` is `geography`. The bbox `&&` intersection operator and `ST_MakeEnvelope` are geometry operations — cast for the envelope test, keep geography for any distance.
**Example:**
```sql
-- Source: PostGIS docs + existing migration pattern (get_locations_in_radius)
WHERE l.coordinates::geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  AND l.deleted_at IS NULL
  AND l.suppressed_at IS NULL
  AND l.shadowban_status = false
```
The partial GiST index `idx_locations_coordinates_active` (`WHERE deleted_at IS NULL AND shadowban_status = false`) already exists and supports this. **When `suppressed_at` is added, extend this partial index** to include `AND suppressed_at IS NULL` so the moderation-filtered search stays index-backed.

### Pattern 3: tag-join filters — reuse the EXISTING convention
**What:** The live `get_locations_in_radius` RPC (migration `20260624000002`) already defines the tag-join filter vocabulary. New RPCs MUST reuse these exact key/value pairs, not invent new ones.
**Established conventions** (verified in migration source):
| Filter | Mechanism |
|--------|-----------|
| Wheelchair | `EXISTS (SELECT 1 FROM tags WHERE location_id=l.id AND key='accessibility' AND value='wheelchair')` |
| Changing table | `tags key='amenity' value='changing_table'` |
| No purchase | `tags key='purchase_required' value='false'` |
| Gender neutral | `tags key='gender' value='neutral'` |
| Chill Spot | `l.chill_spot = true` (direct column) |
| Open now | `l.is_open_now = true` (direct column) |
| High confidence / Cleanliness 4+ | `l.confidence_tier = 'High'` (text, indexed) |
**Critical (D-08):** every filter uses `(NOT filter_x OR <condition>)` so a null/missing tag INCLUDES the row. The existing RPC already does this — mirror it exactly. Cleanliness/ratings data does not exist until Phase 8, so the "Clean: 4+" chip must also default-include.

### Pattern 4: family_mode enforced server-side via `auth.uid()` (not a client param)
**What:** The RPC reads the caller's own `family_mode` from `users` using `auth.uid()` — the client never passes it, so it can't be spoofed to reveal sensitive rows.
```sql
-- Inside search_locations_bbox / _nearby / get_location_detail
DECLARE
  v_family_mode boolean := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT family_mode INTO v_family_mode FROM public.users WHERE id = auth.uid();
  END IF;
  -- …
  AND (NOT v_family_mode OR l.access_sensitivity IS DISTINCT FROM 'sensitive')
```
Anonymous callers have no `family_mode` → not filtered (setting is per-user). Null `access_sensitivity` → included (consistent with D-08). This is the RPC-layer enforcement REQ-FAMILY / SC3 require.

### Pattern 5: SECURITY DEFINER hardening (established project rule)
Every new RPC: `security definer`, `set search_path = public` (or `= ''` with fully-qualified names), schema-qualified table refs, explicit `revoke execute … from public` then `grant execute … to anon, authenticated` for reads (writes: authenticated only). Follows `update_profile`/`get_locations_in_radius` precedent and the `rls_security_guard` skill.

### Anti-Patterns to Avoid
- **Returning `setof locations`** from a public RPC — leaks `shadowban_status`, `deleted_at`, `access_instructions` (the door code). Return an explicit public column list. (The existing `get_locations_in_radius` returns `setof locations` — do NOT copy that aspect; it predates the D-24 access-code decision.)
- **`ORDER BY confidence_score DESC`** (from ARCHITECTURE.md) — `confidence_score` is TEXT. Use a `CASE confidence_tier` ranking or `verification_count DESC` for the pin-cap ordering.
- **Client-side filtering of shadowban/suppress/family_mode** — all must be in the RPC body (Cross-Component Contract #2).
- **`is_shadowbanned` column name** — the live column is `shadowban_status`. ARCHITECTURE.md's SQL examples use the wrong name.
- **Distance math in JS degrees** — use server `ST_Distance` (meters); geolib only for display convenience.
- **Marker `View` children in `MapView`** for the pin set — use `ShapeSource`/`SymbolLayer`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map clustering | Custom grid/quadtree clustering, or the `supercluster` JS loop | `@rnmapbox/maps` `ShapeSource cluster:true` | Native SDK clusters on-device with zoom-stable behavior; hand-rolling recomputes on every region change and drops frames. |
| Bottom sheet (peek/half/full, swipe-dismiss) | Custom `Animated`/`PanResponder` sheet | `@gorhom/bottom-sheet` v5 | Snap points, gesture dismiss, keyboard handling, backdrop scrim — all edge-case-laden; UI-SPEC mandates it. |
| Spatial search / distance | JS Haversine over all rows | PostGIS `ST_DWithin` + `<->` KNN in the RPC | Degrees≠meters; spatial index unused; ships every row to device. schema-contract.md forbids it. |
| Relative "verified N days ago" | Manual date diff | `date-fns` `formatDistanceToNow` | Timezone/pluralization edge cases. |
| Unit (mi/km) selection | Hardcoded per-country map | `expo-localization` region OR `Intl` unit formatting | Locale rules are non-trivial; first-party lib handles it. |
| Native maps deep-link | Hand-built URL scheme guessing | `expo-linking` `openURL` with platform `maps:`/`geo:`/`https://maps.apple.com` | Platform URI differences; reuse the mechanism Emergency Mode's Navigate already needs (D-19). |
| Filter/viewport persistence | Custom AsyncStorage serializer | Zustand `persist` + MMKV (STACK.md §5 pattern) | Session-persist (D-06) with a proven store. |

**Key insight:** This phase's temptation is to "just fetch all locations and filter/cluster in JS." Every one of those shortcuts is explicitly forbidden by schema-contract.md, ARCHITECTURE.md, and STACK.md. The database is the authority; the map SDK is the renderer; the client wires them together.

## Common Pitfalls

### Pitfall 1: `suppressed_at` referenced before it exists
**What goes wrong:** The 03-01 RPC filters `suppressed_at IS NULL`, but the column is absent from the live schema — the migration fails or (worse) a later migration silently adds it with the wrong type.
**Why it happens:** schema-contract.md documents `suppressed_at` as *intended*, but no migration has added it (verified: zero matches for `suppressed_at` across `supabase/migrations/`).
**How to avoid:** 03-01 MUST include a migration adding `locations.suppressed_at timestamptz` (nullable) BEFORE the RPC migration, and update the partial index `idx_locations_coordinates_active` to include `AND suppressed_at IS NULL`.
**Warning signs:** RPC migration errors `column "suppressed_at" does not exist`.

### Pitfall 2: TEXT confidence ordering
**What goes wrong:** Copying ARCHITECTURE.md's `ORDER BY l.confidence_score DESC LIMIT 200` sorts alphabetically on 'High'/'Low'/'Medium' (→ High, Low, Medium — wrong tier order) and picks the wrong 200 pins.
**Why it happens:** ARCHITECTURE.md (2026-05-18) assumed a numeric score; the live schema stores TEXT tiers.
**How to avoid:** For the pin-cap ordering use `ORDER BY CASE confidence_tier WHEN 'High' THEN 3 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 1 ELSE 0 END DESC, verification_count DESC`, or simply `verification_count DESC`.
**Warning signs:** Reviewer notices 'Low' pins retained over 'Medium' when capped.

### Pitfall 3: family_mode client-spoofing
**What goes wrong:** Passing `family_mode` as an RPC parameter lets a modified client send `false` and see sensitive locations.
**Why it happens:** It's the easy API shape.
**How to avoid:** RPC reads `users.family_mode` via `auth.uid()` itself (Pattern 4). Verification: call the RPC as a family_mode=true user and assert `access_sensitivity='sensitive'` rows are absent regardless of any client input.

### Pitfall 4: Leaking the access code / moderation columns to the client
**What goes wrong:** `setof locations` (or `SELECT *`) returns `access_instructions` (the door PIN), `shadowban_status`, `deleted_at` to anonymous callers — violating D-24 and exposing moderation state.
**Why it happens:** The existing `get_locations_in_radius` returns `setof locations`; copying it propagates the leak.
**How to avoid:** New RPCs return an explicit public column list. `get_location_detail` returns `access_instructions` ONLY when `auth.uid() IS NOT NULL` (and even then, the reveal UX is Phase 8 — Phase 3 may simply omit it for anon and expose for authed, or omit entirely pending Phase 8; confirm with planner — see OQ-3). Never return `shadowban_status`/`deleted_at`/`suppressed_at`.

### Pitfall 5: bbox operator on geography without cast
**What goes wrong:** `coordinates && ST_MakeEnvelope(...)` errors or silently misbehaves because `&&` expects geometry.
**How to avoid:** `coordinates::geometry && ST_MakeEnvelope(min_lng,min_lat,max_lng,max_lat,4326)` (Pattern 2). Keep geography for `ST_Distance`/`<->`.
**Warning signs:** `operator does not exist: geography && geometry`.

### Pitfall 6: Dev seed migration running in production
**What goes wrong:** The ~10-20 fake locations (D-31) ship to the production Supabase project.
**How to avoid:** Guard the seed so it is skipped in production — e.g. only run when a config/env flag indicates local/dev, or keep it as a separate `supabase/seed.sql` / non-numbered dev script that CI never applies to prod. The planner must make the guard mechanism explicit and reviewable. Never `INSERT` seed rows in a normal numbered migration.

### Pitfall 7: `@gorhom/bottom-sheet` missing GestureHandlerRootView / reanimated plugin
**What goes wrong:** Sheet renders but gestures/animations are dead, or a native crash on New Architecture.
**How to avoid:** Confirm `GestureHandlerRootView` wraps the root (STACK.md structure shows it in `_layout.tsx`) and the reanimated babel plugin is configured. Reanimated 4.2.1 + gesture-handler 2.30.0 are installed and v5-compatible.

## Runtime State Inventory

> Phase 3 is additive (new RPCs, new screens, one column, one config row). It is NOT a rename/refactor. This section is included only to explicitly clear the categories.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `locations` table currently has ZERO rows (D-31, confirmed no seed INSERTs) — nothing to migrate. New `suppressed_at` column adds cleanly (nullable). | Add column (code migration) + dev seed (D-31). No data migration. |
| Live service config | `app_config` needs one new row `max_pins_per_viewport` (D-32). No external-service config outside git. | Migration INSERT into app_config. |
| OS-registered state | None — no OS-level registrations touched. | None. |
| Secrets/env vars | None new. Mapbox tokens already configured (Phase 1 EAS secrets). | None. |
| Build artifacts | `app/src/lib/database.types.ts` is STALE after the 03-01 migration (new RPCs + `suppressed_at`). Must regenerate via `supabase gen types`. | Regenerate + commit database.types.ts as part of 03-01. |

## Code Examples

### Native-maps deep link (Get Directions, D-19)
```ts
// Source: expo-linking + platform maps URI conventions
import { Linking, Platform } from 'react-native';
function openDirections(lat: number, lng: number, label: string) {
  const enc = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps:0,0?q=${enc}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${enc})`,
    default: `https://maps.google.com/?q=${lat},${lng}`,
  })!;
  Linking.openURL(url);
}
```

### Distance formatting by locale (D-22/D-23)
```ts
// Source: Intl unit formatting (works without expo-localization if region known)
export function formatDistance(meters: number, usesMiles: boolean): string {
  if (usesMiles) {
    const mi = meters / 1609.344;
    return mi < 0.1 ? `${Math.round(meters * 3.281)} ft` : `${mi.toFixed(1)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
// usesMiles derived from expo-localization region ∈ {US, GB, LR, MM} or Intl locale.
```

### bbox RPC skeleton (public column list, all filters)
```sql
-- Source: mirrors get_locations_in_radius (migration 20260624000002) with bbox + Phase 3 additions
create or replace function public.search_locations_bbox(
  min_lng numeric, min_lat numeric, max_lng numeric, max_lat numeric,
  filter_open_now boolean default false, filter_chill_spot boolean default false,
  filter_wheelchair boolean default false, filter_changing boolean default false,
  filter_high_conf boolean default false, max_pins integer default 200
) returns table (
  id uuid, name text, lat double precision, lng double precision,
  policy_tag text, confidence_tier text, verification_count integer,
  last_verified_at timestamptz, is_open_now boolean, chill_spot boolean
) language plpgsql security definer stable set search_path = public as $$
declare v_family boolean := false;
begin
  if auth.uid() is not null then
    select family_mode into v_family from public.users where id = auth.uid();
  end if;
  return query
  select l.id, l.name,
         st_y(l.coordinates::geometry) as lat, st_x(l.coordinates::geometry) as lng,
         l.policy_tag, l.confidence_tier, l.verification_count,
         l.last_verified_at, l.is_open_now, l.chill_spot
  from public.locations l
  where l.coordinates::geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and l.deleted_at is null
    and l.suppressed_at is null            -- requires the new column
    and l.shadowban_status = false
    and (not v_family or l.access_sensitivity is distinct from 'sensitive')
    and (not filter_open_now   or l.is_open_now = true)
    and (not filter_chill_spot or l.chill_spot = true)
    and (not filter_wheelchair or exists (select 1 from public.tags t
           where t.location_id = l.id and t.key='accessibility' and t.value='wheelchair'))
    and (not filter_changing   or exists (select 1 from public.tags t
           where t.location_id = l.id and t.key='amenity' and t.value='changing_table'))
    and (not filter_high_conf  or l.confidence_tier = 'High')
  order by case l.confidence_tier when 'High' then 3 when 'Medium' then 2 when 'Low' then 1 else 0 end desc,
           l.verification_count desc
  limit max_pins;
end; $$;
revoke execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) from public;
grant execute on function public.search_locations_bbox(numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean,boolean,integer) to anon, authenticated;
```
> NOTE: `status = 'published'` filter — the live `locations` table has no `status` column (verified). Publish state today is expressed via `deleted_at`/`suppressed_at`/`shadowban_status`. Do NOT add a `status='published'` clause unless a `status` column is confirmed/added. ARCHITECTURE.md assumes a `status` column that isn't in the live schema — see OQ-2.

## State of the Art

| Old Approach (in project docs) | Current Reality | Impact |
|--------------------------------|-----------------|--------|
| ARCHITECTURE.md `supercluster` JS library | Native `@rnmapbox/maps` `ShapeSource cluster:true` | No JS dependency; same RPC shape; matches UI-SPEC + STACK.md. |
| ARCHITECTURE.md `is_shadowbanned` column | Live column is `shadowban_status` | Use correct name in all RPCs. |
| ARCHITECTURE.md numeric `confidence_score DESC` | TEXT `confidence_tier`; `confidence_score` also TEXT | Order by CASE tier / verification_count. |
| ARCHITECTURE.md `status='pending'/'published'` | No `status` column in live `locations` | Publish state via deleted/suppressed/shadowban flags only (OQ-2). |
| STACK.md `zod ^3.x`, RNTL `^14` | Installed: `zod ^4.4.3`, RNTL `^13.3.3` | Minor drift; not blocking this phase (no new zod schemas required for read path unless validating RPC inputs client-side). |

**Deprecated/outdated:** `get_locations_in_radius` returns `setof locations` — its column-leak aspect is superseded by the D-24 access-code rule. Reuse its *filter logic*, not its return shape.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expo-localization` SDK-55-matched version resolves via `npx expo install` (registry latest 57.0.0) | Standard Stack | Low — if incompatible, fall back to `Intl`-based unit detection (no dependency). |
| A2 | `access_sensitivity = 'sensitive'` is the exact sentinel value for family_mode filtering | Pattern 4 / REQ-FAMILY | Medium — if the seed/Phase 4 writes a different string, the filter silently matches nothing. Confirm the value convention with the planner/seed data. Column exists but no rows yet to observe. |
| A3 | No `status` column exists on `locations`; publish state = deleted/suppressed/shadowban flags | Code Examples / OQ-2 | Medium — if a `status` column is expected, RPCs need an extra clause. Verified absent in migrations, but ROADMAP/ARCHITECTURE assume it. |
| A4 | Access code (`access_instructions`) should be omitted for anon in `get_location_detail`; reveal for authed is Phase 8 | Pitfall 4 / OQ-3 | Low-Medium — exact gating boundary between Phase 3 (field present for authed) vs Phase 8 (reveal UX) needs a planner decision. |
| A5 | Dev-seed guard mechanism (env/config flag vs separate seed.sql) | Pitfall 6 | Medium — wrong guard could leak fake data to prod. Planner must specify a reviewable guard. |
| A6 | Native maps deep-link URIs above are correct for iOS/Android | Code Examples | Low — widely-used patterns; verify on device during 03-02. |

## Open Questions

1. **OQ-1 (RESOLVED): supercluster vs native clustering.**
   - Resolution: Native `@rnmapbox/maps` `ShapeSource cluster:true`. ARCHITECTURE.md's "raw points → client clusters" principle is satisfied; RPC shape unchanged; UI-SPEC + STACK.md concur. Do not install `supercluster`.

2. **OQ-2 (RESOLVED): Is there a `status` column on `locations`, or is publish-state purely flag-based?**
   - **Status: RESOLVED** — Publish state is flag-based; NO `status` column is added in Phase 3. "Published" = `deleted_at IS NULL AND suppressed_at IS NULL AND shadowban_status = false` (03-01's three read RPCs implement exactly this four-clause filter, and 03-01 adds the `suppressed_at` column). Pending-row handling remains Phase 4's concern.
   - What we know: No `status` column in any migration (verified). ARCHITECTURE.md and ROADMAP reference `status='published'`.
   - What's unclear: Whether Phase 3 should add a `status` column or treat "published" = `deleted_at IS NULL AND suppressed_at IS NULL AND shadowban_status = false`.
   - Recommendation: Treat publish-state as flag-based for Phase 3 (no `status` clause). Pending-row handling is Phase 4's concern (submissions live in a separate `submissions` table per `delete_account` anonymization list). Flag for planner confirmation.

3. **OQ-3 (RESOLVED): Exact access-code gating in `get_location_detail` for Phase 3.**
   - **Status: RESOLVED** — `access_instructions` is omitted ENTIRELY from all Phase 3 RPCs (not returned to anon or authed). 03-01's `get_location_detail` returns a public-safe column list with no `access_instructions`; the reveal UX and any code field land in Phase 8.
   - What we know: D-24 (anon sees everything except access code); reveal UX is Phase 8 (`08-02`).
   - What's unclear: Does Phase 3's detail RPC return `access_instructions` to authed users now (behind Phase 8 reveal UX), or omit it entirely until Phase 8?
   - Recommendation: Omit `access_instructions` from the Phase 3 detail return entirely; add it in Phase 8 with the reveal gate. Confirm with planner (lowest-risk, avoids shipping a code field with no UX).

4. **OQ-4 (RESOLVED): Manual city/address search (REQ-SEARCH) geocoding provider.**
   - **Status: RESOLVED** — No external geocoding provider is introduced in Phase 3. The denied-GPS fallback is map-recenter + manual search entry + "Search this area" (bbox re-query), implemented in 03-05. Full Places autocomplete is deferred to its own future decision/plan.
   - What we know: UI-SPEC ERR-01 says GPS-denied opens "manual city/address search (Google Places)". No geocoding dependency is installed.
   - What's unclear: Whether Phase 3 implements live geocoding (needs a Places/geocoding API + key) or a lighter fallback (recenter map, user pans, "Search this area").
   - Recommendation: Scope Phase 3's denied-GPS fallback to map-recenter + "Search this area" (bbox re-query) — no new external API. Full Places autocomplete may warrant its own decision/plan. Flag for planner; this could otherwise silently expand scope with a new API dependency and key management.

> **Planning-time addendum (not part of the original research pass — recorded so this doc stays accurate for future readers):** `get_location_detail`'s signature was extended during planning to `get_location_detail(location_id uuid, user_lat numeric default null, user_lng numeric default null)`, returning a server-computed `distance_m` (ST_Distance, meters) when the caller supplies coords and `null` otherwise. This makes `get_location_detail` the single server-side source of the LocationDetail peek-tier distance — the client never computes distance. See 03-01 (RPC + pgTAP test #7) and 03-02 (`useLocationDetail(id, userLat?, userLng?)` mapping `distance_m`→`distanceM`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project `ebmzhjmmtmldhrojkdqw` | All RPCs | ✓ | live | — |
| PostGIS extension | Spatial RPCs | ✓ | enabled (GiST indexes present in migrations) | — |
| `tags` table | Filter joins | ✓ | live (migration 010000) | — |
| `locations.access_sensitivity` | family_mode filter | ✓ | live column | — |
| `locations.suppressed_at` | Moderation filter | ✗ | — | **03-01 migration must add it (blocking)** |
| `users.family_mode` | family_mode read/write | ✓ | live column (default false) | — |
| `app_config` + anon SELECT policy | Pin cap tunable | ✓ | live | Add `max_pins_per_viewport` row |
| `@gorhom/bottom-sheet` | LocationDetail | ✗ | — | Install 5.2.14 (net-new) |
| `expo-localization` | Unit locale | ✗ | — | `Intl`-based detection (no install) |
| `supabase` CLI (type gen) | Regenerate database.types.ts | ? (unverified on this machine) | — | `npx supabase gen types` or MCP; if absent, hand-edit types (worse) |
| Mapbox tokens (EAS secret + public) | Map tiles | ✓ | Phase 1 config | — |
| EAS dev client build | Map/native modules | ✓ | Phase 1 established (Mapbox can't run in Expo Go) | — |

**Missing dependencies with no fallback (blocking):**
- `locations.suppressed_at` column — must be added by 03-01 before RPCs reference it.

**Missing dependencies with fallback:**
- `@gorhom/bottom-sheet` (install), `expo-localization` (or use `Intl`).

## Validation Architecture

`workflow.nyquist_validation` = `true` → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `jest@29.7.0` + `jest-expo@~55` (pinned; jest@30 incompatible) |
| Component | `@testing-library/react-native@^13.3.3` + `@testing-library/jest-native@^5` |
| Network mocking | `msw@^2.14.6` (`msw/native`) — mock the Supabase `/rest/v1/rpc/*` HTTP calls, not the client module |
| Config file | `app/jest.config.js` (100% lines/branches on `src/features/**` + `src/lib/**`; `src/app/` screens excluded as thin wrappers) |
| Quick run command | `cd app && npm test -- <path> ` (jest, `-x`-style via `--bail`) |
| Full suite command | `cd app && npm test` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| REQ-MAP | bbox hook maps viewport→RPC, transforms rows→GeoJSON | unit (MSW) | `npm test -- src/features/locations/useLocationsBbox.test.ts` | ❌ Wave 0 |
| REQ-FILTER | filter store AND logic; null-data includes (D-08) | unit | `npm test -- src/features/filters/useFiltersStore.test.ts` | ❌ Wave 0 |
| REQ-DETAIL | detail hook fetches + shapes; access-code absent for anon | unit (MSW) | `npm test -- src/features/locations/useLocationDetail.test.ts` | ❌ Wave 0 |
| REQ-FAMILY | RPC-layer filter — sensitive excluded when family_mode | integration (SQL) | pgTAP / local Supabase RPC test (out of jest — see below) | ❌ Wave 0 |
| REQ-FAMILY-TOGGLE | update_profile writes family_mode; user-scoped query | unit (MSW) | `npm test -- src/features/locations/useFamilyMode.test.ts` | ❌ Wave 0 |
| REQ-NEARBY | nearby hook sorts by distance; a11y row labels | unit | `npm test -- src/features/locations/useNearby.test.ts` | ❌ Wave 0 |
| REQ-SEARCH | denied-GPS empty/fallback state | unit | screen-level (thin, excluded) — cover the state hook in features | ❌ Wave 0 |
| REQ-EMERGENCY | search_locations_nearby RPC returns nearest-N | integration (SQL) | pgTAP / local Supabase | ❌ Wave 0 |
| distance format | meters→mi/km by locale | unit | `npm test -- src/features/locations/formatDistance.test.ts` | ❌ Wave 0 |

**RPC/RLS correctness (SQL layer):** Per STACK.md §8, RLS/RPC correctness is tested via integration against a local Supabase + pgTAP, NOT jest. Wave 0 should establish (or confirm) the SQL test harness. Key SQL assertions: shadowbanned/suppressed/deleted rows absent; family_mode=true user cannot see `access_sensitivity='sensitive'`; anon call does not return `access_instructions`; bbox respects `max_pins` cap; tag filters use AND with null-inclusion.

### Sampling Rate
- **Per task commit:** `cd app && npm test -- <touched feature test>` (fast, per-hook).
- **Per wave merge:** `cd app && npm test` (full jest suite, 100% gate on features/lib).
- **Phase gate:** Full jest suite green + SQL/pgTAP RPC tests green before `/gsd:verify-work`. TDD Guard enforces test-first on `app/src/**`.

### Wave 0 Gaps
- [ ] `src/features/locations/` test files (bbox, nearby, detail, familyMode, formatDistance) — cover REQ-MAP/DETAIL/NEARBY/FAMILY-TOGGLE.
- [ ] `src/features/filters/useFiltersStore.test.ts` — REQ-FILTER (D-07 AND, D-08 null-include).
- [ ] MSW handlers for `/rest/v1/rpc/search_locations_bbox`, `/search_locations_nearby`, `/get_location_detail`, `/update_profile`.
- [ ] SQL/pgTAP RPC test harness (or confirm existing) — REQ-FAMILY, REQ-EMERGENCY, moderation-filter and access-code assertions.
- [ ] Test fixtures: sample location rows (published, suppressed, shadowbanned, sensitive) for filter assertions.
- [ ] `@rnmapbox/maps` jest mock (STACK.md §8 shows the pattern) — extend for `ShapeSource`/`SymbolLayer`/`CircleLayer`.

## Security Domain

`security_enforcement` not disabled → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase JWT; `auth.uid()` gates authed-only writes (`update_profile` family_mode). |
| V3 Session Management | yes (reuse) | AsyncStorage-backed session (Phase 1/2); no change. |
| V4 Access Control | **yes (central)** | RPC-layer moderation + family_mode filtering via `auth.uid()`; access-code gating (D-24). SECURITY DEFINER with `search_path` set. |
| V5 Input Validation | yes | RPC numeric bbox/coords params; clamp/validate viewport; `zod`-validate client inputs if surfaced. |
| V6 Cryptography | no | No new crypto; access code is data, not secret-managed here. |
| V7 Error Handling / Logging | yes | No PII/GPS in logs (CLAUDE.md); RPC failure banner must not leak reasons (ARCHITECTURE Anti-Pattern 7). |

### Known Threat Patterns for Supabase PostGIS RPC + RN
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Column leak via `setof locations` (access code, shadowban_status) | Information Disclosure | Explicit public column list; gate `access_instructions` by `auth.uid()` (Pitfall 4). |
| family_mode bypass via client-supplied param | Tampering / Info Disclosure | Read `family_mode` server-side from `auth.uid()` (Pattern 4). |
| Shadowbanned/suppressed rows visible | Info Disclosure | Four-clause filter in every RPC body + RLS belt-and-suspenders. |
| SECURITY DEFINER search_path attack | Elevation of Privilege | `set search_path = public`, schema-qualified refs (Pattern 5). |
| SQL injection | Tampering | Parameterized RPC args only; no dynamic SQL string-building (CLAUDE.md: no raw SQL outside migrations). |
| Dev seed data in prod | Info Disclosure / Integrity | Guarded dev-only seed (Pitfall 6). |
| GPS/PII in logs or Sentry | Info Disclosure | Scrub lat/lng/email/address; no raw coords in telemetry (CLAUDE.md). |

## Project Constraints (from CLAUDE.md)

- **No raw SQL** except migrations or safely parameterized server-only code — all spatial access via `.rpc()`.
- **GPS coordinates in PostGIS geometry/geography columns only** — `coordinates geography(Point,4326)`; no canonical lat/lng columns.
- **No PII in logs** — no email/GPS/address in logs, Sentry, or errors.
- **TDD Guard (MANDATORY):** test → fail → implement → pass on `app/src/**`; 100% coverage on `src/features/**` + `src/lib/**` via `.coverage-thresholds.json`; jest pinned 29.7.0 (no upgrade). Placeholder/scaffold screens created via Bash (Write blocked on non-behavioral files).
- **`android/` never manually edited** (Expo-generated); `app/.env.local` never committed.
- **Multi-agent review gate:** PostGIS correctness audited by Antigravity; security/privacy by Codex; no commit without APPROVE from both. Log files to `.claude/review-queue.txt` → `/review-gate`.
- **Component Acceptance Checklist (design-system.md §20)** must be cited in every PLAN.md that creates/modifies a screen (ROADMAP SC10) — applies to MapScreen, LocationDetail, Nearby, profile.
- **Project skills** (`.claude/skills/`): PostGIS Optimizer (geography/`<->` KNN/GiST), RLS Security Guard (SECURITY DEFINER, column exposure), Trust Engine Validator, Pitfall Scan — research above is aligned with these.
- **`app/AGENTS.md`:** read `https://docs.expo.dev/versions/v55.0.0/` before writing code (Expo has changed).

## Sources

### Primary (HIGH confidence)
- Live migrations `supabase/migrations/*` (read directly): `20260519010000_remote_schema.sql` (locations/tags/app_config/users schema), `20260519020000_fix_schema.sql` (app_config tunables), `20260624000000`/`20260624000002` (`get_locations_in_radius` filter pattern), `20260627000004_profile_rpcs.sql` (`update_profile` pattern).
- `docs/schema-contract.md` — authoritative field names, RLS intent, moderation-filter requirements.
- `.planning/research/ARCHITECTURE.md` — tier boundaries, RPC patterns, build order (authoritative per CONTEXT.md; corrected here on column names/status/confidence type).
- `.planning/research/STACK.md` — pinned stack, `ShapeSource`/`SymbolLayer` performance pattern, testing (jest-expo/MSW).
- `.planning/phases/03-read-path-map/03-UI-SPEC.md` — approved component/interaction contract (native `ShapeSource cluster:true`, action row, copy).
- `app/package.json` (read directly) — installed versions.
- [rnmapbox.github.io/docs/components/ShapeSource](https://rnmapbox.github.io/docs/components/ShapeSource) — confirmed native clustering props (`cluster`, `clusterRadius`, `clusterMaxZoomLevel`, `clusterProperties`).
- `slopcheck` 0.6.1 run — `@gorhom/bottom-sheet` + `expo-localization` both `[OK]`.
- npm registry (`npm view`) — version verification for all packages.

### Secondary (MEDIUM confidence)
- Native maps deep-link URI conventions (iOS `maps:`, Android `geo:`) — widely-used, verify on device.

### Tertiary (LOW confidence)
- `expo-localization` exact SDK-55 pin (registry latest 57.0.0) — resolve via `npx expo install`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions read from installed `package.json`; new packages slopcheck-`[OK]` + npm-verified.
- Architecture / RPC design: HIGH — patterns derived from live migration source, not speculation; discrepancies (column names, confidence type, missing status/suppressed_at) verified against actual schema.
- Clustering resolution: HIGH — native clustering confirmed via rnmapbox docs; reconciles ARCHITECTURE.md intent with UI-SPEC + STACK.md.
- Pitfalls: HIGH — each traced to a specific schema/migration fact.
- Open questions (status column, access-code gating, geocoding provider): MEDIUM — flagged for planner, low blast radius with recommended defaults.

**Research date:** 2026-07-04
**Valid until:** 2026-08-03 (30 days — stable stack; re-verify only if Expo SDK or Supabase schema changes).
