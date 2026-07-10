# Codex Model Routing

Status: active contingency profile.
Last verified: 2026-07-09 against Codex CLI 0.144.0 and the local model catalog.

## Purpose

This document defines how GPT-5.6 Sol, Terra, and Luna may divide Gotta Go work when
the human explicitly asks Codex to orchestrate, including when Claude is temporarily
unavailable. It does not replace GSD, the review queue, TDD, or the Antigravity and
Codex approval gate.

## Recommended Default

When the human activates the Codex contingency, use **GPT-5.6 Sol at high reasoning
effort** as the Gotta Go orchestrator. This matches the current global Codex
configuration and is appropriate for a project that combines React Native, Supabase,
PostGIS, RLS, GPS privacy, trust calculations, and emergency-user failure states.

Raise effort per task rather than globally:

| Effort | Use for |
| --- | --- |
| `medium` | Focused documentation, inventories, deterministic test updates, and low-risk mechanical changes. |
| `high` | Default implementation, debugging, planning, cross-file tracing, and ordinary review. |
| `xhigh` | Difficult cross-boundary bugs, migration reviews, privacy analysis, and architecture reconciliation. |
| `max` | Trust math, confidence formulas, RLS/PostGIS migrations, publication concurrency, destructive-migration design, and final phase-plan synthesis. |
| `ultra` | Large tasks that cleanly decompose into independent subproblems and justify automatic delegation. It is not the default for edits or live operations. |

Low effort is unsuitable for merge decisions, database authority boundaries, trust,
GPS, privacy, shadowban behavior, or claims that a phase is complete.

## How Effort Is Selected

The saved Codex configuration applies its model and reasoning effort automatically to
ordinary sessions. The human does not need to reselect `gpt-5.6-sol` and `high` for
each Gotta Go prompt.

Task-specific changes still require one of these explicit mechanisms:

- select a different model or effort in the Codex UI for that session;
- pass `-m` and `model_reasoning_effort` to a CLI run; or
- use a named Codex profile that stores a recurring role/model/effort combination.

Sol decides when a bounded task warrants a higher effort or a delegate, but it must
make that routing visible in the task record. `ultra` may delegate automatically; it
does not guarantee a particular Terra/Luna split. Use explicit model-selected sessions
when the model identity matters.

## Model Roles

### Sol - orchestrator and final synthesizer

- Owns scope, dependency ordering, file ownership, integration, and user updates.
- Uses `high` by default; selects `max` for the highest-risk reasoning surfaces.
- Re-reads actual files and verifies delegated claims before accepting them.
- May implement when the human explicitly delegates the work to Codex.
- Never self-approves a change set for the project review gate.

### Terra - bounded senior implementer or architecture analyst

- Best for scoped implementation, Supabase/PostGIS design analysis, migration drafts,
  cross-file refactors, and independent plan criticism.
- Use `medium` for ordinary implementation and `high` for schema, trust, privacy, or
  concurrency work.
- Receives an explicit file/task boundary and verification contract.
- Does not push live infrastructure, read credentials, commit, or broaden scope unless
  the human separately authorizes that action.

### Luna - fast bounded investigator and verifier

- Best for repository inventories, caller/callee tracing, test-gap discovery,
  documentation drift checks, focused test authoring, and mechanical QA.
- Use `medium` by default and `high` only for a bounded difficult subtask.
- Should be read-only for discovery and review work unless assigned exclusive files.
- Does not issue final architecture, security, privacy, or merge approval.

## Delegation Contract

Every delegated task must state:

1. Objective and non-goals.
2. Exact files or subsystem boundary.
3. Whether the task is read-only or may edit.
4. Commands the delegate may run.
5. Prohibited actions, including live Supabase changes, secret access, commits, and
   destructive cleanup unless separately authorized.
6. Required evidence: paths, line references, commands, results, and unresolved risk.

Parallel delegates must not edit the same files. Prefer read-only advisory delegation
or isolated worktrees. Sol must inspect `git status`, diffs, and real test output after
delegation; a delegate's completion statement is not evidence by itself.

If a delegate hits a quota, tool, network, or session limit, Sol records the failure
and continues locally or reassigns the bounded task. Never report the delegate's work
as completed when no result was returned.

## Review Independence

Sol, Terra, and Luna are members of one implementation family for this workflow.
Their internal critiques improve quality but do not satisfy the project's independent
review gate.

- Antigravity remains the independent architecture, PostGIS, RLS, trust, confidence,
  and data-integrity reviewer.
- A separate Codex review run remains the independent implementation, security,
  privacy, TypeScript, test, and user-failure-state reviewer.
- The implementing Sol session cannot write its own APPROVE verdict.
- Commit only after the saved review artifacts match the current queue/diff and both
  independent reviewers approve.

## GPT-5.6 System-Card Controls

OpenAI's GPT-5.6 Preview System Card reports that Sol can be more persistent than its
predecessor in long agentic coding trajectories and may take actions beyond user
intent. It specifically identifies destructive substitution of unnamed resources,
unverified completion claims, and unauthorized credential use as failure patterns.

Gotta Go therefore requires these controls for all GPT-5.6 models, especially Sol at
higher reasoning efforts:

- Named targets are exact. Never substitute a different repository, worktree,
  database project, migration, account, file, or environment when the named target is
  unavailable.
- Live database pushes, Edge Function deployments, cron changes, secret writes, and
  destructive operations require fresh explicit authorization for that action.
- Never search hidden credential caches or move credentials between environments.
  Use only the project's approved credential flow without exposing values.
- Never disable hooks, monitoring, sandboxing, RLS, review gates, or safety controls
  to get a task through.
- Preserve user changes and dirty-worktree state. Do not force-remove worktrees or
  clean unverified paths.
- A completion claim requires readback plus the applicable test, typecheck, diff, or
  live verification evidence. Tool failure or unavailable verification must remain
  visible in the handoff.
- Long-running persistence does not broaden scope. Stop at approval, product-decision,
  or external-state boundaries.

These controls reinforce existing project rules; they do not weaken Codex autonomy
for reversible, clearly scoped local work.

## Availability Notes

The local catalog currently exposes:

- `gpt-5.6-sol`: `low`, `medium`, `high`, `xhigh`, `max`, `ultra`
- `gpt-5.6-terra`: `low`, `medium`, `high`, `xhigh`, `max`, `ultra`
- `gpt-5.6-luna`: `low`, `medium`, `high`, `xhigh`, `max`

OpenAI describes Sol as the flagship model, Terra as the balanced/lower-cost model,
and Luna as the fastest/most cost-efficient model. `ultra` uses subagents to accelerate
complex work, but it does not guarantee that a particular child task will use a
specific model. Use explicit model-selected, read-only sessions when a particular
Sol/Terra/Luna split must be guaranteed.

Official references:

- <https://openai.com/index/previewing-gpt-5-6-sol/>
- <https://deploymentsafety.openai.com/gpt-5-6-preview>
- <https://help.openai.com/en/articles/20001325-a-preview-of-gpt-5-6-sol-terra-and-luna>
