## Antigravity Review - Phase 3 Plan Review (Cross-AI /gsd-review)

**VERDICT: REQUEST CHANGES**

### Reviewed Queue
- [03-01-PLAN.md](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-01-PLAN.md) (Wave 1 - DB read path migrations, dev seed, pgTAP tests)
- [03-02-PLAN.md](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-02-PLAN.md) (Wave 2 - client hooks, Zustand filters, formatDistance, tests)
- [03-03-PLAN.md](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-03-PLAN.md) (Wave 3 - MapScreen rendering, bottom-sheet component, tests)
- [03-04-PLAN.md](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-04-PLAN.md) (Wave 4 - Nearby list-view, family_mode Settings switch)
- [03-05-PLAN.md](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-05-PLAN.md) (Wave 4 - Filter chips row, denied-location fallback)

---

### Summary
The proposed plan set provides a solid structural foundation for the Phase 3 Read Path. Spatially, it correctly utilizes geodesic PostGIS calculations (`ST_Distance` on `geography`) to prevent flat-surface degree distortion, and leverages standard `@rnmapbox/maps` native clustering to keep rendering overhead low. However, the current plans suffer from several significant PostGIS performance and logical defects: the bbox queries cast columns, bypassing the spatial index; filters do not comply with the locked default-include null policy (Decision D-08); the `update_profile` function wipes out display names during family mode toggles; and viewport pans across the 180-meridian will crash the application. These must be resolved before proceeding to execution.

---

### Issues

#### 1. [CRITICAL] `update_profile` Display Name Wipe Bug
- **File & Line:** [03-01-PLAN.md:166](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-01-PLAN.md#L166)
- **Description:** The planned `update_profile(new_display_name text, new_family_mode boolean default null)` function sets `display_name = new_display_name`. When toggling family mode, the client calls `update_profile(null, true)`. This sets the user's `display_name = NULL` in the database, effectively erasing it.
- **Required Fix:** Use a conditional update expression in the SQL function:
  ```sql
  update public.users
    set display_name = case when new_display_name is not null then new_display_name else display_name end,
        family_mode  = case when new_family_mode is not null then new_family_mode else family_mode end,
        updated_at   = now()
  where id = auth.uid();
  ```

#### 2. [MAJOR] Bbox Spatial Index Bypass (Spatial Performance Defect)
- **File & Line:** [03-01-PLAN.md:162](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-01-PLAN.md#L162)
- **Description:** The planned SQL uses `where l.coordinates::geometry && ST_MakeEnvelope(...)`. Since the active GiST index `idx_locations_coordinates_active` is defined directly on the `coordinates` column (type `geography`), casting `l.coordinates::geometry` on the left-hand side of the `&&` operator prevents PostgreSQL from matching the column to the index, forcing a complete sequential scan of the `locations` table on every pan/zoom.
- **Required Fix:** Keep the left-hand side raw and cast the envelope to `geography` on the right-hand side so PostGIS uses the index:
  ```sql
  where l.coordinates && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  ```

#### 3. [MAJOR] Violation of Decision D-08 (Incorrect Filtering on Nulls)
- **File & Line:** [03-01-PLAN.md:162](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-01-PLAN.md#L162)
- **Description:** Decision D-08 requires that locations with missing/null underlying data (no tags, null columns) must be INCLUDED by default when data-dependent filters (Wheelchair, Changing Table, Currently Open, Cleanliness) are active. The planned SQL uses `exists (select 1 from tags ...)` and `is_open_now = true`, which will immediately hide all locations with missing data (including all new/seed locations) the moment a filter is turned on.
- **Required Fix:** Adjust the SQL filter expressions:
  - **Currently Open:** `and (not filter_open_now or l.is_open_now is not false)`
  - **Wheelchair:** `and (not filter_wheelchair or not exists (select 1 from public.tags t where t.location_id = l.id and t.key='accessibility') or exists (select 1 from public.tags t where t.location_id = l.id and t.key='accessibility' and t.value='wheelchair'))`
  - **Changing Table:** `and (not filter_changing or not exists (select 1 from public.tags t where t.location_id = l.id and t.key='amenity') or exists (select 1 from public.tags t where t.location_id = l.id and t.key='amenity' and t.value='changing_table'))`
  - **Cleanliness/High Conf:** `and (not filter_high_conf or l.confidence_tier is null or l.confidence_tier = 'High')`

#### 4. [MAJOR] Bbox Antimeridian Crossing Crash
- **File & Line:** [03-01-PLAN.md:162](file:///C:/Users/mrsai/Gotta%20Go/.planning/phases/03-read-path-map/03-01-PLAN.md#L162)
- **Description:** Panning the map across longitude 180 (the antimeridian) generates viewport parameters where `min_lng > max_lng`. Passing these directly to `ST_MakeEnvelope` causes PostGIS to throw a database exception (`xmin cannot be greater than xmax`), crashing the client MapScreen.
- **Required Fix:** Detect antimeridian crossing in the function body and split the query into two envelopes wrapping the meridian:
  ```sql
  if min_lng > max_lng then
    return query
    select ...
    from public.locations l
    where (l.coordinates && st_makeenvelope(min_lng, min_lat, 180, max_lat, 4326)::geography
           or l.coordinates && st_makeenvelope(-180, min_lat, max_lng, max_lat, 4326)::geography)
      and ...
  else
    return query
    select ...
    from public.locations l
    where l.coordinates && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
      and ...
  end if;
  ```

---

### Concerns

- **Zustand MMKV Cold Start (Decision D-05 vs D-06):** MMKV persists values permanently. Simply using a standard persisted Zustand store means filters will survive app restarts (cold starts), violating D-05. The client hook must explicitly reset filters on first app mount or inject a session marker to clear them during startup. [MEDIUM Severity]
- **Composite Tag Indexing:** The `tags` table lacks a composite index on `(location_id, key, value)`. While negligible at smaller scales, adding a composite index will optimize `EXISTS` queries as the database expands. [LOW Severity]

---

### Suggestions

- **Impersonate User in pgTAP Tests:** When writing pgTAP integration tests for `family_mode` filtering, ensure you use `set_config('request.jwt.claims', ...)` or a helper to simulate authenticating as a user with `family_mode = true` vs. `family_mode = false`, verifying the RLS and RPC-level visibility changes.
- **Parametric pgTAP Limit Test:** Avoid seeding >200 pins just to verify `max_pins_per_viewport`. Instead, assert that when calling `search_locations_bbox` with `max_pins := 2`, only 2 rows are returned from a larger seed dataset.

---

### Verification
- Schema structures checked against [20260519010000_remote_schema.sql](file:///C:/Users/mrsai/Gotta%20Go/supabase/migrations/20260519010000_remote_schema.sql).
- Index definition and behavior evaluated against PG query planner index usage requirements.
- No execution occurred as this is a pre-execution plan review phase.

---

### Runtime Boundary Check
- **Call-Path Analysis:** The front-end screens (`MapScreen` and `NearbyScreen`) fetch data through TanStack Query, which directly invokes the RPC client. Security is enforced entirely at the database layer (via `SECURITY DEFINER` function bodies bypassing RLS). If the logic bugs in `search_locations_bbox` or `update_profile` are executed, they will affect both Map and Nearby list screens immediately and lead to silent profile data corruption.
- **Mock Boundary Check:** MSW handlers in `03-02-PLAN.md` must accurately mimic the new signatures. Specifically, the get_location_detail handler needs to simulate the conditional `distance_m` return (returning a distance when user coords are passed, null otherwise) to ensure frontend rendering handles the missing distance state correctly (D-12).

---

### Approved
- The basic architecture of calling `SECURITY DEFINER` RPCs to isolate client logic from structural table fields (like `deleted_at`, `shadowban_status`, and `access_instructions`) is correct and satisfies product privacy requirements.
- The use of `ShapeSource` native clustering in Mapbox avoids expensive JS-side grid computation.
- Use of locale-based distance formatting (`usesMiles`) matches the global launch strategy.
