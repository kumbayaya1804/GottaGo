# TDD Guard — Gotta Go Project Rules

## GPS Distance Tests
Every write to `verification_events` must have a test that asserts `distance_from_location_meters` is below the 100-meter threshold. Never test raw lat/lon values — always test through the PostGIS geometry or geography column.

## Trust Score Delta Tests
Every write to `trust_events` must assert that the `delta` sign matches the `action_type`. Positive actions produce positive deltas; negative/flag actions produce negative deltas.

## PostGIS Geometry Tests
Never test GPS coordinates as raw lat/lon floats. Always test through the geometry/geography column (e.g., `ST_DWithin`, `ST_Distance`, or equivalent). Tests that assert raw numeric coordinate values will be rejected.

## RLS Tests
Any new table or any change to a Row Level Security policy requires a test that asserts unauthorized access returns 0 rows. The test must use a different auth context (e.g., anon key or a different user's JWT) from the one that created the data.

## TDD Order
All `app/src/` files must follow strict TDD order: write a failing test first, watch it fail, then implement. Do not commit implementation code without a corresponding test that was written before it.

## Coverage
100% lines, branches, functions, and statements are required for all `app/src/` code. No exceptions.
