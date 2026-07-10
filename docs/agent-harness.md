# Agent Harness

Status: active project contract.
Last reviewed: 2026-07-04.

This document defines how Claude, Antigravity, Codex, and GSD coordinate on Gotta Go. It focuses on handoff artifacts, review gates, permissions, and failure handling. Context selection is defined in `docs/context-router.md`.

## Harness Principles

1. Claude is the orchestrator and default implementer.
   Claude owns GSD workflow execution, file edits, TDD discipline, local verification, packet generation, and finding resolution.

2. Antigravity and Codex are independent reviewers.
   Antigravity owns architecture, PostGIS, RLS placement, trust math, confidence decay, aggregate correctness, and system data integrity. Codex owns implementation quality, security/privacy, TypeScript correctness, test quality, user-visible failure states, and practical production risk.

3. Review is artifact-driven.
   No reviewer approves from intent alone. A review packet must define scope, queued files, diffs, verification evidence, runtime boundaries, mock boundaries, and required verdict format.

4. Context is routed, not dumped.
   Agents must use `docs/context-router.md` before loading large source documents. Full source docs belong in packets only when the whole document is directly relevant.

5. Handoffs are explicit.
   A packet must name files, callers, callees, providers, route guards, hooks, RPCs, policies, migrations, scheduled jobs, tests, and mocks that can affect the changed behavior.

6. Guardrails beat speed.
   BLOCK stops the line. REQUEST CHANGES requires a fix and re-review. Security, privacy, RLS, GPS integrity, and data-loss conflicts default to the stricter interpretation.

7. Reviewer independence is preserved.
   The implementing orchestrator cannot self-approve. Antigravity and a separate Codex review run inspect actual files from disk and cite exact `file:line` evidence.

8. Codex orchestration is an explicit contingency.
   When the human explicitly assigns orchestration to Codex, including during a Claude availability or rate-limit interruption, GPT-5.6 Sol may temporarily own GSD-compatible planning, scoped implementation, verification, packet preparation, and finding resolution. Terra and Luna may receive bounded delegated tasks under `docs/codex-model-routing.md`. This does not let the implementing Sol session self-approve or replace Antigravity and the separate Codex review run.

## Current Reviewer Execution Model

Claude does not invoke reviewer CLIs by default.

- Claude writes `.claude/antigravity-prompt-latest.md`; the user runs `agy` or `antigravity` and saves `.claude/antigravity-review-latest.md`.
- Claude writes `.claude/codex-prompt-latest.md`; the user runs `codex exec` and saves `.claude/codex-review-latest.md`.

If the user explicitly asks Claude to invoke a reviewer CLI, use a short prompt pointing at the packet file. Never inline packet contents into a CLI command.

## Required Review Artifacts

- `.claude/review-queue.txt`: newline-delimited repo-relative paths changed for the current task.
- `.claude/antigravity-prompt-latest.md`: Antigravity packet.
- `.claude/antigravity-review-latest.md`: latest saved Antigravity verdict.
- `.claude/codex-prompt-latest.md`: Codex packet.
- `.claude/codex-review-latest.md`: latest saved Codex verdict.
- `.planning/stale-info-scan-latest.md`: latest stale-information scan report.

Artifacts do not replace inspecting actual files from disk.

## Standard Flow

1. Claude loads startup context through `docs/context-router.md`.
2. Claude works through GSD unless the user explicitly bypasses it.
3. Claude verifies locally and records commands, results, and blockers.
4. Claude ensures `.claude/review-queue.txt` matches current changed files.
5. Claude stages the exact queue, inspects the staged diff, and computes the staged `scope_hash`.
6. Claude runs `/antigravity-review` to generate the Antigravity packet.
7. User runs Antigravity and saves the verdict artifact with the same `scope_hash`.
8. Claude runs `/codex-prompt` to generate the Codex packet.
9. User runs Codex and saves the verdict artifact with the same `scope_hash`.
10. Claude resolves all BLOCK and REQUEST CHANGES findings.
11. Affected files re-enter the queue; changed bytes are re-staged, re-fingerprinted, and reviewers re-review.
12. Commit only after both reviewers APPROVE and relevant stale-info findings are resolved or explicitly deferred.

## Scope Rules

- Small docs-only changes may use `/gsd-quick`, but still require reviewer approval if they alter security, schema, workflow, review gates, product scope, launch constraints, or agent instructions.
- Schema, RLS, GPS verification, trust/confidence, shadowban, privacy, auth, and service-role handling always require both reviewers.
- Frontend-only changes require Codex review when they affect location permission, map behavior, error states, user identity, privacy, Supabase calls, or emergency-user availability.
- Reviewer prompts must name exact files and dependency boundaries. Do not ask reviewers to infer scope from chat history.

## Prompt Packet Requirements

Every packet includes:

- Task goal and phase.
- Current `.claude/review-queue.txt` entries.
- Deterministic `scope_hash` computed from the staged queue bytes.
- Git status and diff for queued files.
- Full queued file contents or an explicit diff.
- Relevant context selected by `docs/context-router.md`.
- Runtime-boundary context.
- Mock-boundary context.
- Verification commands already run and outcomes.
- Known caveats, failed commands, or missing tooling.
- Required verdict format and severity definitions.

Use context tiers:

- Tier 0: always include queue, diff, verification, role summary, verdict format, and runtime/mock audit instructions.
- Tier 1: include boundary-specific excerpts from product, schema, harness, stale-info, CODEX, or ANTIGRAVITY docs.
- Tier 2: include full source docs only when the doc itself is in scope or an excerpt would be misleading.

Never include secrets, service-role keys, auth tokens, private `.env` values, or precise user location data in packets.

## Runtime Boundary And Mock Audit

Every non-trivial packet must include this section. It must state:

- Nearest callers and callees.
- Providers, layouts, route guards, hooks, external callbacks, and scheduled jobs.
- RPCs, migrations, policies, triggers, materialized views, and Supabase permissions.
- Tests that mock any of the above.
- Whether mocks could hide production behavior.

Auth, routing, GPS, Supabase writes, RLS-sensitive reads, trust/shadowban logic, async UI flows, and emergency-mode screens require explicit event-ordering and failure-path review.

## Stale-Information Scans

Run `/stale-info-scan` on the cadence in `docs/stale-info-scan.md`: every 30 days while active, before phase transitions, before milestone close, after dependency/tool/schema/harness changes, and before release or new-market launch.

BLOCKING STALE INFO and UPDATE REQUIRED findings that affect the current task must be fixed or explicitly deferred before the related task, phase, milestone, release, or commit closes.

## Permission Posture

- Prefer read-only inspection before writes.
- Use project-relative paths.
- Request approval for destructive or external actions.
- Keep browser/network access limited to trusted, task-relevant sources.
- Treat hook scripts as executable code; keep them conservative and fail-readable.

## Failure Handling

- Missing review queue: stop and build the queue.
- Empty queue: report that there is nothing to review.
- Missing prompt: generate the prompt before asking a reviewer to act.
- Missing reviewer tool: give the exact manual CLI command or prompt; do not claim review completed.
- Stale reviewer verdict or staged-scope hash mismatch: regenerate both packets and request both reviews again.
- Failed verification: report the command and failure; do not approve or commit.
- Conflicting reviewer findings: document both sides and choose the stricter safety interpretation unless the user decides otherwise.
- Scope drift: stop and update the task, queue, or packet before continuing.

## Minimum Commit Gate

A commit is allowed only when all are true:

- `.claude/review-queue.txt` contains the files changed for the task.
- Local verification has run or exact blockers are documented.
- Relevant stale-info findings are resolved or explicitly deferred.
- `.claude/antigravity-review-latest.md` is APPROVE for the current packet scope.
- `.claude/codex-review-latest.md` is APPROVE for the current packet scope.
- Prompt packets include a `review-manifest` and current staged `scope_hash`; both verdicts repeat that hash and mention every staged queued file.
- Reviewer conflicts are documented and resolved.
- The commit message records verification and reviewer verdicts.

## Superpowers And TDD

Use relevant Superpowers skills before action. For app source behavior, TDD order is test -> fail -> implement -> pass. TDD Guard applies to `app/src/**` source work. Do not bypass hooks without explicit user approval and a recorded reason.
