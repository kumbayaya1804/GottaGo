<!-- review-manifest
reviewer: antigravity
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

# Antigravity Review Packet — TDD Guard → Probity Migration, ROUND 3

Your round-2 ADVISORY was clean and correctly re-verified all three round-1 Codex findings as
fixed. But Codex's round-2 REQUEST CHANGES found a fourth real MAJOR defect your round-2 pass
missed: `probity.config.ts`'s `PROJECT_TDD_ADDENDUM` claimed to preserve the deleted
`.claude/tdd-guard/data/instructions.md` "verbatim," but the addendum silently omitted the entire
`## TDD Order` section (write a failing test first, watch it fail, then implement). Codex proved
this by measuring the source character counts (1,329 deleted vs. 1,127 ported) and by running the
real config through Probity's actual `loadConfig()`/`evaluate()` path with a prompt-capturing fake
agent — the effective validator prompt reaching the AI contained every other project section but
not `### TDD Order`.

**Only two files changed since round 2, both new/modified in this round:**
- `probity.config.ts` — restored the missing `### TDD Order` section verbatim, in its original
  position (between RLS Tests and Coverage), matching the deleted source exactly.
- `probity.config.test.js` (NEW) — a regression suite that loads the REAL `probity.config.ts`
  through Probity's real `loadConfig()`/`evaluate()` (not a reimplementation): proves an
  `app/src/**` write invokes `enforceTdd` while a write outside that scope (including to
  `probity.config.ts` itself) does not, and asserts the captured effective prompt contains
  Probity's own default Red-Green-Refactor text plus all six ported project sections by name,
  including `### TDD Order` and the exact restored rule text. This test was mutation-tested before
  being trusted: reverting the `TDD Order` fix in a scratch copy made exactly one assertion fail
  (the `TDD Order` one), with the other two tests still passing — confirming the test actually
  catches the class of defect Codex found, not just a passing artifact.

All 9 previously-reviewed files are byte-identical to round 2 — do not re-review them from
scratch; focus your evidence-gathering on the two files above.

**BLIND REVIEW:** review independently. Do not read the other reviewer's saved output for this
scope before saving your own verdict.

### Required Skills
- `.claude/skills/artifact_qa_gate.md` shared core
- Antigravity Overlay
- `superpowers:using-superpowers`
- `superpowers:verification-before-completion`

## Reviewed Queue
10 files (9 unchanged from round 2 + `probity.config.test.js`, new this round). Only
`probity.config.ts` and `probity.config.test.js` have different bytes than round 2.

### Runtime Boundary And Mock Audit
This round changes only local developer tooling: a config source file (`probity.config.ts`) and
a new regression test (`probity.config.test.js`). The test imports Probity's actual installed
`dist/config.js`/`dist/engine.js` directly (no reimplementation, no mock of the loader/resolver);
the only substitution is a deterministic fake `ctx.agent.reason()` standing in for a real LLM call,
used solely to capture the exact prompt text Probity would send — not to fabricate a pass/fail
verdict on TDD quality. No application, database, Supabase, or production runtime boundary is
touched by this scope.

### Claim And State Audit
- Packet claim: `### TDD Order` is restored "verbatim" — verify directly against
  `git show HEAD:.claude/tdd-guard/data/instructions.md` rather than trusting this prose.
- Packet claim: the new test "would have caught" the round-2 defect — verify by reproducing the
  mutation yourself, not by trusting the packet's description of having done so.
- `docs/agent-harness.md` carries this batch's already-approved staged content only; its separate
  unstaged Known Limitations edit is intentionally outside this scope and this verdict.

## What To Verify
- Load `probity.config.ts` through the real installed `@nizos/probity` `loadConfig()` and confirm
  the `### TDD Order` section is present in `PROJECT_TDD_ADDENDUM` with the same text as
  `git show HEAD:.claude/tdd-guard/data/instructions.md` (adjusted only for the `##`→`###` heading
  depth this addendum already uses throughout).
- Run `node --test probity.config.test.js` against the real installed package and confirm it
  passes.
- Do not just trust the test file's docstring claims — either re-run the mutation yourself
  (temporarily strip the `### TDD Order` section and confirm the suite fails at the expected
  assertion) or independently trace why the assertion would fail without that section present.
- Confirm `.claude/review-queue.txt` now lists `probity.config.test.js` and that the packet's
  `scope_hash` matches `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`.
