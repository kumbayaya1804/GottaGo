# Agent Harness

Status: active project contract.
Last reviewed: 2026-07-30.

This document defines how Claude, Antigravity, Codex, and GSD coordinate on Gotta Go. It focuses on handoff artifacts, review gates, permissions, and failure handling. Context selection is defined in `docs/context-router.md`.

## Harness Principles

1. Claude is the orchestrator and default implementer.
   Claude owns GSD workflow execution, file edits, TDD discipline, local verification, packet generation, and finding resolution.

2. Antigravity and Codex are separate reviewers.
   Codex is the approval-bearing independent reviewer. Antigravity owns architecture, PostGIS, RLS placement, trust math, confidence decay, aggregate correctness, and system data-integrity findings, but is advisory while `.claude/antigravity-review-policy.json` says `mode: probation`. Antigravity findings still block; its clean `ADVISORY` does not count as approval.

3. Review is artifact-driven.
   No reviewer approves from intent alone. A review packet must define scope, queued files, diffs, verification evidence, runtime boundaries, mock boundaries, and required verdict format.

4. Context is routed, not dumped.
   Agents must use `docs/context-router.md` before loading large source documents. Full source docs belong in packets only when the whole document is directly relevant.

5. Handoffs are explicit.
   A packet must name files, callers, callees, providers, route guards, hooks, RPCs, policies, migrations, scheduled jobs, tests, and mocks that can affect the changed behavior.

6. Guardrails beat speed.
   BLOCK stops the line. REQUEST CHANGES requires a fix and re-review. Security, privacy, RLS, GPS integrity, and data-loss conflicts default to the stricter interpretation.

7. Reviewer independence is preserved.
   The implementing orchestrator cannot self-approve. Both initial packets are generated from the same neutral claim table before either review runs. Neither reviewer sees the other's output until both initial verdicts are saved in append-only archives.

8. Codex orchestration is an explicit contingency.
    When the human explicitly assigns orchestration to Codex, including during a Claude availability or rate-limit interruption, GPT-5.6 Sol may temporarily own GSD-compatible planning, scoped implementation, verification, packet preparation, and finding resolution. Terra and Luna may receive bounded delegated tasks under `docs/codex-model-routing.md`. This does not let the implementing Sol session self-approve; a separate Codex review run remains required.

9. Artifact QA is a shared permanent gate.
   For artifact creation, modification, review, debugging, finalization, and handoff-state changes, load `.claude/skills/artifact_qa_gate.md`. Codex and Antigravity apply the same shared evidence core plus their distinct role overlays. The shared skill standardizes proof without merging reviewer roles or verdicts.

10. Superpowers and Artifact QA compose.
    When Superpowers is installed, invoke `superpowers:using-superpowers` before task actions, then the task-relevant process skills. Artifact QA defines what evidence is required; Superpowers defines how the task is performed. Antigravity always applies `superpowers:verification-before-completion` before an approval claim. Packets declare `### Required Skills`; verdicts declare `### Skills Applied`.

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
- `.claude/antigravity-review-policy.json`: machine-enforced Antigravity mode, calibration, evidence, blind-review, and archive policy.
- `.claude/reviews/<scope-hash>/<reviewer>/<content-hash>.md`: immutable copies of every verdict attempt.
  **Retention: tracked audit history, not local scratch.** Archives are committed alongside the change whose
  review they justify, so the evidence survives a fresh clone and is reviewable after the fact. The filename
  must be the SHA-256 of the file's own contents; `check-review-artifacts.js` derives that address and
  byte-compares, so an archive stored under any other name does not satisfy the gate. Never edit or delete an
  archived verdict — a revision is a new attempt at a new content address. Note the guarantee is enforced at
  commit time only; filesystem-level immutability is not claimed.
- `.planning/stale-info-scan-latest.md`: latest stale-information scan report.

Artifacts do not replace inspecting actual files from disk.

## Standard Flow

1. Claude loads startup context through `docs/context-router.md`.
2. Claude works through GSD unless the user explicitly bypasses it.
3. Claude verifies locally and records commands, results, and blockers.
4. Claude ensures `.claude/review-queue.txt` matches current changed files.
5. Claude stages the exact queue, inspects the staged diff, and computes the staged `scope_hash`.
6. Claude loads `.claude/skills/artifact_qa_gate.md` and includes its shared contract, target reviewer overlay, and a task-specific `### Required Skills` section in each packet.
7. Claude generates both blind packets with the same `review_id`, risk level, runtime requirement, neutral claim table, and staged scope before either reviewer runs.
8. User runs Antigravity with the strongest high-reasoning model available. In probation, a clean result is `ADVISORY`; `APPROVE` is invalid.
9. The exact Antigravity verdict is archived with `node .claude/hooks/archive-review-artifact.js antigravity`.
10. User runs a separate Codex review without access to the Antigravity verdict.
11. The exact Codex verdict is archived with `node .claude/hooks/archive-review-artifact.js codex`.
12. Only after both archives exist may the outputs be compared. Claude resolves all BLOCK and REQUEST CHANGES findings.
13. Affected files re-enter the queue; changed bytes are re-staged, re-fingerprinted, and reviewers re-review as new archived attempts.
14. During Antigravity probation, commit requires Codex `APPROVE`, Antigravity `ADVISORY`, and no unresolved finding. Active two-approval mode is allowed only after passed blind calibration and an explicit human policy change.

## Scope Rules

- Small docs-only changes may use `/gsd-quick`, but still require reviewer approval if they alter security, schema, workflow, review gates, product scope, launch constraints, or agent instructions.
- Schema, RLS, GPS verification, trust/confidence, shadowban, privacy, auth, and service-role handling require Codex approval plus Antigravity review while Antigravity remains enabled.
- Frontend-only changes require Codex review when they affect location permission, map behavior, error states, user identity, privacy, Supabase calls, or emergency-user availability.
- Reviewer prompts must name exact files and dependency boundaries. Do not ask reviewers to infer scope from chat history.
- Named/focused verdicts cannot satisfy the commit gate. The canonical packets and verdicts must cover the complete queued staged scope.

## Prompt Packet Requirements

Every packet includes:

- Task goal and phase.
- Current `.claude/review-queue.txt` entries.
- Deterministic `scope_hash` computed from the staged queue bytes.
- Shared `review_id`, `risk_level`, `runtime_required`, and `blind_review: true`.
- A neutral claim table naming the claim, authority source, required disproof, and evidence needed without supplying a preferred verdict.
- Git status and diff for queued files.
- Full queued file contents or an explicit diff.
- Relevant context selected by `docs/context-router.md`.
- Runtime-boundary context.
- Mock-boundary context.
- Verification commands already run and outcomes.
- Known caveats, failed commands, or missing tooling.
- Required verdict format and severity definitions.
- Required evidence receipts, adversarial disproof, unverified-boundary, and immutable-archive sections.

Use context tiers:

- Tier 0: always include queue, diff, verification, role summary, verdict format, and runtime/mock audit instructions.
- Tier 0 also includes the shared artifact-QA contract and the target reviewer's role overlay from `.claude/skills/artifact_qa_gate.md`.
- Tier 0 includes `### Required Skills`; Antigravity always lists `superpowers:using-superpowers` and `superpowers:verification-before-completion`, plus task-relevant process/domain skills.
- Tier 1: include boundary-specific excerpts from product, schema, harness, stale-info, CODEX, or ANTIGRAVITY docs.
- Tier 2: include full source docs only when the doc itself is in scope or an excerpt would be misleading.

Never include secrets, service-role keys, auth tokens, private `.env` values, or precise user location data in packets.

## Runtime Boundary And Mock Audit

Every non-trivial packet must include this section. It must trace:

- Nearest callers and callees.
- Providers, layouts, route guards, hooks, external callbacks, and scheduled jobs.
- RPCs, migrations, policies, triggers, materialized views, and Supabase permissions.
- Tests that mock any of the above.
- Whether mocks could hide production behavior.
- For process/network/database work: caller/client, resolver or driver, transport,
  kernel/container/proxy, server/callee, matched auth or permission rule, cleanup, and
  resulting state.

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
- `.claude/antigravity-review-latest.md` has the policy-allowed verdict (`ADVISORY` in probation, `APPROVE` only in calibrated active mode) for the current packet scope.
- `.claude/codex-review-latest.md` is APPROVE for the current packet scope.
- Prompt packets include the evidence-contract fields and current staged `scope_hash`; both verdicts repeat them, mention every staged queued file, and have byte-identical append-only archives.
- Runtime-required changes have executed runtime evidence. High-risk verdicts meet the Level 3 evidence floor.
- Reviewer conflicts are documented and resolved.
- The commit message records verification and reviewer verdicts.

## Known Limitations

The commit gate above is not a fully closed system. Two architectural gaps are disclosed, tracked, and
were accepted as explicit risk by the user (commit `d03bfe7`, 2026-07-31) rather than being silently
carried or resolved:

1. **Working-tree reads for decision-bearing trust inputs.** `check-review-artifacts.js` reads policy
   (`.claude/antigravity-review-policy.json`), the review queue (`.claude/review-queue.txt` — itself
   gitignored and never part of any commit), calibration contract/evidence and its cited prompt and
   verdict-receipt files, prompt packets, and canonical verdicts from the working tree
   (`fs.readFileSync`), not the Git index. The queue's working-tree content directly drives
   `stagedScopeHash()`, so an unstaged queue edit changes what the gate evaluates without changing
   what the commit records. Archive binding to the Git index is narrower than it sounds, and the
   pathname is not the bound thing: the gate reads a canonical verdict's content from the working
   tree (`readFileSafe(req.file)`) and passes it to `hasArchivedCopy()` (since round 6), which
   derives the content-addressed archive path that content hashes to and OID-compares *that
   archive path's* index and working-tree blobs — it never inspects the canonical
   `.claude/antigravity-review-latest.md` / `.claude/codex-review-latest.md` paths' own index
   entries, which remain ordinary working-tree reads like everything else in this list. This makes
   canonical verdicts a real exception to the "invisible to the commit" problem below, not another
   instance of it: when the gate passes, a byte-identical archive copy of the exact reviewed
   content is guaranteed to be in the commit, even though the pointer pathname itself may commit
   older or different bytes. Calibration receipt archives under `.claude/reviews/**` get no such
   guarantee — content-addressed and existence-checked, but never required to be staged, so a
   calibration row can cite a real, correctly-hashed archive that was never committed. For every
   other input in this list — policy, the review queue, calibration contract/evidence, prompt
   packets — an unstaged edit is genuinely invisible to what a commit records: nothing else in the
   gate captures a committed copy of their reviewed bytes the way `hasArchivedCopy()` does for
   canonical verdict content.
2. **Self-asserted calibration truth.** Calibration `passed` (per row) and `falseApprovals` (header) are
   supplied by the evidence author, not derived from a trusted, independently-verifiable expected
   outcome. Receipt shape, uniqueness, archive binding, and the `passingVerdicts` value check (see
   `ANTIGRAVITY.md` § Calibration Exit Gate) all narrow forgery, but none of them proves a calibration
   run actually detected a hidden failing case — they prove a review occurred, not that it was correct.

Both gaps were reaffirmed as real and unchanged by both reviewers across rounds 3-8 of the 2026-07-30/31
review-gate hardening workstream; neither reviewer's approval treats them as resolved. Closing them
requires an architectural change (index-based reads for all trust inputs; a trusted case manifest or
oracle for calibration) considered out of scope for the session that authored the surrounding hardening,
and deliberately left to whichever session takes it on next. Full round-by-round history is in
`.planning/STATE.md`'s 2026-07-30/31 entries.

## Superpowers And TDD

Use relevant Superpowers skills before action. For app source behavior, TDD order is test -> fail -> implement -> pass. Probity (`probity.config.ts`, migrated from TDD Guard 2026-07-31) applies to `app/src/**` source work. The protected-path review queue and canonical artifact checks have no environment-variable bypass.
