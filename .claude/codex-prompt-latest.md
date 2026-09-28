<!-- review-manifest
reviewer: codex
generated_at: 2026-09-28T17:07:47Z
scope_hash: sha256:e1664171afde3768d2cd723c2c12ebdf051c1fa3ed1a3f5d46ee810d01de20b0
review_id: rv-20260928T170747Z-3db6d0a9
risk_level: medium
runtime_required: false
blind_review: true
queue:
  - CLAUDE.md
  - AGENTS_ROSTER.md
  - docs/agent-harness.md
  - docs/context-router.md
  - .claude/commands/brainstorm.md
  - .claude/commands/metaswarm-setup.md
  - .claude/commands/metaswarm-update-version.md
  - .claude/commands/pr-shepherd.md
  - .claude/commands/prime.md
  - .claude/commands/review-design.md
  - .claude/commands/self-reflect.md
  - .claude/commands/start-task.md
  - .claude/commands/start.md
  - .metaswarm/external-tools.yaml
  - .metaswarm/project-profile.json
  - .claude/commands/review-gate.md
  - docs/verification.md
  - docs/stale-info-scan.md
  - .claude/skills/SKILL.md
diff_base: HEAD
context_tier: 1
-->

# Codex Review Packet: Tooling Consolidation, Attempt 7 (metaswarm removal, GSD routing, review-gate pre-check, formatter status)

You are Codex, the approval-bearing implementation-quality, security, and user-failure-state reviewer. This packet is a set of claims, not proof. Inspect every queued path from disk and confirm the staged scope matches `scope_hash`. Allowed verdicts: APPROVE, REQUEST CHANGES, BLOCK.

This is a new blind attempt on changed staged bytes. Earlier attempts covered scopes `sha256:5007656f…` (15 paths), then `sha256:6760d428…`, `sha256:f4029bcf…`, `sha256:bf0139cb…`, and `sha256:7c8ee525…` (17 paths each). Since the last attempt, two files joined the queue: `docs/stale-info-scan.md` (its scan cadence named `/gsd-transition` and `/gsd:complete-milestone`, which the `core` profile does not install; it now names the events without commands) and `.claude/skills/SKILL.md` (it named `/gsd-progress`; it now names the three installed phase commands). Earlier verdicts are archived and are not inputs to this review. Do not read them.

## Required Skills

- `.claude/skills/artifact_qa_gate.md` shared core plus its **Codex Overlay**.
- Task-relevant skills actually available in the Codex harness (for example `superpowers:using-superpowers` and `superpowers:verification-before-completion`). List only the ones you applied.
- No project domain skill is triggered (no PostGIS, RLS, trust, or app code). Name any unavailable skill as a gap.

## Task Goal

The user asked to consolidate the project's agent tooling and keep it lean: "don't lose sight of what the original project is about ... not looking to overengineer ... or have it laden with context eating token draining strategies." Metaswarm is removed from the repo. It was used for one plan (Phase 2, 02-01b); GSD plus the Antigravity/Codex review gate replaced it; its plugin is not installed. The routing docs match the lean GSD install (frozen 1.42.3, `core` profile: discuss, plan, and execute phase; no GSD code-review command).

Two files were added in this attempt:
- `.claude/commands/review-gate.md`: its first step called a GSD code-review command that the `core` profile does not include. The user chose to replace it with Claude Code's built-in `/code-review` as an internal pre-check that runs before staging and is explicitly not an approval.
- `docs/verification.md`: the deleted metaswarm profile held a `format_check` command (`cd app && npx prettier --check .`). The user chose to document formatting as not enforced. On 2026-09-28, the implementer ran `cd app && npx --no-install prettier --check .` and it reported style issues in 154 files. No CI step, package script, or active doc runs it.

## Queue (19 paths, all staged)

Deleted (11): `.claude/commands/{brainstorm,metaswarm-setup,metaswarm-update-version,pr-shepherd,prime,review-design,self-reflect,start-task,start}.md`, `.metaswarm/external-tools.yaml`, `.metaswarm/project-profile.json`.
Modified (8): `CLAUDE.md`, `AGENTS_ROSTER.md`, `docs/agent-harness.md`, `docs/context-router.md`, `.claude/commands/review-gate.md`, `docs/verification.md`, `docs/stale-info-scan.md`, `.claude/skills/SKILL.md`.

The index also holds 10 staged reviewer archive files under `.claude/reviews/` from earlier attempts (count from `git diff --cached --name-only -- .claude/reviews` when this packet was generated; each reviewer's archive step adds one more, so a count one or two higher when you check is expected). They are not queue entries, and `stagedScopeHash()` hashes queue entries only. Do not open them.

## Neutral Claim Table

| # | Implementation claim | Authority source | Disproof attempt required | Evidence needed |
|---|---|---|---|---|
| T1 | Seven deleted command files only route to a metaswarm plugin that is not installed; the other two (`metaswarm-setup`, `metaswarm-update-version`) only manage metaswarm. None carries project-specific workflow. | the deleted files at `HEAD` (`git show HEAD:<path>`) | Find project-specific instructions in any deleted file that exist nowhere else. | Read each deleted file at `HEAD`. |
| T2 | Nothing active depends on `.metaswarm/`: no script, hook, test, CI step, or active doc reads it after this change. | repository search | Find an executable or active-doc consumer of `.metaswarm/`, `project-profile.json`, or `external-tools.yaml`. | Scoped search excluding historical records (`.claude/reviews/**`, `.claude/*-review-latest.md`, `.planning/**`, `.beads/**`, `.claude/codex-security-investigation-prompt.md`). |
| T3 | No active file (docs, commands, skills, root agent files) names a GSD command absent from the `core` profile, in either `/gsd-x` or `/gsd:x` form. Installed: `gsd-discuss-phase`, `gsd-plan-phase`, `gsd-execute-phase`, `gsd-help`, `gsd-phase`, `gsd-new-project` (`ls ~/.claude/skills \| grep gsd`). Replacements name installed tools. | all active files, not only the queued ones | Find a surviving active reference, or a replacement that names a tool that is not installed. | Scoped search plus reading the diffs. |
| T4 | The edits change no review-gate rule, blind-review requirement, verdict format, protected-path list, or TDD/Probity rule. | the diffs; `check-review-artifacts.js` `REVIEW_REQUIRED_PATTERNS` (unchanged) | Find a weakened obligation in any reworded line. | Line-by-line diff reading. |
| T5 | Nothing enforced is lost with the profile. Its test, coverage, lint, and typecheck commands are in `docs/verification.md`; its 100% coverage threshold is enforced in `app/jest.config.js`; its `format_check` command is now documented as not enforced, with the reason. | `git show HEAD:.metaswarm/project-profile.json`; `docs/verification.md`; `app/jest.config.js` | Find a profile value enforced or documented only in the deleted profile. | Compare field by field. |
| T6 | Replacing the GSD code-review step with `/code-review` preserves the gate: it runs before staging, so its fixes cannot change a staged `scope_hash` after packets exist; it is labeled a self-check and not reviewer evidence; the command is identified unambiguously (the built-in `code-review`, not `engineering:code-review`) with an invocation that matches that command; its unavailability neither blocks the gate nor lets another tool stand in; Steps 4-9 (both blind packets, archives, Codex approval, the full gate after both archives) are unchanged. | `.claude/commands/review-gate.md` on disk (full file) | Show an ordering where a pre-check fix lands after packet generation, or wording that lets the pre-check stand in for a reviewer. | Read the whole file, not only the hunks. |
| T8 | `AGENTS_ROSTER.md` agrees with the current contract: its Review Cycle generates both blind packets before either reviewer runs, compares verdicts only after both archives exist, and requires Codex APPROVE plus the policy-allowed Antigravity verdict with no unresolved finding; its routing sentence names the `/code-review` pre-check. No other active document still requires two APPROVE verdicts or a sequential packet order. | `docs/agent-harness.md` (numbered workflow and probation rule); `.claude/antigravity-review-policy.json`; `.claude/commands/review-gate.md` | Find any active doc (excluding historical records) that contradicts the roster's cycle, or a roster step that weakens the gate. | Read the roster's Review Cycle in full; scoped search for approval-condition wording. |
| T7 | The formatter statement in `docs/verification.md` is accurate and internally consistent: Prettier is a dev dependency, no CI job, package script, or hook runs `prettier --check`, and a manual run currently fails. | `app/package.json`; `.github/workflows/*.yml`; the command itself | Find a CI step, script, or hook that runs Prettier, or show the check passing. | Run `cd app && npx --no-install prettier --check . \| tail -3` and search. |

## User Advocacy Gate

"Does this decision serve someone with 60 seconds before an emergency?" No app code, map, search, or submission path changes. Indirectly: a review command that points at a missing tool stalls every non-trivial fix, including emergency-critical ones; a lean startup leaves more of each session for product work. Assess whether any removed item carried an obligation that protects emergency-critical behavior, and whether the new pre-check could delay urgent fixes.

## Runtime Boundary And Mock Audit

- No runtime code, hook, test, migration, or CI change. `runtime_required: false`.
- Claude Code loads `.claude/commands/*.md` as slash commands. Deleting nine files removes them from the command list. Confirm no remaining command or skill invokes them by name.
- `/code-review` is a built-in Claude Code skill in this environment, not a repo file, so it cannot be read from disk. The implementer asserts that the session's skill list shows two distinct entries: `code-review` (built-in; "Review the current diff, or a PR number/branch/path target ... at the given effort level (low/medium ... max)") and `engineering:code-review` (a plugin skill whose SKILL.md takes a PR URL or file path). If you cannot observe the built-in from your harness, mark its behavior unverifiable rather than inferring it from the plugin skill.
- The router and command files are agent instructions; their only consumer is agent behavior.

## Verification (implementer-run, macOS 27.0, Node v26.10.0, 2026-09-28)

| Evidence | Result |
|---|---|
| `git grep` for `gsd-code-review`, `gsd:code-review`, `gsd-quick`, `gsd-debug`, `gsd-verify-work`, `metaswarm`, `project-profile.json` over active files (excluding the historical paths in T2 and `docs/verification.md`, whose new paragraph names the former profile on purpose) | no matches |
| Node test runner over the five harness test files (queue hooks, review-gate checker, isolated DB runner, OS portability, Probity config), run 2026-09-28 before attempt 2; later attempts change only Markdown | 144 tests, 139 pass, 0 fail, 5 skipped (Windows-only) |
| Built-in `/code-review low` on the six modified files before staging | attempts 2 and 3: no findings. Attempt 4: three runs. Run 1 flagged the roster routing sentence omitting the pre-check (fixed). Run 2 flagged the unused phase-number input in `review-gate.md` (removed). Run 3: no findings. Attempt 5: one run, no findings. Low-effort passes. |
| `cd app && npx --no-install prettier --check .` | style issues in 154 files |
| Staging | `stage-queue` failed while the deletions were pre-staged with `git rm`; they were unstaged (files stay deleted on disk) and `stage-queue` staged all queued paths (the same workaround in every attempt since 3). Known harness edge case, not changed in this batch. |

## Blind-Review Rules

- Exclude `.claude/reviews/**` and every `.claude/*-review-latest.md` file from every repository-wide search, including `rg`, `grep -r`, and `git grep` (for example `rg ... -g '!.claude/reviews/**' -g '!.claude/*-review-latest.md'`). An unscoped search can surface archived reviewer text and break blind review; if that happens, stop using the result and report it in the verdict. Do not read the other reviewer's packet, verdict, or archives.
- The only gate command you may run is the fingerprint preflight: `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`.
- Read deleted files with `git show HEAD:<path>`.

## Staged Diff (modified files)

```diff
diff --git a/.claude/commands/review-gate.md b/.claude/commands/review-gate.md
index 36116c7..8875646 100644
--- a/.claude/commands/review-gate.md
+++ b/.claude/commands/review-gate.md
@@ -1,10 +1,10 @@
 # /review-gate
 
-Prepare the full review gate for the current task. This command coordinates GSD review, Antigravity packet generation, Codex packet generation, and final commit readiness. Claude prepares artifacts; the user runs the external reviewer CLIs.
+Prepare the full review gate for the current task. This command coordinates an internal code-review pre-check, Antigravity packet generation, Codex packet generation, and final commit readiness. Claude prepares artifacts; the user runs the external reviewer CLIs.
 
 ## Order
 
-1. GSD code review for the scoped phase or files.
+1. Internal pre-check with Claude Code's built-in `/code-review` on the task's changes. It is not an approval; Antigravity and Codex remain the gate.
 2. Stage the exact queue and compute its deterministic `scope_hash`.
 3. Generate both blind packets with a shared `review_id` before either reviewer runs.
 4. User-run Antigravity verdict saved and archived.
@@ -14,14 +14,16 @@ Prepare the full review gate for the current task. This command coordinates GSD
 
 ## Inputs
 
-- Optional phase number. Defaults to current active phase from GSD state.
-- Optional `--depth=quick|standard|deep` for GSD code review.
+- Scope is always the files in `.claude/review-queue.txt`.
+- Optional `/code-review` effort level (`low` through `max`). Defaults to the level last used.
+
+`/code-review` here means Claude Code's built-in review command (listed as `code-review`, with no plugin prefix). It is not the `engineering:code-review` plugin skill, which takes a PR URL. Invoke it as `/code-review [low|medium|high|xhigh|max] [path ...]`, passing the queued paths; with no target it reviews the current diff.
 
 ## Steps
 
 1. Confirm `.claude/review-queue.txt` lists only current task files. Remove stale entries only with explicit confirmation that they belong to a closed task.
-2. Stage every queued path (including deletions), inspect `git diff --cached`, and compute `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`.
-3. Run the installed GSD code-review command (`/gsd-code-review` or `/gsd:code-review`, depending on runtime) for the same scope.
+2. Run `/code-review` on the queued paths. Fix what it finds that holds up, with the same TDD and verification rules as any change, before staging. Its findings are Claude's own check, not reviewer evidence. If the built-in command is unavailable in the session, do not substitute another tool and do not stall: note "pre-check unavailable" in both packets' verification table and continue.
+3. Stage every queued path (including deletions), inspect `git diff --cached`, and compute `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`. Any later edit changes this hash, so do all pre-check fixes first.
 4. Run `/antigravity-review` and `/codex-prompt` before opening either existing verdict.
 5. Ask the user to run Antigravity with the short command shown by `/antigravity-review`; require the policy-allowed verdict and append-only archive.
 6. Ask the user to run Codex with the short command shown by `/codex-prompt`; do not provide the Antigravity verdict and require its append-only archive.
diff --git a/.claude/skills/SKILL.md b/.claude/skills/SKILL.md
index 908f7f1..9584415 100644
--- a/.claude/skills/SKILL.md
+++ b/.claude/skills/SKILL.md
@@ -26,4 +26,4 @@ The shared Artifact QA Gate remains mandatory for artifact work and review.
 
 Vendored Supabase and Postgres best-practices references may exist under `.claude/skills/` or `.agents/skills/`; load them only for Supabase/Postgres tasks.
 
-Phase lifecycle management is handled by the globally installed GSD plugin (`/gsd-execute-phase`, `/gsd-progress`, etc.). No project-local `gsd_orchestrator.md` is needed.
+Phase lifecycle management is handled by the globally installed GSD plugin in its lean `core` profile (`/gsd-discuss-phase`, `/gsd-plan-phase`, `/gsd-execute-phase`). No project-local `gsd_orchestrator.md` is needed.
diff --git a/AGENTS_ROSTER.md b/AGENTS_ROSTER.md
index 5df3f5b..10107f0 100644
--- a/AGENTS_ROSTER.md
+++ b/AGENTS_ROSTER.md
@@ -66,14 +66,12 @@ Codex reads the packet, inspects actual files from disk, and returns the format
 
 Role: phase lifecycle and planning engine.
 
-Key commands:
+Key commands (lean `core` profile, frozen at 1.42.3):
 - `/gsd-discuss-phase`
 - `/gsd-plan-phase`
 - `/gsd-execute-phase`
-- `/gsd-verify-work`
-- `/gsd-code-review`
-- `/gsd-quick`
-- `/gsd-debug`
+
+Verification, code review, small fixes, and debugging are not GSD commands here. They use the Superpowers skills (`verification-before-completion`, `systematic-debugging`, `test-driven-development`) and `/review-gate`: Claude Code's built-in `/code-review` as a pre-check before staging, then the Antigravity + Codex review gate.
 
 GSD state files do not replace implementation evidence. Agents still inspect actual files and run verification.
 
@@ -81,13 +79,13 @@ GSD state files do not replace implementation evidence. Agents still inspect act
 
 1. Claude finishes a scoped task and verifies it.
 2. `.claude/review-queue.txt` lists current changed files.
-3. Claude prepares Antigravity packet.
-4. User runs Antigravity and saves verdict.
-5. Claude prepares Codex packet.
-6. User runs Codex and saves verdict.
+3. Claude prepares both blind packets (Antigravity and Codex) before either reviewer runs.
+4. User runs Antigravity; its verdict is saved and archived.
+5. User runs Codex without access to the Antigravity verdict; its verdict is saved and archived.
+6. Only after both archives exist are the verdicts compared.
 7. Claude fixes all BLOCK and REQUEST CHANGES findings.
-8. Affected files re-enter the queue and reviewers re-review.
-9. Commit only after both reviewers APPROVE.
+8. Affected files re-enter the queue and reviewers re-review as a new attempt.
+9. Commit only after Codex APPROVE and the policy-allowed Antigravity verdict (`ADVISORY` during probation), with no unresolved finding.
 
 ## Non-Negotiables
 
diff --git a/CLAUDE.md b/CLAUDE.md
index d1f6303..fe90d1f 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -15,11 +15,11 @@ After that, load only the context tier selected by `docs/context-router.md`. Do
 
 ## Workflow Entry Points
 
-Use GSD for project work unless the user explicitly asks to bypass it:
+GSD is installed in its lean `core` profile (frozen at 1.42.3; the upstream package is deprecated). Use it for phase work unless the user explicitly asks to bypass it:
 
-- `/gsd-quick` for small fixes, docs, and ad-hoc maintenance.
-- `/gsd-debug` for bug investigation.
-- `/gsd-plan-phase` and `/gsd-execute-phase` for phase work.
+- `/gsd-discuss-phase`, `/gsd-plan-phase`, and `/gsd-execute-phase` for phase work. Phase 5 plans already exist; executing them does not require re-planning.
+- Small fixes, docs, and ad-hoc maintenance: do them directly, with the same verification and review rules.
+- Bug investigation: `superpowers:systematic-debugging`.
 - `/review-gate` for non-trivial changes that need both reviewers.
 
 For file-changing work, keep `.claude/review-queue.txt` current. For code or behavior changes under `app/src/**`, follow the TDD and verification rules in `docs/agent-harness.md`.
@@ -68,7 +68,6 @@ Use the router instead of embedding these here:
 - Agent/review contract: `docs/agent-harness.md`
 - Codex details: `CODEX.md`
 - Antigravity details: `ANTIGRAVITY.md`
-- Tool profile: `.metaswarm/project-profile.json`
 
 ## Current Recovery Rule
 
diff --git a/docs/agent-harness.md b/docs/agent-harness.md
index d1a744a..0235d20 100644
--- a/docs/agent-harness.md
+++ b/docs/agent-harness.md
@@ -84,7 +84,7 @@ Artifacts do not replace inspecting actual files from disk.
 
 ## Scope Rules
 
-- Small docs-only changes may use `/gsd-quick`, but still require reviewer approval if they alter security, schema, workflow, review gates, product scope, launch constraints, or agent instructions.
+- Small docs-only changes may be made directly, but still require reviewer approval if they alter security, schema, workflow, review gates, product scope, launch constraints, or agent instructions.
 - Schema, RLS, GPS verification, trust/confidence, shadowban, privacy, auth, and service-role handling require Codex approval plus Antigravity review while Antigravity remains enabled.
 - Frontend-only changes require Codex review when they affect location permission, map behavior, error states, user identity, privacy, Supabase calls, or emergency-user availability.
 - Reviewer prompts must name exact files and dependency boundaries. Do not ask reviewers to infer scope from chat history.
diff --git a/docs/context-router.md b/docs/context-router.md
index 1d5cbdc..cdf0ee3 100644
--- a/docs/context-router.md
+++ b/docs/context-router.md
@@ -10,7 +10,6 @@ Keep review quality high while avoiding default full-document dumps. Start from
 
 - `AGENTS.md`
 - `.planning/STATE.md`
-- `.metaswarm/project-profile.json`
 - `.beads/context/execution-state.md` when recovering, resuming, or checking current phase state
 
 For any artifact creation, change, review, debugging, finalization, or handoff-state
diff --git a/docs/stale-info-scan.md b/docs/stale-info-scan.md
index fe14ca0..11962f1 100644
--- a/docs/stale-info-scan.md
+++ b/docs/stale-info-scan.md
@@ -10,8 +10,8 @@ This document defines how Gotta Go scans for stale, contradictory, or outdated p
 Run a stale-information scan:
 
 - Every 30 calendar days while the project is active.
-- Before any phase transition, including `/gsd-transition`.
-- Before closing a milestone, including `/gsd:complete-milestone`.
+- Before any phase transition (moving from one GSD phase to the next).
+- Before closing a milestone.
 - After dependency, SDK, Supabase, Mapbox, Expo, auth, schema, migration, or harness changes.
 - Before TestFlight, app-store submission, public launch, or a new market launch.
 - Whenever a reviewer reports possible drift between docs, code, migrations, or generated types.
diff --git a/docs/verification.md b/docs/verification.md
index af83a01..6c05798 100644
--- a/docs/verification.md
+++ b/docs/verification.md
@@ -34,6 +34,8 @@ node --test probity.config.test.js
 node --test scripts/os-portability.test.js
 ```
 
+Formatting is not an enforced check yet. Prettier is an app dev dependency, and `cd app && npx prettier --check .` was the former metaswarm profile's `format_check` command, but no CI job, package script, or hook runs it. A manual run on 2026-09-28 reported style issues in 154 files. Do not report it as a passing or failing gate. Making it required needs its own reviewed change that reformats those files and then adds the check to CI.
+
 Dated entries in `.planning/`, `.beads/`, and `.claude/reviews/` may cite the original Windows development host (`C:\...` paths, `npm.cmd`, PowerShell). Those are historical records and stay as written; the commands in this file are the current ones.
 
 ## Supabase And Database Verification
```

## Required Verdict Format

Write to `.claude/codex-review-latest.md`, run `node .claude/hooks/archive-review-artifact.js codex`, and print the verdict.

```md
## Codex Review - Tooling consolidation, attempt 7

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

scope_hash: sha256:e1664171afde3768d2cd723c2c12ebdf051c1fa3ed1a3f5d46ee810d01de20b0
review_id: rv-20260928T170747Z-3db6d0a9
risk_level: medium
runtime_required: false
blind_review: true
prior_reviewer_outputs_read: false
evidence_level: 0|1|2|3|4
runtime_evidence: executed|not_applicable|unavailable

### Reviewed Queue
### Skills Applied
- `.claude/skills/artifact_qa_gate.md` shared core and Codex Overlay
- <list any other skills actually applied>
### Findings
### Open Questions
### Verification
### Evidence Receipts
### Adversarial Disproof
- Address T1-T8 individually.
### Unverified Boundaries
### Runtime Boundary Check
### Approved
```
