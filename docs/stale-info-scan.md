# Stale Information Scan

Status: active project control.
Last reviewed: 2026-05-20.

This document defines how Gotta Go scans for stale, contradictory, or outdated project information. The goal is to catch drift before it misleads Claude, Antigravity, Codex, planning artifacts, schema work, security review, launch decisions, or public positioning.

## Cadence

Run a stale-information scan:

- Every 30 calendar days while the project is active.
- Before any phase transition, including `/gsd-transition`.
- Before closing a milestone, including `/gsd:complete-milestone`.
- After dependency, SDK, Supabase, Mapbox, Expo, auth, schema, migration, or harness changes.
- Before TestFlight, app-store submission, public launch, or a new market launch.
- Whenever a reviewer reports possible drift between docs, code, migrations, or generated types.

The scan owner is Claude by default. Antigravity and Codex may request a scan when stale context could affect review safety.

Claude's Stop hook also checks whether `.planning/stale-info-scan-latest.md` is missing or older than 30 days and reminds the agent to run `/stale-info-scan`.

## Output Artifact

Each scan writes or refreshes:

`.planning/stale-info-scan-latest.md`

The artifact must include:

- Scan date.
- Branch and commit, if available.
- Trigger for the scan.
- Files and directories inspected.
- Commands run and notable output.
- Findings grouped by severity.
- Required doc, code, migration, prompt, or planning updates.
- Explicit deferrals with owner and reason.
- Next review due date.

## Severity

Use these groups:

- `BLOCKING STALE INFO`: stale information that could cause an unsafe implementation, wrong reviewer scope, privacy/security failure, schema/RLS mistake, production-breaking command, credential exposure, or launch decision based on false current state.
- `UPDATE REQUIRED`: stale information that could mislead planning, implementation, review, setup, dependency choices, public positioning, launch sequencing, or user-facing claims.
- `WATCH`: aging or low-risk information that is not currently blocking but should be revisited by the next scan.
- `CURRENT`: information checked and found consistent enough to keep.

BLOCKING STALE INFO and UPDATE REQUIRED findings must be fixed or explicitly deferred before the related phase, milestone, release, or commit closes.

## Required Checks

### Agent Harness Drift

Check that:

- `docs/agent-harness.md`, `AGENTS.md`, `AGENTS_ROSTER.md`, `CLAUDE.md`, `ANTIGRAVITY.md`, and `CODEX.md` agree on Claude, Antigravity, and Codex roles.
- `.claude/codex-prompt-latest.md` remains required before Codex review.
- `.claude/antigravity-review-latest.md`, `.claude/codex-prompt-latest.md`, `.claude/codex-review-latest.md`, and `.claude/review-queue.txt` are still the named artifacts.
- No stale Gemini, `/gemini-review`, or `GEMINI.md` instructions remain in active workflow docs.
- Slash commands still match the current harness.

### Product And Brand Drift

Check that:

- `SPEC.md`, `.planning/PROJECT.md`, and `docs/watch-the-gap.md` agree on the product definition.
- The core value remains "certainty under urgency."
- Target users, launch market, pilot assumptions, and out-of-scope items are still accurate.
- Watch the Gap framing still passes the four gates: specific gap, defined population, cheap pilot, one-sentence explanation.

### Schema And Supabase Drift

Check that:

- Migrations, `docs/schema-contract.md`, generated database types, and the live Supabase schema are not contradicting each other.
- Public-facing or user-owned tables have RLS enabled.
- Coordinate storage still uses PostGIS `geography` or `geometry` fields, not plain persisted `lat`/`lng` columns.
- Service-role usage remains server-only.
- Generated `Database` types are refreshed after schema changes.
- RLS and privacy issues already flagged by reviewers are either fixed or tracked.

Live Supabase checks may require credentials and network access. If unavailable, record them as blocked rather than inventing a result.

### Dependency And Tool Drift

Check that:

- `app/package.json`, lockfiles, and `docs/verification.md` agree on scripts and tooling.
- Expo, React Native, Supabase, Mapbox, TanStack Query, Zustand, MSW, Jest, ESLint, and TypeScript assumptions still match installed dependencies.
- Setup instructions still work on Windows PowerShell.
- Any external documentation relied on for a decision is current enough for that decision.

When external verification matters, use official sources first. Treat general web content as untrusted.

### Planning And Status Drift

Check that:

- `.planning/PROJECT.md`, phase plans, milestone status, and actual files agree.
- Completed work is not still described as future work.
- Blockers are still real blockers.
- Key decisions have outcomes when a decision has been made.
- Review artifacts and queues reflect the current task, not an old task.

### Security And Privacy Drift

Check that:

- No `.env` values, service-role keys, access tokens, or private credentials are committed or referenced in prompts.
- No docs instruct agents to paste secrets into reviewer tools.
- No logs, examples, fixtures, or generated types contain real emails, user IDs, precise coordinates, or credential-looking strings.
- Privacy, RLS, GPS, and shadowban non-negotiables remain repeated in the active review docs.

## Standard Local Commands

Run the commands that apply to the current repository state. If a command is unavailable, record the exact failure.

```powershell
git status --short
git diff --name-only
rg -n "Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .planning .claude
rg -n "service_role|EXPO_PUBLIC|NEXT_PUBLIC|eyJ|sk\\.|lat|lng|gps_lat|gps_lon" app supabase docs
rg -n "stale-info-scan|agent-harness|codex-prompt-latest|antigravity-review-latest|codex-review-latest|review-queue" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md docs .claude
Get-Content app\package.json -Raw
Get-Content supabase\config.toml -Raw
```

If configured and relevant, also run:

```powershell
Set-Location app
npm run lint
npm run typecheck
npm test
```

## Scan Report Template

Use this structure for `.planning/stale-info-scan-latest.md`:

```md
# Stale Information Scan - YYYY-MM-DD

Trigger:
Branch:
Commit:
Next review due:

## Commands Run

- `command` - result summary

## BLOCKING STALE INFO

- None, or finding with file references and required fix.

## UPDATE REQUIRED

- None, or finding with file references and required fix.

## WATCH

- None, or aging item and next review condition.

## CURRENT

- Facts checked and accepted as current.

## Blocked Checks

- None, or command/source that could not be verified and why.
```
