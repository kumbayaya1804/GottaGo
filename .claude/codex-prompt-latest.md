<!-- review-manifest
reviewer: codex
generated_at: 2026-07-31T13:15:00Z
scope_hash: sha256:3860387c8e9d52ab5121a39e9bb17a0adcd3ff570ba308aa6c56351b64673b7a
review_id: rg-2026-07-31-tdd-guard-to-probity-migration-03
risk_level: medium
runtime_required: false
blind_review: true
queue:
  - .claude/hooks/check-review-artifacts.js
  - .claude/hooks/check-review-artifacts.test.js
  - .claude/tdd-guard/data/instructions.md
  - .metaswarm/project-profile.json
  - CLAUDE.md
  - docs/agent-harness.md
  - package-lock.json
  - package.json
  - probity.config.test.js
  - probity.config.ts
diff_base: HEAD
context_tier: 1
-->

# Codex Review Packet — TDD Guard → Probity Migration, ROUND 3

Your round-2 REQUEST CHANGES finding was real and independently reproduced before fixing: the
character-count comparison (1,329 vs. 1,127) and the effective-prompt capture both confirmed
`### TDD Order` was missing from `PROJECT_TDD_ADDENDUM` despite the "verbatim" claim. **I wrote
this fix and cannot self-approve. You remain the approval-bearing reviewer.**

**Fix, exactly as requested in your "Required fix":**
1. `probity.config.ts` — restored `### TDD Order` verbatim in its original position (between RLS
   Tests and Coverage), matching `git show HEAD:.claude/tdd-guard/data/instructions.md:15-16`'s
   text exactly (only the heading depth changes, `##`→`###`, matching every other ported section
   in this same addendum).
2. `probity.config.test.js` (NEW) — loads the real `probity.config.ts` through
   `@nizos/probity`'s actual `dist/config.js` `loadConfig()` and `dist/engine.js` `evaluate()`
   (imported directly, since neither is part of the package's public export map — same approach
   your own round-1/round-2 verification scripts used). Three tests: (a) the loaded config has
   exactly one `RuleBlock` anchored to `app/src/**`; (b) a write under `app/src/**` invokes
   `enforceTdd` (captured via a fake `ctx.agent.reason`), a write outside it — including to
   `probity.config.ts` itself — does not; (c) the captured effective prompt contains Probity's
   default `Red phase: write a failing test first` text plus all six ported section headings
   (`GPS Distance Tests`, `Trust Score Delta Tests`, `PostGIS Geometry Tests`, `RLS Tests`,
   `TDD Order`, `Coverage`) and the exact restored `TDD Order` rule text.

**Self-verification before sending this packet:** reverted the `### TDD Order` section in a
scratch copy of `probity.config.ts` and re-ran `probity.config.test.js` — exactly one assertion
failed (`effective prompt missing ported project section: TDD Order`), the other two tests still
passed. Restored the real fix and re-ran clean (3/3). This reproduces your exact round-2 finding
and confirms the new test would have caught it.

**Everything else is byte-identical to round 2** — the dependency swap, the `probity.config.ts`
protected-path regex, the app/src/** scoping fix, and the ported project sections you already
confirmed in rounds 1-2 are unchanged.

**BLIND REVIEW:** do not read the other reviewer's saved output for this scope before saving your
verdict.

### Required Skills
- `.claude/skills/artifact_qa_gate.md` shared core and Codex Overlay
- Node enforcement logic, TypeScript configuration, and TDD-tool migration completeness review

## Reviewed Queue
10 files. Only `probity.config.ts` (this round's fix) and `probity.config.test.js` (new) differ
from round 2's bytes.

### Runtime Boundary And Mock Audit
This round changes only local developer tooling: `probity.config.ts` (the restored rule text) and
the new `probity.config.test.js`. The test imports Probity's real installed
`dist/config.js`/`dist/engine.js` directly — no reimplementation of the loader or resolver. The
only substitution is a deterministic fake `ctx.agent.reason()` in place of a real LLM call, used
only to capture the exact effective prompt text; it does not fabricate or assume any TDD-quality
verdict. No application, database, Supabase, or production runtime boundary is implicated.

## Open Items From Round 2 To Re-Confirm
- Your round-2 "Approved" section already confirmed findings 1 and 2 (config shape/scoping,
  `probity.config.ts` review-gate protection) are fixed — those files are unchanged this round, so
  a fresh independent spot-check is welcome but the finding itself should not need re-discovery.
- Please independently verify the character-for-character restoration of `### TDD Order` against
  `git show HEAD:.claude/tdd-guard/data/instructions.md` rather than trusting this packet's claim,
  and independently run (not just read) `probity.config.test.js` against the real installed
  package, including your own mutation check if you want stronger evidence than mine.
