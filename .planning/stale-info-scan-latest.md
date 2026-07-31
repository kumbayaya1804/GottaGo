# Stale Information Scan - 2026-07-30

Trigger: harness change — Antigravity probation, blind review, evidence contract,
append-only verdict archive, and the removal of the `REVIEW_GATE_ALLOW_UNREVIEWED`
escape hatch for protected paths. `docs/stale-info-scan.md` requires a scan for
harness changes, and the prior scan (2026-07-15) predates all of it.
Branch: master
Commit: 1f76e44
Next review due: 2026-08-29 (30-day cadence) or the next harness change, whichever comes first.

## Commands Run

- `node --test .claude/hooks/check-review-artifacts.test.js` - 53/53 pass, 0 fail, 0 skipped on this host
  after the round-8 fix (30/30 before any of it; 39/39 after round 2; 44/44 after round 3; 48/48 after
  round 4; 49/49 after round 5; 50/50 after round 6; 52/52 after round 7). Round 4 added: a percent-encoding
  blind-review bypass test (`%2e`, nested `%252f`, encoded extension), a CRLF-verdict-under-`core.autocrlf=true`
  archive test, and two calibration `passingVerdicts` tests (contradictory archived verdict; contract omitting
  the field fails closed). Round 5 added: a CommonMark/HTML5 character-reference blind-review bypass test
  (decimal `&#46;`, hex `&#x2e;`, named `&period;`/`&sol;`, and a nested `&amp;#46;` case requiring two passes
  of the same fixed-point loop). Round 6 added: an `&percnt;` composition test and expanded the named-entity
  table from a hand-picked 5 entries to what was BELIEVED to be the complete WHATWG HTML5 category of names
  mapping to a single ASCII punctuation/control character — but round 6's own manual transcription still
  undercounted that category (40 of 41 real entries; a spot-check-style WebFetch is not the same as an exact
  diff). Round 7 found the miscount via a genuine programmatic comparison against the live spec
  (`whatwgCount: 41`, `stagedCount: 40`, exactly one name missing: `underbar` -> `_`), added it, and added a
  completeness test — but round 7's own new test had a real gap of its own, found by Codex with an EXECUTED
  mutant (changing the table's raw `bsol: '\\'` value to the wrong `'/'` produced zero test failures, since
  the test only observed values through `canonicalizePathText()`'s downstream `\`->`/` normalization, which
  masked exactly this one entry's raw-value error). Round 8 fixed the test itself: a new
  `loadNamedCharacterReferences()` helper extracts and `assert.deepEqual()`s the RAW object directly (not
  through any pipeline) — genuinely pins the exact 41 key->value pairs, confirmed via a standalone
  mutation-testing check that this version does catch the exact mutant that got past round 7's version. The
  end-to-end pipeline check is now a separate, correctly-labeled test rather than conflated with completeness.
  This category can't silently drift again without a test failing locally.
  **Reproducibility caveat, corrected 2026-07-30:** the round-2 figure was recorded as "39/39, 0 skipped"
  without qualification, but the wrapper test resolved `sh` via PATH lookup only. A reviewer on a Windows
  host where Git's `sh.exe` is installed but not on PATH observed 38 pass / 1 skipped instead — the same
  suite, a different result, so the recorded evidence was not universally reproducible. The test now also
  probes the standard Git-for-Windows install locations before skipping.
- `node --check .claude/hooks/check-review-artifacts.js`, `node --check .claude/hooks/archive-review-artifact.js`,
  `sh -n .beads/hooks/pre-commit` - all clean.
- `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash` - reproduces the packet fingerprint.
- `git check-ignore -v .claude/reviews/...` - no match; archives are tracked, not ignored (see UPDATE REQUIRED, now resolved).
- `git config --local --get core.hooksPath` - `.beads/hooks`, confirming `.beads/hooks/pre-commit` is the real gate caller.

## BLOCKING STALE INFO

- **Corrected 2026-07-30 (round 6):** this section previously listed "self-asserted calibration" as simply
  "fixed," which overstated round 1's actual scope. What round 1 fixed was receipt shape/uniqueness/archive
  binding; round 4 added a verdict-token value check (`passingVerdicts`). The CORE self-assertion problem —
  `passed`/`falseApprovals` are still author-supplied, not derived from a trusted, independently-verifiable
  expected outcome — was never fixed and remains one of 2 disclosed, still-open architectural items, reaffirmed
  by both reviewers every round since (rounds 3-5). The other five round-1 fixes (missing-policy fail-open,
  non-content-addressed archive acceptance, blind-review separator/false-positive bugs, the `node`-absent
  caller bypass) genuinely are complete and regression-tested — only the calibration-truth item was
  overclaimed.

## UPDATE REQUIRED

- None outstanding. Resolved in this pass:
  - `docs/agent-harness.md` now states the `.claude/reviews/` retention rule (tracked audit history, committed
    alongside the change they justify) — previously the path was listed as an artifact with no retention policy,
    which left it ambiguous whether archives were local scratch or durable evidence.
  - `.beads/hooks/` is now a review-required path in `check-review-artifacts.js`. The gate's own caller was
    previously unprotected, so it could be edited to skip the gate without triggering review.

## WATCH

- `.claude/reviews/` growth: one file per verdict attempt per scope, committed. Small today (a few KB per
  verdict) but unbounded over time. Revisit if the directory becomes large enough to affect clone size.
- `.claude/antigravity-review-policy.json` is `mode: probation`, `calibrationStatus: not_run`. Antigravity
  cannot approve until a blind calibration suite passes and a human explicitly flips the policy. No calibration
  has been run yet; this is the intended state, not drift, but it should not be left indefinitely unexamined.
- `docs/codex-model-routing.md` and the Codex contingency-orchestrator guidance were not re-verified in this
  pass; they were last confirmed 2026-07-09 and are unrelated to this change.

## CURRENT

- `CLAUDE.md`, `AGENTS.md`, `ANTIGRAVITY.md`, `CODEX.md`, `docs/agent-harness.md`, `docs/review-severity.md`,
  `.claude/commands/{antigravity-review,codex-prompt,review-gate}.md`, and
  `.claude/skills/{artifact_qa_gate,review_packet_generator}.md` all consistently describe probation semantics
  (`ADVISORY` is the clean Antigravity result; `APPROVE` is invalid while in probation) and the blind-review
  ordering. Verified by direct read across all of them, not spot-checked.
- The reviewer verdict formats in `ANTIGRAVITY.md` and `CODEX.md` match the fields the hook actually enforces
  (`review_id`, `risk_level`, `runtime_required`, `blind_review`, `prior_reviewer_outputs_read`,
  `evidence_level`, `runtime_evidence`, plus the `Evidence Receipts` / `Adversarial Disproof` /
  `Unverified Boundaries` sections).
- `.planning/STATE.md` and `.beads/context/execution-state.md` were refreshed on 2026-07-30 and describe
  current Phase 5 state, including the previously-contradictory Task 5 live-push record. **Corrected again in
  round 6:** `execution-state.md` still carried an older line calling `database.types.ts` "staged, awaiting
  review" alongside a newer line calling it "unstaged... never reviewed" — both wrong as of now. It is
  worktree-modified (unstaged), and its review is NOT outstanding: both reviewers returned dual-clean verdicts
  (Codex APPROVE, Antigravity ADVISORY, zero findings). The only remaining blocker is a formatting gap in the
  saved Codex verdict text (lowercase "Codex overlay" vs. the gate's required literal "Codex Overlay"), not a
  substantive finding.

## Blocked Checks

- Antigravity calibration receipts could not be verified because no calibration run has been performed. The
  hook's enforcement of those receipts is covered by tests using synthetic fixtures, not by a real calibration.
- The archive immutability guarantee is enforced at commit time only. Filesystem-level immutability (deletion,
  tampering outside a commit, or divergence on another clone) remains unenforced and unverified.
