# Skill: PostGIS Optimizer

## Purpose
Audit SQL and PostgREST RPCs for geospatial correctness and performance.

## Constraints
- **Canonical Unit**: Always use `geography` or cast to it for meters. Never use raw degrees for distance.
- **Indexing**: Proximity `WHERE` clauses must use `ST_DWithin` to leverage GiST indexes.
- **Ordering**: Use the `<->` KNN operator for "nearest" searches.
- **SRID**: Ensure SRID 4326 is used for all writes.

## Workflow
1. Read the proposed SQL or RPC.
2. Check for `ST_Distance` in `WHERE` (Pitfall #2).
3. Check for `geometry` without meter-casting (Pitfall #1).
4. Run `EXPLAIN ANALYZE` if database access is available to confirm Index Scans.
