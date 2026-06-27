# Stale Information Scan - 2026-06-27

Trigger: Phase transition — Phase 1.5 complete, entering Phase 2 planning
Branch: master
Commit: 9a1de31
Next review due: 2026-07-27

## Commands Run

- `git status --short` — 15 tracked files modified (unstaged), 9 untracked files
- `git log --oneline -5` — latest: 9a1de31 docs(02): UI design contract for Auth & Profiles
- `git diff --stat HEAD` — 15 files changed (79 insertions, 57 deletions) since last commit
- `rg -n "Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed" ...` — found stale model-version strings in ANTIGRAVITY.md and .claude/antigravity-prompt-latest.md; TBD plan placeholders in ROADMAP.md (Phases 3–9, expected); file:/// in .claude/antigravity-review-latest.md (pre-existing WATCH item)
- `rg -n "service_role|EXPO_PUBLIC|..." app/ supabase/ docs/` — all service_role hits are RLS policy patterns in migrations; EXPO_PUBLIC hits are in test setup (no actual values committed); no secrets found
- `rg -n "stale-info-scan|agent-harness|codex-prompt-latest|..."` — harness artifact references consistent across AGENTS.md, AGENTS_ROSTER.md, CLAUDE.md, CODEX.md, ANTIGRAVITY.md, docs/agent-harness.md
- `app/package.json` inspected — expo~55, react-native 0.83.6, jest@29.7.0, @rnmapbox/maps@10.3.1, @supabase/supabase-js@2.106.0, TanStack Query@5, zod@4 — consistent with CLAUDE.md constraints
- `docs/schema-contract.md` header — "aligned with live schema as of 2026-06-24"
- `supabase/migrations/` — 6 migrations, latest 20260624000002_ratings_privacy_fix.sql, consistent with schema-contract status date
- `.planning/PROJECT.md` git diff reviewed
- `.planning/ROADMAP.md` git diff reviewed
- `.planning/STATE.md` (untracked) reviewed — GSD state file

## BLOCKING STALE INFO

- None.

## UPDATE REQUIRED

1. **15 unstaged working-tree modifications not committed** — During the Phase 2 discuss session, GSD updated PROJECT.md, ROADMAP.md, and research docs (STACK.md, PITFALLS.md, FEATURES.md, ARCHITECTURE.md) to reflect the strategy shift from "Eugene, OR seed launch" to "global proof of concept." These changes exist in the working tree but were never committed. `/gsd-plan-phase` will read these files — if they are uncommitted, the planner could be reading mixed-state content. Required action: **commit the 15 modified files before running /gsd-plan-phase**.

   Files affected:
   - `.planning/PROJECT.md` — watch-the-gap fit section + constraints updated (Eugene → global)
   - `.planning/ROADMAP.md` — milestone name, Phase 7.5 renamed "Growth & Seed Operations"
   - `.planning/config.json` — GSD config state
   - `.planning/research/STACK.md`, `PITFALLS.md`, `FEATURES.md`, `ARCHITECTURE.md` — city-specific references updated to region-agnostic language
   - `README.md` — project description updated
   - `docs/design/design-system.md`, `docs/design/wireframes.md` — minor updates
   - `docs/stale-info-scan.md` — last reviewed date update
   - Planning phase context files — minor metadata

2. **`.claude/antigravity-prompt-latest.md` line 7 says "Gemini 3.5"** — This is the model identity Antigravity sees when prompted. The installed Antigravity CLI version may use a newer model. Regenerate this prompt via `/antigravity-review` or the review-gate before the next Antigravity review session to pick up any model identity changes. Deferred to immediately before Phase 2 review gate (not blocking plan phase).

## WATCH

3. **ANTIGRAVITY.md** references "Gemini 3.5" in three places (§43 heading "Gemini 3.5 Enhanced Capabilities", §45 capability description, §126 reasoning note). Antigravity works correctly regardless of the version string, but the identity description may not match the deployed model. Update before the next major review cycle.

4. **`docs/agent-harness.md`** "Last reviewed: 2026-05-20" and **`docs/stale-info-scan.md`** "Last reviewed: 2026-05-20" — date metadata is stale but content is consistent with the current workflow. Update last-reviewed dates when either document is next edited.

5. **`.claude/antigravity-review-latest.md`** contains `file:///` links (pre-existing from prior scan). Not actionable before plan phase; revisit if portability becomes a concern.

6. **`.planning/STATE.md`** is untracked — GSD-generated state file with `completed_phases: 1` (does not count Phase 1.5). Commit alongside the working-tree batch (UPDATE REQUIRED item 1).

7. **ROADMAP.md Phases 3–9 "Plans: TBD"** — expected placeholders for future phases, not drift. Revisit before each phase transition.

## CURRENT

- **Agent harness artifacts** — `.claude/review-queue.txt`, `.claude/antigravity-prompt-latest.md`, `.claude/antigravity-review-latest.md`, `.claude/codex-prompt-latest.md`, `.claude/codex-review-latest.md` all exist and reference correct paths per docs/agent-harness.md. ✓
- **Schema drift** — `docs/schema-contract.md` aligned with latest migration (20260624000002). No schema changes since last alignment. ✓
- **Secrets** — No `.env` values, service-role keys, JWTs, or private credentials found in committed files. Test setup uses placeholder values only. ✓
- **Dependencies** — expo@55, react-native 0.83.6, jest@29.7.0 (pinned), @rnmapbox/maps@10.3.1, Mapbox SDK v11.20.1 — all match CLAUDE.md constraints and prior approved choices. ✓
- **Phase status accuracy** — ROADMAP.md has Phase 1 `[x]` and Phase 1.5 `[x]` checked. Phase 2 `[ ]` with CONTEXT.md and UI-SPEC.md committed. Accurate. ✓
- **Product core value** — PROJECT.md still centers "certainty under urgency." ✓
- **TDD constraints** — jest@29.7.0 pinned, 100% coverage thresholds, tdd-guard-jest BLOCKED per CLAUDE.md. No drift. ✓
- **Review gate workflow** — `.claude/commands/review-gate.md` exists, chains GSD → Antigravity → Codex per harness. ✓

## Blocked Checks

- Live Supabase schema drift was not checked — no credentialed Supabase network access during this scan.
- App lint, typecheck, and tests were not run — no source code changes in scope; deferred to Phase 2 execution.
- External official documentation freshness (Expo SDK 55, Mapbox SDK v11, @supabase/supabase-js@2.106.0) not rechecked — no dependency changes since Phase 1.
