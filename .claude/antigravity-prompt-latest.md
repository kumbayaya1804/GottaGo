# Antigravity Review Packet — Phase 3 Plan Review (Cross-AI /gsd-review)

**Date:** 2026-07-05
**Requested verdict format:** Antigravity review format per `ANTIGRAVITY.md` § Output Format, including the mandatory **Runtime Boundary Check** section. Save your verdict to `.claude/antigravity-review-latest.md`.

## What This Is

This is a **pre-execution plan review**, not a code review — Phase 3 ("Read Path & Map") has not been implemented yet. All 5 plans are drafted and are being cross-AI reviewed before `/gsd:execute-phase 3` runs (the `/gsd-review --phase 3` step). This is a companion review to a Codex packet covering the same plans (`.claude/codex-prompt-latest.md`) — Codex is reviewing for security/privacy; you are reviewing for **PostGIS/spatial correctness**, per this project's standing reviewer contract (`CLAUDE.md` § Current Reviewer Contract: "Antigravity (PostGIS correctness)").

## Your Role And Context (read from disk)

Read in full: `ANTIGRAVITY.md`. Consult as needed: `docs/schema-contract.md` (live schema field names/types), `docs/agent-harness.md`, `docs/review-severity.md`. This review has no diff to inspect yet — your job is to judge whether the *planned* SQL/RPC design (not yet written) will be spatially and semantically correct once implemented.

## Files to Read (in this order)

1. `.planning/PROJECT.md` — project context, "Map & Discovery" requirements
2. `.planning/ROADMAP.md` — search "### Phase 3: Read Path & Map" for goal, dependencies, requirements, 12 success criteria
3. `.planning/phases/03-read-path-map/03-CONTEXT.md` — locked decisions D-01 through D-33
4. `.planning/phases/03-read-path-map/03-RESEARCH.md` — this is the important one for you: architecture patterns (esp. Pattern 2 bbox geography/geometry cast, Pattern 3 tag-join filters, Pattern 4 family_mode via `auth.uid()`), Pitfalls 1/2/5 (suppressed_at ordering, TEXT confidence_tier ordering, geography/geometry cast trap), and the resolved Open Questions (OQ-1 clustering, OQ-2 no `status` column, OQ-3 access-code omission)
5. All 5 plan files, in dependency order:
   - `.planning/phases/03-read-path-map/03-01-PLAN.md` (Wave 1 — the DB layer: `search_locations_bbox`, `search_locations_nearby`, `get_location_detail`, `suppressed_at` column + index, pgTAP tests — **this is your primary review target**)
   - `.planning/phases/03-read-path-map/03-02-PLAN.md` (Wave 2 — client data layer/hooks consuming the RPCs)
   - `.planning/phases/03-read-path-map/03-03-PLAN.md` (Wave 3 — MapScreen native clustering + LocationDetail sheet)
   - `.planning/phases/03-read-path-map/03-04-PLAN.md` (Wave 4 — Nearby list + family_mode toggle)
   - `.planning/phases/03-read-path-map/03-05-PLAN.md` (Wave 4 — filter chips + denied-GPS fallback)

## Review Instructions

Analyze the plan set as a whole and provide:

1. **Summary** — one-paragraph assessment of whether this plan set will deliver a spatially-correct, performant read path.
2. **Strengths** — what's well-designed (bullet points).
3. **Concerns** — potential issues, gaps, risks (bullet points, each tagged HIGH/MEDIUM/LOW severity).
4. **Suggestions** — specific, actionable improvements (bullet points).
5. **Risk Assessment** — overall risk level (LOW/MEDIUM/HIGH) with justification.

Focus especially on:
- **PostGIS correctness (your usual lane):** Is the `coordinates::geometry && ST_MakeEnvelope(...)` cast for the bbox test correct, while `ST_Distance`/`<->` KNN stays on `geography`? Is `ORDER BY CASE confidence_tier ... END DESC, verification_count DESC` actually a valid substitute for the invalid `ORDER BY confidence_score DESC` (confidence_score is TEXT)? Does the partial GiST index rebuild (`idx_locations_coordinates_active` with `AND suppressed_at IS NULL` added) still support both the bbox `&&` test and the `<->` KNN ordering after the 03-01 migration?
- Whether `search_locations_nearby`'s `<->` KNN ordering on `geography` will actually use the GiST index as planned, or silently degrade to a sequential scan given the added `suppressed_at`/moderation `WHERE` clauses.
- Whether `get_location_detail`'s new `distance_m` computation (`ST_Distance` between the row's `geography` point and a caller-supplied point) is consistent with `search_locations_nearby`'s distance expression, as the plan claims it must be (03-01 Task 2 action).
- Whether the tag-join filter pattern reused from `get_locations_in_radius` (EXISTS subqueries against `tags`) will perform acceptably at the `max_pins_per_viewport` (~200) scale, or needs an index recommendation.
- Whether the dev-only seed guard (D-31 — seed.sql loaded only on `db reset`, never `db push`) is architecturally sound, and whether the seed fixture set (sensitive/suppressed/shadowbanned/deleted/null-tag rows) is sufficient to exercise the pgTAP assertions listed in 03-01.
- Whether the client-side rendering plan (03-03's native Mapbox `ShapeSource cluster:true`) is consistent with the RPC response shape the DB layer produces (raw points, not pre-clustered) — i.e., no mismatch between what 03-01 returns and what 03-03 expects to receive.
- Any missing spatial edge cases: antimeridian/pole-crossing bbox queries, SRID mismatches, or degenerate viewports (zero-area bbox).

Output your review in markdown format, ending with a clear **VERDICT: APPROVE** or **VERDICT: REQUEST CHANGES** line, plus the mandatory **Runtime Boundary Check** section per `ANTIGRAVITY.md` § Output Format.

---

*Save your full review output to `.claude/antigravity-review-latest.md` when done.*
