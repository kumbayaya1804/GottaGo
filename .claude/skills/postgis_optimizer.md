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

## Workflow

1. Identify every geospatial predicate, sort, and write.
2. Check units: meters vs degrees.
3. Check index compatibility for radius and nearest queries.
4. Check null, deleted, expired, unavailable, and shadowbanned location behavior.
5. Run `EXPLAIN` or `EXPLAIN ANALYZE` only when database access is available and safe.
