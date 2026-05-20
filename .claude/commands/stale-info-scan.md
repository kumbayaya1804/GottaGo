# /stale-info-scan

Perform a read-only scan for stale project information and write the latest scan report to `.planning/stale-info-scan-latest.md`.

## Purpose

Use this command to catch drift between docs, prompts, plans, schema, generated types, dependencies, review artifacts, and launch assumptions before stale context affects implementation or review.

## Required Context

Read these first:

- `docs/stale-info-scan.md`
- `docs/agent-harness.md`
- `AGENTS_ROSTER.md`
- `AGENTS.md`
- `CLAUDE.md`
- `SPEC.md`
- `.planning/PROJECT.md`
- `CODEX.md`
- `ANTIGRAVITY.md`

If the scan is being run before Codex review, also read `.claude/codex-prompt-latest.md`.

## Procedure

1. Identify the trigger: monthly cadence, phase transition, milestone close, dependency/tool/schema change, release check, or reviewer request.
2. Inspect the required context files and current review artifacts.
3. Run the standard local commands from `docs/stale-info-scan.md` that apply to the current repo state.
4. Compare active docs against actual files, scripts, migrations, generated types, and current review artifacts.
5. Use official current documentation only when an external fact is high-drift and decision-affecting.
6. Do not edit product docs during the scan unless the human explicitly asks for fixes. Report findings first.
7. Write `.planning/stale-info-scan-latest.md` using the template in `docs/stale-info-scan.md`.
8. For BLOCKING STALE INFO or UPDATE REQUIRED findings, add the affected files to `.claude/review-queue.txt` after fixes are made.

## Minimum Checks

Run at least these unless the relevant directory does not exist:

```powershell
git status --short
git diff --name-only
rg -n "Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .planning .claude
rg -n "service_role|EXPO_PUBLIC|NEXT_PUBLIC|eyJ|sk\\.|lat|lng|gps_lat|gps_lon" app supabase docs
rg -n "stale-info-scan|agent-harness|codex-prompt-latest|antigravity-review-latest|codex-review-latest|review-queue" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md docs .claude
```

If `app/package.json` exists, inspect it and compare scripts against `docs/verification.md`. Run tests only when the scan trigger requires verification or when stale script/tooling claims are suspected.

## Output Rules

- Use the severity groups from `docs/stale-info-scan.md`.
- Cite files and line numbers when possible.
- Record commands that failed or were skipped with reasons.
- Do not claim live Supabase, app-store, npm registry, or external-doc verification unless it actually ran.
- Set `Next review due` to 30 calendar days after the scan date unless a nearer phase, milestone, release, or dependency/schema change is expected.
