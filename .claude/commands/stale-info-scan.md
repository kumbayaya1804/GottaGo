# /stale-info-scan

Perform a read-only scan for stale project information and write `.planning/stale-info-scan-latest.md`.

## Purpose

Catch drift between docs, prompts, plans, schema, generated types, dependencies, review artifacts, and launch assumptions before stale context affects implementation or review.

## Context Loading

1. Read `docs/context-router.md`.
2. Read `docs/stale-info-scan.md`.
3. Read only the active docs, prompts, plans, or artifacts implicated by the trigger or search hits.
4. If the scan is before Codex or Antigravity review, inspect the current prompt manifest and queue.

Do not load every active project document up front. Use `rg` first, then expand to exact files/sections.

## Procedure

1. Identify trigger: monthly cadence, phase transition, milestone close, dependency/tool/schema change, release check, harness change, or reviewer request.
2. Run the standard local searches from `docs/stale-info-scan.md`.
3. Compare active docs against actual files, scripts, migrations, generated types, current state, and current review artifacts.
4. Use official current documentation only when an external fact is high-drift and decision-affecting.
5. Report findings first unless the user explicitly asked for fixes.
6. Write `.planning/stale-info-scan-latest.md` using the template in `docs/stale-info-scan.md`.
7. For fixed BLOCKING STALE INFO or UPDATE REQUIRED findings, add affected files to `.claude/review-queue.txt`.

## Minimum Local Searches

```powershell
git status --short
git diff --name-only
rg -n "Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .planning .claude
rg -n "service_role|EXPO_PUBLIC|NEXT_PUBLIC|eyJ|sk\.|lat|lng|gps_lat|gps_lon" app supabase docs
rg -n "stale-info-scan|agent-harness|codex-prompt-latest|antigravity-prompt-latest|antigravity-review-latest|codex-review-latest|review-queue" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md docs .claude
```

## Output Rules

- Use severity groups from `docs/stale-info-scan.md`.
- Cite files and line numbers when possible.
- Record commands that failed or were skipped with reasons.
- Do not claim live Supabase, app-store, npm registry, or external-doc verification unless it actually ran.
- Set `Next review due` to 30 calendar days after the scan date unless a nearer phase, milestone, release, or dependency/schema change is expected.
