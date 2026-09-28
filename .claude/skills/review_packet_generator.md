# Skill: Review Packet Generator

## Purpose

Generate lean, evidence-rich Antigravity and Codex packets. Packets must let reviewers inspect the real files from disk without forcing the whole project into the prompt.

## Inputs

- `.claude/review-queue.txt`
- staged index for every queued path (`git add -A -- <queued paths>`)
- `docs/context-router.md`
- `.claude/skills/artifact_qa_gate.md`
- `git status --short`
- `git diff HEAD -- <queued files>`
- queued file contents or exact diffs
- local verification evidence
- `.claude/antigravity-review-policy.json`

## Context Tiers

### Tier 0 - Always

Include:
- task goal and phase
- queue entries
- git status and queued-file diff
- verification commands and outcomes
- required verdict format
- neutral claim table: implementation claim, authority source, disproof attempt required, and evidence needed
- shared Artifact QA Gate contract and the target reviewer's overlay
- `### Required Skills` with the shared gate, target overlay, and only the process/domain skills whose triggers match the queue
- Runtime Boundary And Mock Audit
- full queued files or exact diff hunks

### Tier 1 - Boundary Specific

Add focused excerpts when touched:
- `SPEC.md` for emergency-user flows, product guarantees, privacy, GPS, trust, confidence, shadowban, or gamification
- `docs/schema-contract.md` for tables, RPCs, policies, migrations, PostGIS, RLS, trust, or shadowban behavior
- `docs/agent-harness.md` and `docs/stale-info-scan.md` for workflow, prompt, command, artifact, or stale-info changes
- nearby callers, callees, providers, route guards, hooks, migrations, policies, tests, and mocks

### Tier 2 - Exceptional

Include a full source document only when:
- the document itself is being reviewed or edited
- a line excerpt would hide a relevant contradiction
- the reviewer cannot judge scope without the full section

## Freshness Header

Each packet starts with:

```md
<!-- review-manifest
reviewer: antigravity|codex
generated_at: <ISO timestamp>
scope_hash: <output of node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash>
review_id: <opaque id shared by both packets>
risk_level: low|medium|high
runtime_required: true|false
blind_review: true
queue:
  - <path>
diff_base: HEAD
context_tier: 0|1|2
-->
```

Each reviewer verdict must repeat `review_id`, `risk_level`, `runtime_required`, and
`blind_review`; declare `prior_reviewer_outputs_read: false`, `evidence_level`, and
`runtime_evidence`; and include `### Reviewed Queue`, `### Evidence Receipts`,
`### Adversarial Disproof`, and `### Unverified Boundaries`. The pre-commit gate checks
these fields, sections, queue coverage, policy-allowed verdict, and archived copy.

Generate packets with `node .claude/hooks/review-packets.js` after writing the task's
claims to `.claude/review-claims.md` (format in `.claude/commands/codex-prompt.md`). The
script stages the exact queue (including deletions, even ones already staged with
`git rm`), computes the deterministic staged fingerprint, and applies the rules below.
The manual equivalent, for inspection:

```bash
node .claude/hooks/harness-hooks.js stage-queue
node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash
```

`stage-queue` runs `git add -A` on exactly the queued paths, including deletions, as literal pathspecs (glob characters and `:(magic)` in a name never match other files). It works the same on macOS, Linux, and Windows, and fails loudly on an empty queue or a path git rejects.

Put that exact `scope_hash` in both packet manifests. Each reviewer must copy the same
line into its verdict after confirming the staged scope. The pre-commit hook recomputes
the hash from the index and rejects a missing or stale fingerprint, so any re-staged
queued byte requires regenerated packets and fresh verdicts.

## Runtime Boundary And Mock Audit

Every non-trivial packet includes:
- nearest callers/callees
- providers/layouts/route guards/hooks
- RPCs, policies, migrations, triggers, scheduled jobs, and external callbacks
- tests that mock any of those boundaries
- explicit question: could the mock hide production behavior?

Auth, routing, GPS, Supabase writes, RLS-sensitive reads, trust/shadowban logic, and async UI flows require event-ordering and failure-path review.

Set `runtime_required: true` for novel runtime workarounds, authentication routes,
concurrency claims, cleanup guarantees, platform-specific process boundaries, or any
claim whose correctness depends on the actual OS/container/service configuration. A
positive verdict then requires reproducible `runtime_evidence: executed`; static
inspection, source quotation, and mocks are insufficient.

## Required Skills Contract

Every Antigravity packet requires:

- `.claude/skills/artifact_qa_gate.md` shared core and `Antigravity Overlay`;
- `superpowers:using-superpowers`;
- `superpowers:verification-before-completion`;
- task-relevant Superpowers skills selected by trigger;
- task-relevant project skills such as `postgis_optimizer.md`, `rls_security_guard.md`, or `trust_engine_validator.md` when their boundary is touched.

Every Codex packet requires `.claude/skills/artifact_qa_gate.md`, the `Codex Overlay`,
and task-relevant skills actually available to Codex. Do not claim unavailable skills.
Every verdict includes `### Skills Applied`; an unavailable required skill is a named
verification gap, not an implied invocation.

## Rules

- Route every Antigravity and Codex packet through `.claude/skills/artifact_qa_gate.md`; include only the shared core and target reviewer overlay, never the other reviewer's conclusions.
- Generate both initial packets before either review runs. Do not read, quote, link, or summarize the other reviewer's verdict until both initial verdicts are saved and archived.
- A packet must never contain the other reviewer's output path: its `<reviewer>-review-latest.md` filename or a `.claude/reviews/<scope>/<reviewer>/` archive path. That includes "do not read X" instructions. The pre-commit gate treats any such mention as exposure and blocks the commit. Refer to it generically ("the other reviewer's verdict"). When a queued file's diff contains those filenames (for example the reviewer role guides or commands), do not embed that diff; tell the reviewer to read it from disk with `git diff --cached -- <path>`.
- Every packet tells the reviewer to exclude `.claude/reviews/**` and `.claude/*-review-latest.md` from repository-wide searches, so an unscoped search cannot break blindness.
- During a blind review, a packet may tell the reviewer to run only the fingerprint form: `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`. It must never tell the reviewer to run the full `check-review-artifacts.js` gate before saving and archiving the verdict. The full gate reads both canonical verdicts and its diagnostics can expose the other reviewer's metadata or conclusion. When a queued diff contains the full invocation as an orchestrator-only instruction, do not embed that hunk in either packet; direct the reviewer to inspect the queued file on disk.
- The orchestrator runs the full `node .claude/hooks/check-review-artifacts.js` gate only after both initial verdicts have been saved and archived. If either reviewer requests changes or blocks, preserve both attempts, apply fixes, and start a new blind attempt with fresh packets and a new `review_id`.
- Archive each exact verdict with `node .claude/hooks/archive-review-artifact.js antigravity|codex`. A revised verdict is a new immutable attempt, never an overwrite of the only prior copy.
- Named or focused verdict files are historical/supplemental artifacts only; they cannot substitute for the canonical `*-latest.md` artifacts covering the complete queued staged scope.
- Prefer excerpts, diffs, and dependency chains over full-doc dumps.
- Do not include secrets, tokens, private `.env` values, service-role keys, or precise user location data.
- Do not reuse a verdict if its packet manifest, queue, or diff is stale.
- Do not edit or re-stage queued files after review without regenerating both packets and verdicts.
- Do not clear `.claude/review-queue.txt`; clear it only after commit.
- Claude prepares packets. The user runs the reviewer CLIs unless explicitly overriding that workflow.
