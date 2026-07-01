# Agent Harness

Status: active project contract.
Last reviewed: 2026-05-20.

This document defines how Claude, Antigravity, and Codex work together on Gotta Go. It is the harness contract: role boundaries, handoff artifacts, review gates, permissions posture, and failure handling.

## Research Basis

The harness follows current primary-source guidance from agentic coding platforms:

- OpenAI Codex can read project instructions from `AGENTS.md`, review code through the Codex app review pane, and use repository rules to control commands outside the sandbox. Codex review quality depends on clear prompts, constraints, exact file citations, and reviewable outputs. See:
  - https://developers.openai.com/codex/guides/agents-md
  - https://developers.openai.com/codex/app/review
  - https://developers.openai.com/codex/rules
- OpenAI recommends explicit orchestration decisions for specialist agents, including handoffs, guardrails, human review, and traces/evaluation loops. See:
  - https://developers.openai.com/api/docs/guides/agents
  - https://openai.github.io/openai-agents-python/handoffs/
  - https://openai.github.io/openai-agents-python/guardrails/
  - https://openai.github.io/openai-agents-python/tracing/
- Codex internet access should stay limited because external content can introduce prompt injection, exfiltration, malware, vulnerable dependencies, or license risk. See:
  - https://developers.openai.com/codex/cloud/internet-access
- Claude Code project instructions belong in version-controlled project memory, and specialized work should be routed through focused subagents/skills/commands with explicit tool limits and clear descriptions. Hooks can enforce or observe workflow events, but hook scripts must be treated as executable code and kept conservative. See:
  - https://code.claude.com/docs/en/memory
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/slash-commands
  - https://code.claude.com/docs/en/hooks
- Antigravity is strongest when used with planning mode, review policies, implementation artifacts, walkthroughs, diffs, and user feedback loops. Its browser and terminal autonomy should be permissioned deliberately. See:
  - https://developers.google.com/antigravity/guides/agents-md
  - https://developers.google.com/antigravity/rules
  - https://developers.google.com/antigravity/cli/review

## Harness Principles

1. Claude is the orchestrator and default implementer.
   Claude owns GSD workflow execution, TDD, file edits, verification commands, reviewer invocation, fixing findings, and final commit preparation.

2. Antigravity and Codex are independent reviewers.
   Antigravity owns architecture, PostGIS, RLS placement, trust math, confidence decay, aggregate correctness, and system-level data integrity. Codex owns implementation quality, security/privacy, TypeScript correctness, test quality, user-visible failure states, and practical production risk.

3. Review is artifact-driven.
   No reviewer approves from intent alone. Every review must have a concrete artifact bundle: scope, context, changed files, exact file contents or diff, verification evidence, and requested output format.

4. Handoffs are explicit.
   Claude must state what is being handed off, which files are in scope, what verdict is requested, and what evidence the reviewer should inspect. Reviewers must not silently expand into unrelated changes unless they uncover a security, privacy, data-integrity, or production-breaking risk.

5. Guardrails beat speed.
   Any BLOCK verdict stops the line. Any REQUEST CHANGES verdict requires a fix and re-review. Conflicts between Antigravity and Codex are resolved by documenting the conflict and taking the stricter interpretation for security, privacy, RLS, GPS integrity, and data-loss concerns.

6. Permissions stay narrow.
   Agents should run with the least authority needed. Avoid unrestricted internet, destructive shell commands, broad filesystem writes, and hidden credential access. Browser/network access is allowed only when the task needs it and the source is trusted.

7. Verification is part of the artifact.
   A review is incomplete without the commands run, results observed, and commands not run with reasons. Test, typecheck, lint, build, Supabase, and browser verification should be run when configured and relevant.

8. Reviewer independence is preserved.
   Claude cannot self-approve. Antigravity and Codex do not approve changes they did not inspect. Codex must read `.claude/codex-prompt-latest.md` before returning a Codex review. Antigravity must read `.claude/antigravity-prompt-latest.md` before returning an Antigravity review.

## Required Review Artifacts

Claude maintains these artifacts during every non-trivial task:

- `.claude/review-queue.txt`: newline-delimited files written or edited by Claude. This is the queue for reviewer scope.
- `.claude/antigravity-prompt-latest.md`: the full Antigravity review packet (scope, context, prior results, focus, output format). Antigravity reads this file before reviewing.
- `.claude/antigravity-review-latest.md`: the latest Antigravity verdict and findings, saved after Antigravity returns a review.
- `.claude/codex-prompt-latest.md`: the full Codex review packet (scope, context, prior results, focus, output format). Codex reads this file before reviewing.
- `.claude/codex-review-latest.md`: the latest Codex verdict and findings, saved after Codex returns a review.
- `.planning/stale-info-scan-latest.md`: the latest stale-information scan report, generated by `/stale-info-scan`.

These files are coordination artifacts. They do not replace inspecting the actual files from disk.

## Periodic Stale-Information Scans

Claude must run `/stale-info-scan` on the cadence defined in `docs/stale-info-scan.md`: every 30 days while active, before phase transitions, before milestone close, after dependency/tool/schema/harness changes, and before release or new-market launch.

The scan is a project-control artifact, not a substitute for review. BLOCKING STALE INFO and UPDATE REQUIRED findings must be fixed or explicitly deferred before the related phase, milestone, release, or commit closes. Antigravity and Codex may request a scan when stale context could affect review safety.

## Standard Flow

1. Claude reads startup context.
   Required reading list is canonical in `AGENTS_ROSTER.md` § "Required Reading — Load Before Any Work" — read it there, not duplicated here.

2. Claude implements through GSD.
   Use `/gsd-quick`, `/gsd-debug`, or `/gsd-execute-phase` unless the human explicitly bypasses GSD. All non-trivial behavior uses TDD when practical.

3. Claude verifies locally.
   Run configured checks before reviewer handoff. If a check cannot run, record the exact blocker.

4. Claude invokes Antigravity.
   Run `/antigravity-review` first. Claude writes the review packet to `.claude/antigravity-prompt-latest.md` (scope, context, changed files, prior results, verification notes, output format). Antigravity reads this file, inspects files on disk, and returns a verdict. Save the result to `.claude/antigravity-review-latest.md`.

5. Claude generates the Codex packet.
   Run `/codex-prompt` after Antigravity. The prompt must include context, changed files, Antigravity result or summary, verification evidence, and requested Codex output format.

6. Codex reviews independently.
   Codex reads `.claude/codex-prompt-latest.md`, inspects actual files from disk, runs practical verification, and returns a verdict. Copy the returned verdict to `.claude/codex-review-latest.md` when available.

7. Claude resolves findings.
   BLOCK and REQUEST CHANGES items are fixed before commit. Affected files re-enter the queue and both relevant reviewers re-review them.

8. Claude commits only after both reviewers approve.
   The commit message must summarize verification and reviewer verdicts. Clear `.claude/review-queue.txt` only after commit.

## Scope Rules

- Small docs-only changes may use `/gsd-quick`, but still require reviewer approval if they alter security, schema, workflow, review gates, product scope, or launch constraints.
- Schema, RLS, GPS verification, trust/confidence, shadowban, privacy, auth, and service-role handling always require both Antigravity and Codex review.
- Frontend-only UI changes still require Codex review when they affect location permission, map behavior, error states, user identity, privacy, or Supabase calls.
- Reviewer prompts should include exact files and line numbers where practical. Do not ask reviewers to infer scope from chat history.

## Prompt Packet Requirements

Every reviewer packet must include:

- Task goal and phase.
- Changed files from `.claude/review-queue.txt`.
- Relevant project context and constraints.
- Actual file contents or an explicit diff.
- Verification commands already run and their outcomes.
- Known caveats, failed commands, or missing tooling.
- Required output format and verdict definitions.

Do not include secrets, service-role keys, auth tokens, private `.env` values, or precise user location data in reviewer prompts.

## Permission Posture

Claude hooks and commands should prefer:

- Read-only inspection before writes.
- Explicit approval for destructive or external actions.
- Project-relative paths.
- Narrow command allowlists.
- No broad network access unless needed for current-source research or dependency installation.

Antigravity should use review-driven settings for this project: planning artifacts and code diffs should be reviewed by the human or Claude before proceeding with risky changes.

Codex should treat external web content as untrusted unless it is official documentation needed for the task. For OpenAI product behavior, use official OpenAI documentation. For Claude Code behavior, use official Claude Code documentation. For Antigravity behavior, use official Google/Antigravity documentation.

## Failure Handling

- Missing reviewer prompt: stop and generate the missing artifact.
- Missing reviewer tool: provide the exact manual prompt and do not claim review completed.
- Failed verification: report the command and failure; do not approve or commit.
- Conflicting reviewer findings: document the conflict, choose the stricter safety interpretation, and ask for human review when both paths have meaningful tradeoffs.
- Scope drift: stop and update the task, plan, or review queue before continuing.

## Minimum Commit Gate

A commit is allowed only when all are true:

- `.claude/review-queue.txt` contains the files actually changed for the task.
- Local verification has been run or explicitly reported as blocked.
- Stale-information scan findings that affect the current task have been resolved or explicitly deferred.
- Antigravity verdict is APPROVE for architecture/data-integrity concerns.
- Codex verdict is APPROVE for implementation/security/test-quality concerns.
- Any reviewer conflicts have been documented and resolved.
- The commit message records reviewer verdicts and verification.

## Superpowers Skill Discipline (Claude Code)

Every session, every task. No exceptions. Invoke the Skill tool BEFORE taking action — not after.

| Trigger | Required Skill |
|---|---|
| Session start / resuming project | `superpowers:using-superpowers` (auto-loaded by hook, but invoke explicitly if starting a task immediately) |
| Any build failure, test failure, unexpected behavior | `superpowers:systematic-debugging` — invoke BEFORE investigating |
| Implementing any feature, fix, or config change | `superpowers:test-driven-development` — invoke BEFORE writing code |
| Before finishing any task or declaring it done | `superpowers:verification-before-completion` |
| After each task in a plan, before moving to the next | `superpowers:requesting-code-review` |
| Running any code review gate | `superpowers:requesting-code-review` — then immediately run `/review-gate` (chains GSD → Antigravity → Codex automatically) |
| Working on parallel tasks with subagents | `superpowers:dispatching-parallel-agents` |
| Following or executing a written plan | `superpowers:executing-plans` |

**Red flags that mean you skipped a skill:**
- "This is a simple fix" → still invoke `superpowers:test-driven-development`
- "I already know how to debug this" → still invoke `superpowers:systematic-debugging`
- "The task is done" → still invoke `superpowers:verification-before-completion`
- "I'll review at the end" → invoke `superpowers:requesting-code-review` after EACH task

## TDD Guard — Scope & Enforcement

TDD Guard runs as a pre-commit hook via `npx tdd-guard@latest` (resolves to v1.6.9+). Never bypass it without explicit user approval and a recorded reason (see CLAUDE.md's non-negotiables).

### Scope Table

| Path | TDD Guard | Reason |
|------|-----------|--------|
| `app/src/**` | ON — required | All source code must have tests |
| `app/__tests__/**` | ON — required | Tests must be valid |
| `app/src/lib/__tests__/**` | ON — required | Integration tests |
| `app/android/` | OFF | Generated by Expo — never edit manually |
| `app/assets/` | OFF | Non-behavioral (images, fonts) |
| `.planning/` | OFF | Planning docs, not code |
| `app/jest.config.js` | OFF | Test runner config |
| `app/tsconfig.json` | OFF | Compiler config |
| `app/eas.json` | OFF | EAS build config |
| `app/app.config.ts` | OFF | Expo app config |
| `supabase/migrations/**` | OFF | Raw SQL — reviewed by Antigravity instead |
| `*.md` | OFF | Documentation |

### Enforcement Rules

1. **EVERY new `src/` file gets a test file before implementation begins** — TDD order: test → fail → implement → pass.
2. **Coverage threshold:** 100% lines/branches/functions/statements for all `src/` code (enforced by `.coverage-thresholds.json` if Metaswarm creates it, or manually via `npm run test:coverage` from `app/`).
3. **Test command:** `cd app && npm test`
4. **Coverage command:** `cd app && npm run test:coverage`
5. **Hook bypass (`--no-verify`) is FORBIDDEN** without explicit user approval and a recorded reason.
6. **jest@29.7.0 is PINNED** — do not upgrade for any reason until `jest-expo@56` explicitly supports jest@30. Upgrading will break the test suite.

### TDD Guard Jest Integration — BLOCKED

`tdd-guard-jest@0.1.4` requires `jest@>=30.0.5`. Project uses jest@29.7.0. Cannot install until jest-expo@56.

**Current mode:** Hook-only (AI-assisted pattern validation). TDD discipline is enforced by these rules + the Superpowers TDD skill above, not the jest reporter. The guard's own chat-command toggle (`tdd-guard on` / `tdd-guard off`, exact-match on the full prompt text) can be used to temporarily disable it for a specific work unit when this blocked state creates a false-positive gate — always re-enable after that work unit commits.

**Custom instructions file** (create when BEADS is installed): `.claude/tdd-guard/data/instructions.md`
Include rules for:
- GPS distance tests: all `verification_events` writes must test `distance_from_location_meters` boundary (< 100m threshold)
- Trust score delta tests: all `trust_events` writes must assert `delta` sign matches `action_type`
- PostGIS geometry tests: never test raw lat/lon — always test through the geometry column
- RLS tests: any new table or policy change requires a test that asserts unauthorized access returns 0 rows
