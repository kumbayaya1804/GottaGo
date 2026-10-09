---
name: postgis-optimizer
description: Use when a Gotta Go migration, RPC, or app call site touches geography/geometry columns, radius or nearest-location search, SRID, distance units, or GPS verification, or when a review packet mentions PostGIS.
---

# Skill: PostGIS Optimizer

## Purpose

Audit geospatial SQL, RPCs, indexes, and client call sites for correctness and performance.

## Load When

- migrations or RPCs touch `coordinates`, geography/geometry columns, radius search, nearest search, or GPS verification
- app code consumes geospatial RPCs or maps returned distance/order values
- review packets mention PostGIS, SRID, distance, radius, or location search

## Context To Read

- affected SQL/RPC/migration
- relevant `docs/schema-contract.md` excerpt
- client call site and tests consuming the result
- query plan only when database access is available

## Rules

- Meter distances require `geography` or an explicit geography cast.
- Do not compare raw geometry degrees as meters.
- Radius predicates should use `ST_DWithin` so GiST indexes can be used.
- Nearest ordering should use the appropriate indexed KNN pattern when available.
- Writes must set SRID 4326 consistently.
- Client-provided coordinates are not authority for GPS-sensitive invariants unless server-side checks enforce radius, accuracy, and freshness.
- PostGIS is installed in the `extensions` schema. Under `set search_path = ''`, call `extensions.st_*`, cast to `extensions.geography`, and use `OPERATOR(extensions.<->)` for KNN. Unqualified calls fail when the function runs, not when the migration applies (see `20260710010000_phase3_postgis_schema_qualification_fix.sql`).
- `ST_MakePoint` takes longitude first: `st_makepoint(lng, lat)`. RPC parameters here are named `user_lat, user_lng`, so a swap is easy to write.
- In a function declared `returns table (id uuid, ...)`, every output column is a PL/pgSQL variable, so an unqualified `id` in the body raises SQLSTATE 42702 at call time. Qualify columns with a table alias. This broke every signed-in user's map, Nearby list, and detail reads from 2026-07-04 to 2026-07-30 (`20260730000000_fix_ambiguous_id_in_search_rpcs.sql`).

## Workflow

1. Identify every geospatial predicate, sort, and write.
2. Check units: meters vs degrees.
3. Check index compatibility for radius and nearest queries.
4. Check null, deleted, expired, unavailable, and shadowbanned location behavior.
5. Run `EXPLAIN` or `EXPLAIN ANALYZE` only when database access is available and safe.
