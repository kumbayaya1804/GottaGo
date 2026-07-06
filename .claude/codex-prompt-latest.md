# Codex Review Request - Gotta Go — Phase 3 Plan Review (Cross-AI /gsd-review)

## What This Is

This is a **pre-execution plan review**, not a code review — Phase 3 ("Read Path & Map") has not been implemented yet. All 5 plans are drafted and approved-pending-review. This is the `/gsd-review --phase 3` cross-AI peer review step: independent AI systems review the plans before `/gsd:execute-phase 3` runs, to catch gaps a single planner might miss. Your feedback will be fed back into planning via `/gsd:plan-phase 3 --reviews` if you raise blocking concerns.

Read `CODEX.md` in full for your standing operating contract. Apply the sections that generalize (read files from disk, trace call-paths, report exact `file:line` findings, don't approve on intent alone) — but note this review has no code to point line numbers at yet; findings here are about the *plans*, not implemented files.

## Files to Read (in this order)

1. `.planning/PROJECT.md` — project context, especially the "Map & Discovery" requirements section
2. `.planning/ROADMAP.md` — search for "### Phase 3: Read Path & Map" for the goal, dependencies, requirements, and 12 success criteria
3. `.planning/phases/03-read-path-map/03-CONTEXT.md` — locked user decisions (D-01 through D-33) and canonical references
4. `.planning/phases/03-read-path-map/03-RESEARCH.md` — architecture patterns, pitfalls, open questions (all marked RESOLVED), security domain
5. All 5 plan files, in dependency order:
   - `.planning/phases/03-read-path-map/03-01-PLAN.md` (Wave 1 — DB read RPCs)
   - `.planning/phases/03-read-path-map/03-02-PLAN.md` (Wave 2 — client data layer, depends on 03-01)
   - `.planning/phases/03-read-path-map/03-03-PLAN.md` (Wave 3 — MapScreen + LocationDetail sheet, depends on 03-01/02)
   - `.planning/phases/03-read-path-map/03-04-PLAN.md` (Wave 4 — Nearby tab + family_mode toggle, depends on 03-02/03)
   - `.planning/phases/03-read-path-map/03-05-PLAN.md` (Wave 4 — filter chips + denied-GPS fallback, depends on 03-02/03)

## Review Instructions

Analyze the plan set as a whole (not each plan in isolation — check the wave dependency chain holds together) and provide:

1. **Summary** — one-paragraph assessment of whether this plan set will deliver Phase 3's goal and 12 success criteria.
2. **Strengths** — what's well-designed (bullet points).
3. **Concerns** — potential issues, gaps, risks (bullet points, each tagged HIGH/MEDIUM/LOW severity).
4. **Suggestions** — specific, actionable improvements (bullet points).
5. **Risk Assessment** — overall risk level (LOW/MEDIUM/HIGH) with justification.

Focus especially on:
- **Security/privacy** (your usual lane): the four-clause moderation filter (`deleted_at`/`suppressed_at`/`shadowban_status`/family_mode) being enforced server-side in all three RPCs, `access_instructions` never leaking via `setof locations` or `select l.*`, SECURITY DEFINER `search_path` hardening, no family_mode client-spoofing (03-01's Pattern 4).
- Whether the dependency ordering (Wave 1→2→3→4) actually holds — does anything in a later wave silently need something a Wave 1/2 plan doesn't produce?
- Whether the dev-only seed guard (D-31, seed.sql loaded only on `db reset`, never `db push`) is actually safe from reaching production.
- Missing edge cases or error handling across the RPC → hook → screen chain.
- Scope creep or over-engineering relative to the phase goal.
- Whether the plans collectively satisfy ROADMAP Phase 3's 12 success criteria (check each one).

Output your review in markdown format, ending with a clear **VERDICT: APPROVE** or **VERDICT: REQUEST CHANGES** line (this project's standard convention — see prior rounds below for format).

## Verdict Definitions

Full text in `docs/review-severity.md`. This is a planning-stage review — a REQUEST CHANGES verdict should identify a concern significant enough to warrant re-planning before Wave 1 execution starts, not a nitpick.

---

*Save your full review output to `.claude/codex-review-latest.md` when done.*
