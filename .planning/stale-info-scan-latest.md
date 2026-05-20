# Stale Information Scan - 2026-05-20

Trigger: User requested a durable periodic stale-information scan process.
Branch: master
Commit: a148ed1
Next review due: 2026-06-19

## Commands Run

- `git status --short` - working tree contains existing staged and unstaged project changes plus this scan work.
- `git diff --name-only` - confirmed changed tracked files include agent docs, command prompts, project docs, and previous Codex prompt artifact.
- `rg -n "Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .planning .claude` - found scan-control terms, research notes, roadmap placeholders, local skill file links, and historical Gemini references outside active harness docs.
- `rg -n "service_role|EXPO_PUBLIC|NEXT_PUBLIC|eyJ|sk\." app supabase docs` - found expected `service_role` references in migrations/docs and one package-lock integrity hash false positive; no client service-role key or `sk.` secret was identified by this scan.
- `rg -n "\b(lat|lng|gps_lat|gps_lon)\b" app supabase docs` - found expected contract examples plus old `gps_lat`/`gps_lon` in remote schema capture and the follow-up migration that backfills and drops them.
- `rg -n "stale-info-scan|stale-info-scan-latest|Stale Information Scan|Checking stale-information" docs .claude AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md .planning\PROJECT.md` - confirmed stale-scan references are wired into active harness docs and commands.
- `Get-Content .claude\settings.json -Raw | ConvertFrom-Json` - settings JSON parsed successfully.
- `.claude/settings.json` stale-scan Stop hook command - produced the expected reminder while the scan artifact was missing.
- `git diff --check -- ...` - passed for touched tracked files; Git reported only line-ending normalization warnings.
- `Select-String ... -Pattern '[ \t]+$'` - no trailing whitespace found in touched files.

## BLOCKING STALE INFO

- None found in this scan.

## UPDATE REQUIRED

- `.claude/codex-prompt-latest.md` does not yet reflect the current `.claude/review-queue.txt`, which now includes the stale-scan harness changes. Deferred to Claude before the next Codex review, because the prompt should be generated after the current edit batch is settled. Required action: run `/codex-prompt` before asking Codex for the next review.

## WATCH

- `.planning/ROADMAP.md` still contains multiple `Plans: TBD` placeholders. These may be normal for future phases, but they should be revisited before closing a related milestone.
- `.planning/research/ARCHITECTURE.md` contains historical Gemini references in research notes. They are not in the active harness, but should be rewritten if those notes become active implementation guidance.
- `.claude/skills/SKILL.md` and `.claude/skills/pitfall_scan.md` contain `file:///` links to local project paths. These may work locally, but they are less portable than project-relative paths.
- `.planning/research/PITFALLS.md` notes Mapbox v10 deprecation and Supabase/Supavisor drift risks. These remain useful but should be checked against official docs before dependency or deployment decisions.

## CURRENT

- Active agent docs now point to Claude as orchestrator, Antigravity as architectural reviewer, and Codex as implementation/security reviewer.
- Active harness docs no longer contain stale Gemini workflow instructions except intentional scan terms.
- `/stale-info-scan` exists and defines the scan procedure, severities, standard commands, and report template.
- `/codex-prompt` and `/antigravity-review` include `docs/stale-info-scan.md` and include `.planning/stale-info-scan-latest.md` when present.
- `docs/agent-harness.md`, `CLAUDE.md`, `AGENTS.md`, `AGENTS_ROSTER.md`, `CODEX.md`, `ANTIGRAVITY.md`, and `.planning/PROJECT.md` require stale-scan handling at the correct gates.
- `.claude/settings.json` has a Stop hook that reminds Claude when `.planning/stale-info-scan-latest.md` is missing or older than 30 days.
- `.claude/commands/metaswarm-setup.md` was updated from Codex/Gemini language to Codex/Antigravity language.

## Blocked Checks

- Live Supabase schema drift was not checked because this scan did not request network or credentialed Supabase access.
- External official documentation freshness was not rechecked because this change only created local project controls; future dependency, SDK, agent-tool, or release decisions should verify official sources.
- App lint, typecheck, and tests were not run because this scan changed documentation, Claude command files, and settings only.
