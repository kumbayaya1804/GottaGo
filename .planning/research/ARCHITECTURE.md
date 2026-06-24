# Architecture Patterns

**Domain:** GPS-verified crowdsourced location finder (bathroom discovery, parent-driven acquisition wedge)
**Project:** Gotta Go
**Researched:** 2026-05-18
**Stack (committed):** Expo (React Native), Supabase (Postgres + Auth), PostGIS, Mapbox
**Overall confidence:** MEDIUM-HIGH (schema already exists; remaining decisions are integration-level, not greenfield)

---

## 1. Recommended Architecture (High-Level)

Gotta Go is a four-tier system that hides almost all integrity logic behind the database layer. The client is a thin, mostly-display surface; the trust engine lives in Postgres; the moderation surface is a separate (admin) read-path.

```
+--------------------------------------------------------------------+
|  Tier 1: Client (Expo / React Native)                              |
|  ----------------------------------------------------------------- |
|  - Mapbox MapView (clustering, viewport bbox)                      |
|  - expo-location (foreground GPS, accuracy + mocked flag)          |
|  - Supabase JS client (anon/auth JWT only)                         |
|  - Local cache: TanStack Query + AsyncStorage (recent results)     |
|  Responsibilities: render, capture intent, capture raw GPS sample. |
|  NOT responsible for: trust math, distance auth, shadowban filter. |
+--------------------------------+-----------------------------------+
                                 |
                                 v  (HTTPS, anon/authed JWT)
+--------------------------------------------------------------------+
|  Tier 2: Supabase Edge / PostgREST Surface                         |
|  ----------------------------------------------------------------- |
|  - PostgREST RPC (calls SECURITY INVOKER db functions)             |
|  - Edge Functions (Deno) for: 3rd-party calls, image moderation,   |
|    materialized view refresh scheduler, trust recompute jobs       |
|  Responsibilities: stable API contract, auth boundary, rate limit. |
+--------------------------------+-----------------------------------+
                                 |
                                 v  (SQL, RLS enforced)
+--------------------------------------------------------------------+
|  Tier 3: Postgres + PostGIS (Source of Truth + Trust Engine)       |
|  ----------------------------------------------------------------- |
|  Search RPCs:                                                      |
|    - search_locations_nearby(lat, lon, radius_m, filters)          |
|    - search_locations_bbox(min_lng, min_lat, max_lng, max_lat)     |
|  Mutation RPCs:                                                    |
|    - submit_location()       -> inserts pending row                |
|    - verify_location()       -> writes verification_event + trust  |
|    - flag_location()         -> writes availability_flag / report  |
|  Server-only logic:                                                |
|    - GPS validation (ST_DWithin, accuracy gates, freshness)        |
|    - Trust weighting (SECURITY DEFINER, search_path = '')          |
|    - Confidence decay (scheduled job)                              |
|    - Shadowban filter (baked into every public RPC + RLS USING)    |
|  Materialized view: respect_signal_90d (refreshed CONCURRENTLY)    |
+--------------------------------+-----------------------------------+
                                 |
                                 v  (admin JWT, separate role)
+--------------------------------------------------------------------+
|  Tier 4: Moderation (Out of v1 client; Supabase Studio first)      |
|  ----------------------------------------------------------------- |
|  - Admin reads reports, sets shadowban_status, soft-deletes        |
|  - All writes via SECURITY DEFINER admin functions                 |
+--------------------------------------------------------------------+
```

**Design principle:** *The client is untrusted.* The client may LIE about location, identity, or trust score. Every decision that matters happens in tier 3 with the client's raw GPS sample as input, never as authority. This is the published guidance for crowdsourced location systems and matches the SPEC.md statement that "the client must not be the final authority for trust, proximity, shadowban eligibility, or moderation-sensitive decisions."

---

## 2. Component Boundaries

### 2.1 Client Components (Expo / React Native)

| Component | Single Responsibility | Talks To (outbound) | Must NOT Do |
|---|---|---|---|
| `MapScreen` | Render Mapbox view, emit viewport bbox + zoom | `useLocations(bbox)` query hook | Apply shadowban filter, compute distance auth |
| `EmergencyMode` | One-tap "find nearest", emit GPS to RPC | `rpc('search_locations_nearby')` | Pre-filter results, cache raw user GPS to disk |
| `SubmitFlow` | Capture form + fresh GPS sample | `rpc('submit_location')` | Decide if location is valid |
| `VerifyFlow` | Capture fresh GPS, post to RPC | `rpc('verify_location')` | Compute trust weight, decide acceptance |
| `LocationDetail` | Render attrs, rating UI, "code is wrong" CTA | `rpc('flag_location')`, `rpc('rate_location')` | Show hidden moderation state |
| `GpsService` (hook) | Wrap `expo-location`, expose `{coord, accuracy, mocked, timestamp}` | expo-location native | Filter mocked samples (server decides) |
| `AuthGate` | Supabase auth session + token refresh | Supabase auth | Store service-role keys |
| `LocalCache` (TanStack Query) | Cache recent map results | n/a | Cache submission/verification mutations long-term |

**Boundary rule:** the client passes the raw GPS triple `{lat, lon, accuracy_m, fix_timestamp, mocked_flag}` into every mutation. It does not decide whether the sample is acceptable; the database does.

### 2.2 PostgREST / RPC Surface (Tier 2)

Two kinds of RPCs:

1. **Public read RPCs** (anon callable, SECURITY INVOKER, RLS-respected): viewport search, detail fetch.
2. **Authenticated mutation RPCs** (require `auth.uid()`, often SECURITY DEFINER with hard input validation, `search_path = ''`): submission, verification, flagging, rating.

Edge Functions exist only when something cannot or should not be in SQL: Google Play Integrity / App Attest token verification, scheduled jobs that drive `REFRESH MATERIALIZED VIEW CONCURRENTLY respect_signal_90d`, image moderation if user-uploaded photos are added later. The Supabase published rule of thumb — DB functions for data logic, Edge functions for external APIs / async — fits this project well.

### 2.3 Database Components (Tier 3, source of truth)

These map onto the recovered schema:

| Component | Responsibility | Reads From | Writes To |
|---|---|---|---|
| `locations` | Canonical place row, coordinates (PostGIS geometry) | n/a (root) | Updated by trust engine: `confidence_score`, `suppressed_at`, `is_shadowbanned` |
| `verification_events` | Append-only GPS verification log | n/a (root append) | Trigger fires `recalc_confidence(location_id)` and `recalc_trust(user_id)` |
| `trust_events` | Append-only trust-score delta log | n/a | Written by SECURITY DEFINER functions only |
| `availability_flags` | Short-lived "code wrong", "closed now" signals | n/a | Filtered by `expires_at > now()` in every public read |
| `reports` | Abuse, duplicate, closure | n/a | Drives moderation pipeline; reporter identity never public |
| `users` | Public-safe user state + trust score | n/a | `trust_score` writable only by SECURITY DEFINER |
| `respect_signal_log` | Raw 90-day input feed | verification_events, ratings, flags | Source of materialized view |
| `respect_signal_90d` (matview) | Rolling 90-day quality aggregate | respect_signal_log | Refreshed CONCURRENTLY on schedule |
| `confidence_scores` (or column on locations) | Per-location decayed score | verification_events freshness | Touched by decay job + verify triggers |
| `app_config` | Tunables: radius_m, accuracy_max, half_life_days | n/a | Admin only |

### 2.4 Trust Engine (logical component, distributed across DB functions)

The trust engine is not a service — it's a set of cooperating SQL functions and triggers:

```
verification_events INSERT
   |
   +--> validate_verification_event() (BEFORE INSERT trigger)
   |       - reject mocked = true
   |       - reject accuracy_m > app_config.max_accuracy_m
   |       - reject fix_timestamp older than app_config.max_age_s
   |       - reject ST_Distance(user_geog, location_geog) > radius_m
   |       - reject if user.is_shadowbanned (compute but flag as zero-weight)
   |
   +--> compute_weighted_value() (BEFORE INSERT)
   |       weight = user.trust_multiplier
   |              * proximity_decay(distance_m)        -- closer = higher
   |              * accuracy_decay(accuracy_m)         -- tighter fix = higher
   |       store as verification_events.weighted_value
   |
   +--> AFTER INSERT trigger row:
           - upsert/update locations.confidence_score
           - insert into respect_signal_log
           - if location.status = 'pending' and verifications >= 2 with
             independent users + non-shadowbanned: publish location
           - emit trust_events row (positive delta for verifier)
```

This is the "weighted contributions" + "negative behavior weighted higher" pattern documented in reputation-system literature; gameability resistance comes from: (a) weighting by trust score so new accounts contribute little, (b) requiring independent verifiers (different `user_id`), (c) server-side proximity check makes location spoofing the only attack, which is handled in tier 1.5 (mocked-flag + Edge integrity check).

---

## 3. Data Flow Diagrams

### 3.1 Search Flow (Map Discovery)

```
MapScreen viewport change
   -> useLocations(bbox)
   -> supabase.rpc('search_locations_bbox', {min_lng, min_lat, max_lng, max_lat})
   -> PostgREST -> SQL function (SECURITY INVOKER)
        SELECT id, name, ST_Y(coordinates::geometry) AS lat, ST_X(coordinates::geometry) AS lng,
               confidence_score, respect_90d, has_changing_table
          FROM locations l
          LEFT JOIN respect_signal_90d r ON r.location_id = l.id
         WHERE l.coordinates && ST_MakeEnvelope($1,$2,$3,$4, 4326)
           AND l.deleted_at IS NULL
           AND l.suppressed_at IS NULL
           AND l.is_shadowbanned = false
           AND l.status = 'published'
         ORDER BY l.confidence_score DESC
         LIMIT 200;
   -> JSON to client
   -> Supercluster on-device for visual clusters
```

Shadowban / soft-delete filters are inside the RPC body, not in the client. RLS adds belt-and-suspenders.

### 3.2 Submission Flow (Add a Bathroom)

```
SubmitFlow form complete
   -> GpsService.getFresh({accuracy: high}) -> {lat, lon, acc, ts, mocked}
   -> supabase.rpc('submit_location', { name, address, policy_tag, gps:{...} })
   -> SQL function (SECURITY DEFINER):
        1. require auth.uid()
        2. validate gps: !mocked, acc <= 50m, ts within 60s
        3. insert into locations with status='pending'
        4. insert verification_events (creator-initial verification)
        5. confidence trigger fires (publish check is FALSE: only 1 verification)
        6. trust_events: small positive delta to submitter
   -> returns {id, status:'pending'}
```

The "1 verification + 48-hour no-flag" alternative path lives in a scheduled job that promotes pending rows whose creator verification is non-shadowbanned and which have no `reports` after 48h.

### 3.3 Verification Flow (Other User Confirms)

```
LocationDetail "I'm here" button
   -> GpsService.getFresh() -> sample
   -> supabase.rpc('verify_location', {location_id, gps:{...}})
   -> SECURITY DEFINER function:
        validate (mocked, accuracy, freshness, ST_DWithin)
        insert verification_events (weighted_value computed)
        triggers:
          - if location.status = pending AND distinct verifiers >= 2
            (excluding shadowbanned) -> set status='published'
          - update locations.confidence_score
          - insert respect_signal_log row
          - trust_events: positive delta to verifier
   -> returns {accepted: bool, reason?: text}
```

Edge case: the client *must* be told accepted/rejected without leaking *why* in a way that helps spoofers ("rejected" is sufficient; no "distance was 87m, max 50m"). This avoids the SPEC.md leak warning about shadowban / hidden status visibility.

### 3.4 Confidence Decay (Background)

```
pg_cron (or Supabase scheduled Edge Function) every 6h:
   UPDATE locations
      SET confidence_score = confidence_score
                           * exp(-ln(2) * elapsed_days / half_life_days)
    WHERE status = 'published';

   REFRESH MATERIALIZED VIEW CONCURRENTLY respect_signal_90d;
```

Half-life model is the standard exponential-decay pattern with a tunable `half_life_days` in `app_config`. Cap floor so a location never disappears entirely (avoid the "reputation death spiral" Gemini flagged in SYSTEM_MAP.md) — pin minimum confidence at ~0.05 and require an active `suppressed_at` for actual hiding.

### 3.5 Trust Score Recompute

Cheapest correct model: incremental on each `verification_events` insert, plus a nightly full recompute job that rebuilds `users.trust_score` from `trust_events` history. The full recompute is the audit trail per `docs/schema-contract.md` ("auditable and deterministic enough to explain trust changes").

---

## 4. Patterns to Follow

### Pattern 1: Geography over Geometry for Distance

**What:** Store coordinates as `geography(Point, 4326)`. Use `ST_DWithin(loc, point, meters)` and `ST_Distance(loc, point)` directly — both return meters.
**When:** Always, for canonical storage and proximity checks.
**Why:** Storing as `geometry(Point, 4326)` and using `ST_DWithin` *appears* to work but the distance argument is interpreted in *degrees*, producing "quietly consistent wrong output." Geography type defaults to meter-correct spheroid math.
**Index:** `CREATE INDEX ... USING GIST (location);` on the geography column.

```sql
SELECT id FROM locations
 WHERE ST_DWithin(location, ST_MakePoint($lon, $lat)::geography, $radius_m)
   AND deleted_at IS NULL AND suppressed_at IS NULL
   AND is_shadowbanned = false;
```

### Pattern 2: Shadowban Filter at Query Boundary (not UI)

**What:** Every public-read RPC and every RLS USING clause includes:
```sql
deleted_at IS NULL
  AND suppressed_at IS NULL
  AND is_shadowbanned = false
```
**Why:** SYSTEM_MAP.md and SPEC.md both require shadowban enforcement at the DB layer. UI filtering is a defect.
**Detection:** A reviewer test should call the RPC as a shadowbanned user and assert the user's *own* shadowbanned location does not appear — and that the error/empty result is indistinguishable from "no nearby data."

### Pattern 3: SECURITY DEFINER for Trust-Sensitive Writes

**What:** Functions that update `trust_score`, `confidence_score`, or transition `status='pending' -> 'published'` are `SECURITY DEFINER` with `SET search_path = ''` and fully-schema-qualified table references.
**Why:** Supabase docs explicitly require this to prevent search-path attacks against definer functions. Clients can call them but cannot subvert them.

### Pattern 4: Append-Only Audit (verification_events, trust_events)

**What:** Both tables are insert-only; corrections happen by appending compensating rows.
**Why:** Required by schema-contract.md: trust changes must be "auditable and deterministic enough to explain." Mutability of past events makes audit impossible.

### Pattern 5: Materialized View with CONCURRENTLY Refresh

**What:** `respect_signal_90d` has a unique index on `(location_id)` and is refreshed via `REFRESH MATERIALIZED VIEW CONCURRENTLY respect_signal_90d;`.
**Why:** Concurrent refresh requires a unique index but does not lock concurrent SELECTs. The 90d window is the SPEC requirement; the cost is full recompute every refresh — acceptable at v1 scale, problematic at 100k+ locations. Plan to introduce `pg_ivm` or a roll-forward log-based aggregate at the v2 scaling boundary.

### Pattern 6: GPS Triple Always Passed to Server

**What:** Client passes `{lat, lon, accuracy_m, fix_timestamp, mocked}` on every mutation. Server validates *all four*.
**Why:** Distance alone is gameable; accuracy + freshness + mocked flag together raise the bar from "spoof a coord" to "spoof a coord with realistic precision, recent timestamp, and not flagged as mock by the OS."

### Pattern 7: Online-First with Read Cache, Never Mutation Cache

**What:** Map results are cached in TanStack Query with short staleTime (~60s). *Mutations are never queued offline.* If GPS isn't available or auth isn't fresh, the verify/submit buttons are disabled.
**Why:** Offline-first sounds attractive but the core invariant is *fresh GPS at time of action*. A submission queued from an hour ago at a different location is a spoof vector. For a finder app, online-first is correct; offline reads (cached recent results) are the only sensible offline mode. This matches the "online-first is simpler" guidance and the project's data-integrity constraint.

### Pattern 8: Bounding-Box Search + Client Clustering

**What:** Server returns up to ~200 raw points inside the current Mapbox viewport bbox; client uses `supercluster` to cluster visually.
**Why:** PostGIS clustering server-side does not pair well with smooth zoom interactions. The published React Native + Mapbox pattern uses `getVisibleBounds()` + supercluster, which is fast and avoids round-trips on every zoom.

---

## 5. Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Computed Trust or Distance Authority
**What:** Computing weighted value, distance gating, or shadowban filter in React Native and trusting it.
**Why bad:** Reverse-engineerable; any attacker can patch the JS bundle. Violates SPEC.md.
**Instead:** Client sends raw GPS; server decides.

### Anti-Pattern 2: Raw lat/lon Columns as Source of Truth
**What:** Two numeric columns `latitude`, `longitude` used in app code via Haversine distance in degrees.
**Why bad:** schema-contract.md explicitly rejects this. Spatial indexes won't be used; distance math will be wrong; SRID handling will be ad hoc.
**Instead:** `geography(Point, 4326)` only; lat/lon only as derived/display.

### Anti-Pattern 3: Service-Role Key in Client
**What:** Embedding service_role JWT to "bypass RLS for admin features."
**Why bad:** Catastrophic — service_role bypasses ALL RLS, anywhere, forever.
**Instead:** Admin/moderation lives behind Edge Functions or a separate admin app. Client only ever holds the anon key + user JWT.

### Anti-Pattern 4: Synchronous Trust Recompute in Mutation Path
**What:** On every verification_events insert, walk all of `verification_events` for that user and recompute global trust score inline.
**Why bad:** O(history) on every write. Lock contention. Trust score should be incremental + nightly full recompute.
**Instead:** Append `trust_events` row with `score_delta`; update `users.trust_score` by `+= score_delta`; nightly job fully re-derives from `trust_events` for drift detection.

### Anti-Pattern 5: Treating Materialized View as Real-Time
**What:** UI shows `respect_90d` and assumes it's current to the second.
**Why bad:** Refresh is periodic (`REFRESH MATERIALIZED VIEW CONCURRENTLY` rebuilds the whole result). Latency window is the refresh interval.
**Instead:** Document refresh cadence in `app_config`. UI shows "last verified 3h ago" from `verification_events.MAX(verified_at)` (live), separately from the slower 90d aggregate.

### Anti-Pattern 6: Confidence Score That Can Reach Zero
**What:** Exponential decay with no floor leads to locations becoming effectively invisible after low traffic.
**Why bad:** Gemini called this out in SYSTEM_MAP.md ("reputation death spirals" for valid but low-traffic locations).
**Instead:** Floor at `app_config.confidence_floor` (~0.05). Locations are *hidden* only via `suppressed_at`, not via score reaching 0.

### Anti-Pattern 7: Leaking Why-Rejected Information
**What:** Returning `{rejected: true, reason: "you are 87 m away, max 50 m"}`.
**Why bad:** Tells a spoofer exactly what the gate is. Same risk for shadowban "your contribution is hidden."
**Instead:** Return generic accept/reject. Log full reason server-side for moderation.

### Anti-Pattern 8: Skipping the Mock-Location Flag
**What:** Ignoring `mocked` field from `expo-location.getCurrentPositionAsync()`.
**Why bad:** Android API >= 18 reliably reports mocked positions; ignoring it leaves the easiest spoof path open.
**Instead:** Reject mocked = true in submit/verify. Accept in MapScreen browse (it's harmless to look at a map from a fake location).

---

## 6. Build Order Implications (Hard Dependencies)

This is the architecturally-derived order. Each level has hard dependencies on everything above it. Roadmap should respect these unless deliberately breaking them.

### Level 0 — Foundation (cannot start any feature without this)

1. **Supabase project + migrations applied** (the existing schema)
2. **PostGIS + pgcrypto extensions verified enabled**
3. **GIST index on `locations.coordinates`**
4. **`app_config` table seeded with tunables**: `max_accuracy_m`, `max_gps_age_s`, `verify_radius_m`, `decay_half_life_days`, `confidence_floor`
5. **RLS enabled on every table; default-deny policies**

### Level 1 — Read Path (unblocks the entire client)

6. **`search_locations_bbox` RPC** with shadowban/soft-delete/suppress/expire filters baked in
7. **`search_locations_nearby` RPC** for emergency mode
8. **`get_location_detail(id)` RPC** with attribute joins
9. **Auth wiring** (email/password, Google OAuth) — required before any mutation work

### Level 2 — Mutation Foundation (depends on Level 1 auth + RPCs)

10. **`GpsService` hook** in Expo: returns `{coord, accuracy, mocked, ts}` with high-accuracy mode
11. **`submit_location` RPC** with GPS triple validation + status='pending'
12. **Server-side mocked/accuracy/freshness/distance gate** as a reusable PL/pgSQL function (called from submit AND verify)

### Level 3 — Trust Engine (depends on Level 2 inserts)

13. **`verify_location` RPC** — fires the AFTER INSERT trigger chain
14. **`recalc_confidence(location_id)` trigger function**
15. **Publish-on-N-verifications trigger** (N = 2 distinct non-shadowbanned)
16. **`trust_events` append + `users.trust_score` incremental update**
17. **`compute_weighted_value()` function** (trust × proximity × accuracy)

> Trust engine is independently testable: insert synthetic verification rows, assert publish state transitions, assert weighted_value matches formula, assert shadowbanned-user inserts don't affect aggregates.

### Level 4 — Decay + Aggregates (depends on Level 3 events existing)

18. **`respect_signal_log` triggers** from verification_events / ratings / flags
19. **`respect_signal_90d` materialized view** with unique index on location_id
20. **Scheduled refresh job** (pg_cron or scheduled Edge Function), CONCURRENTLY
21. **Confidence decay job** (every 6h or daily), with floor

### Level 5 — Reports, Flags, Moderation Inputs

22. **`flag_location` / availability_flags RPC** (filtered by `expires_at > now()`)
23. **`report_location` RPC** (reporter identity never returned in public reads)
24. **Auto-suppress trigger** when reports of same type exceed threshold (sets `suppressed_at`, no auto-delete)

### Level 6 — Moderation Surface (admin-only; v1 = Supabase Studio is acceptable)

25. **Admin SECURITY DEFINER functions** for shadowban/suppress/unsuppress
26. **Admin views** that *do* expose reporter identity (with strict role check)
27. **Optional: lightweight admin web view**, not in mobile app

### Level 7 — Client UX Layers (mostly independent of each other)

28. **Mapbox MapView + bbox viewport hook + supercluster**
29. **Emergency Mode** (one-tap nearest)
30. **Submit / Verify flows** (UI on top of Level 2/3 RPCs)
31. **Rating UI**
32. **"Changing Table NOW" specialized filter** — parent segment differentiator

### Level 8 — Operations / Hardening (parallel with Level 7 once basics work)

33. **Play Integrity / App Attest token verification** in Edge Function — defense-in-depth against rooted/jailbroken devices submitting valid-looking but mocked GPS
34. **Telemetry that does not store raw coords or user IDs**
35. **Migration tests + RLS policy tests**

### Why this order matters

- Skipping Level 0–1 means every later feature has nothing to render and no auth boundary.
- Building Level 2 without Level 1 RPCs invites lat/lon-as-canonical regressions.
- Building UI (Level 7) before Trust Engine (Level 3) leaves a 4–6 week window where pretty submission flows produce data that the future trust engine cannot meaningfully validate retroactively.
- Building decay (Level 4) before publish-on-verification (Level 3) is meaningless — there is no data to decay.
- Moderation surface (Level 6) is intentionally last; until you have data and reports, building moderator tooling is speculative.

---

## 7. Scalability Considerations

| Concern | At 50 locations (Eugene seed) | At 5K locations (10-city) | At 50K+ (national) |
|---|---|---|---|
| Spatial search | GIST on geography is overkill but free | Still GIST; tune `LIMIT` | Add covering indexes; consider partitioning by region |
| respect_signal_90d refresh | Full CONCURRENT refresh every 1h fine | Refresh every 6h, off-peak | Replace with `pg_ivm` or roll-forward aggregates |
| Trust recompute | Inline incremental fine | Inline + nightly audit | Move audit recompute to read-replica |
| Mapbox tile costs | Free tier | Monitor MAU/tile loads | Negotiate enterprise; consider tile caching |
| GPS validation latency | Microseconds | Microseconds | Microseconds (PG-local) |
| Mock-location detection | Client `mocked` flag only | Add server cross-checks (IP-geo, impossible-travel) | Add Play Integrity / App Attest tokens |

The cost cliff is `respect_signal_90d`. Vanilla PG materialized views rebuild the full result each refresh; this is fine at v1 but should be flagged for v2 architecture review.

---

## 8. Critical Cross-Component Contracts

These are invariants the whole system depends on; breaking any one is a security or integrity bug.

1. **`locations.coordinates` is the *only* canonical coordinate.** No code path writes lat/lon as authoritative.
2. **Every public-read RPC ends in a four-clause filter:** `deleted_at IS NULL AND suppressed_at IS NULL AND is_shadowbanned = false AND status = 'published'`.
3. **Every mutation RPC requires `auth.uid()`** (no anonymous writes in v1).
4. **GPS triple `{lat, lon, accuracy, fix_timestamp, mocked}` is validated server-side on every submit + verify.**
5. **Trust and confidence column writes go through SECURITY DEFINER functions with `search_path = ''`.** No direct client writes.
6. **Shadowbanned users' inserts are accepted but produce `weighted_value = 0`** and do not transition pending->published. The user receives no indication.
7. **`verification_events` and `trust_events` are append-only.** Compensation = new row, never UPDATE/DELETE.
8. **Materialized view refresh runs CONCURRENTLY with a unique index** to avoid blocking reads.
9. **No PII (email, raw user_id beyond auth context, precise contributor coordinates) appears in client logs, error messages, or analytics events.**

---

## 9. Open Items For Phase-Specific Research

- **Exact tuning values** for `max_accuracy_m`, `verify_radius_m`, `decay_half_life_days`, `confidence_floor`, `report_auto_suppress_threshold` — needs field data from Eugene seed.
- **Play Integrity / App Attest** — required before public launch or before v1? (Recommend: before public launch; not before MVP testing.)
- **Whether ratings should also have decay** — current SPEC focuses decay on verification freshness, but old ratings may also become stale.
- **Photo submissions** — out of v1 SPEC, but if added, image moderation must live in an Edge Function before storage write.
- **Anonymous (no-auth) reads vs auth-required reads** — currently SPEC implies reads can be anon; confirm before launch.

---

## 10. Sources

PostGIS + spatial query:
- [ST_DWithin — postgis.net](https://postgis.net/docs/ST_DWithin.html) — HIGH (authoritative)
- [PostGIS Geometry vs Geography (McClarence, 2026)](https://medium.com/@philmcc/postgis-geometry-vs-geography-a-practical-decision-guide-9d8d2cf1ea40) — MEDIUM
- [PostgreSQL Best Practices: PostGIS Spatial Indexes — Alibaba Cloud](https://www.alibabacloud.com/blog/postgresql-best-practices-selection-and-optimization-of-postgis-spatial-indexes-gist-brin-and-r-tree_597034) — MEDIUM
- [PostGIS: Geo queries — Supabase Docs](https://supabase.com/docs/guides/database/extensions/postgis) — HIGH

Supabase / RLS / RPC:
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH
- [Database Functions — Supabase Docs](https://supabase.com/docs/guides/database/functions) — HIGH
- [Edge Functions — Supabase Docs](https://supabase.com/docs/guides/functions) — HIGH
- [Supabase Database Functions vs Edge Functions (2026) — CloseFuture](https://www.closefuture.io/blogs/supabase-database-vs-edge-functions) — MEDIUM
- [Supabase RLS Best Practices — MakerKit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM
- [Transactions and RLS in Edge Functions — Marmelab](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html) — MEDIUM

GPS verification / anti-spoof:
- [Protect Against Geo-Spoofing — Guardsquare](https://www.guardsquare.com/blog/securing-location-trust-to-prevent-geo-spoofing) — MEDIUM
- [Location Spoofing — Zimperium](https://zimperium.com/glossary/location-spoofing) — MEDIUM
- [Stop Geo-Spoofing with Secure API Integration — Approov](https://approov.io/blog/stop-geo-spoofing-with-secure-api-integration-for-mobile-application) — MEDIUM
- [expo-location — Expo Docs](https://docs.expo.dev/versions/latest/sdk/location/) — HIGH
- [react-native-turbo-mock-location-detector (GitHub)](https://github.com/jpudysz/react-native-turbo-mock-location-detector) — MEDIUM

Reputation / trust systems:
- [Providing Trustworthy Contributions via Reputation in Participatory Sensing (arXiv)](https://arxiv.org/pdf/1311.2349) — HIGH
- [Reputation-Based Trust Systems for P2P (Marti, Stanford)](https://crypto.stanford.edu/portia/papers/marti.pdf) — HIGH
- [Establishing Trust in Crowdsourced Data (arXiv 2025)](https://arxiv.org/pdf/2511.03016) — MEDIUM

Decay / aggregates / matviews:
- [REFRESH MATERIALIZED VIEW — PostgreSQL Docs](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html) — HIGH
- [Incremental Materialized Views — Tacnode](https://tacnode.io/post/incremental-materialized-views) — MEDIUM
- [Exponential Decay Function-Based Time-Aware Recommender (SAI)](https://thesai.org/Downloads/Volume13No10/Paper_71-Exponential_Decay_Function_Based_Time_Aware_Recommender_System.pdf) — MEDIUM
- [Half-Life Decaying Model for Recommender Systems](https://ceur-ws.org/Vol-2038/paper1.pdf) — MEDIUM

React Native / Mapbox / offline:
- [Expo Location guide — coffey.codes](https://coffey.codes/articles/building-location-based-features-using-expo-location) — MEDIUM
- [Finding Bounding Box using Mapbox GL on React Native — DEV](https://dev.to/kyle12jung/finding-bounding-box-using-mapbox-gl-on-react-native-3nma) — MEDIUM
- [Map Clustering with React Native — Upsilon](https://www.upsilonit.com/blog/how-to-do-map-clustering-with-react-native) — MEDIUM
- [Offline-First vs Online-First — Open Mobile Kit](https://openmobilekit.medium.com/offline-first-vs-online-first-app-architecture-choosing-the-right-strategy-for-your-app-0533c588e913) — MEDIUM
- [Offline-First Apps: Architecture — Locize](https://www.locize.com/blog/offline-first-apps/) — MEDIUM
