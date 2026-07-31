<!-- review-manifest
reviewer: codex
generated_at: 2026-07-31T15:35:00Z
scope_hash: sha256:09e3550afcaa3400c47315fb5f044dff62822a71413ca6e558fd14d06386f6c9
review_id: rg-2026-07-31-agent-harness-known-limitations-04
risk_level: low
runtime_required: false
blind_review: true
queue:
  - docs/agent-harness.md
diff_base: HEAD
context_tier: 1
-->

# Codex Review Packet — `docs/agent-harness.md` Known Limitations Section, ROUND 4

Your round-3 REQUEST CHANGES finding was real and independently reproduced before fixing: the
round-3 concluding sentence claimed an unstaged edit to "any" listed working-tree input is
invisible to the commit, which contradicts the same paragraph's own newly-correct archive-binding
claim for canonical verdicts — when the gate passes, a byte-identical content-addressed archive
copy of the exact reviewed canonical content IS in the commit, confirmed by comparing the live
verdict's SHA-256 against its staged archive's SHA-256 (identical) while the canonical pointer
path's index OID differs from its working-tree OID. Also fixed the smaller call-path attribution
error: the gate/caller reads canonical content via `readFileSafe(req.file)` and passes it to
`hasArchivedCopy()`, which never reads the canonical file itself — it only derives and checks the
archive path. **I wrote this fix and cannot self-approve. You remain the approval-bearing
reviewer.**

**Fix, exactly as requested in your "Required fix":** the concluding sentence now carves out
canonical verdicts as a real exception (their content is captured via the archive copy, even though
the pointer pathname may commit different bytes), while stating plainly that policy, the review
queue, calibration contract/evidence, and prompt packets have no equivalent guarantee and remain
genuinely invisible to the commit when edited unstaged. The call-path wording now attributes the
`readFileSafe` read to the gate/caller, not to `hasArchivedCopy()`.

**BLIND REVIEW:** do not read the other reviewer's saved output for this scope before saving your
verdict.

### Required Skills
- `.claude/skills/artifact_qa_gate.md` shared core and Codex Overlay
- Node review-gate implementation reading; documentation-accuracy review

## Reviewed Queue
- `docs/agent-harness.md` (limitation 1's paragraph only; limitation 2 unchanged since round 1)

## Round 3 Finding To Re-Confirm
- Please independently verify the concluding sentence no longer makes a universal "any input"
  claim that contradicts the archive-copy guarantee for canonical verdicts, and that the call-path
  attribution (gate reads via `readFileSafe`, `hasArchivedCopy()` only derives/checks the archive
  path) is now correct — rather than trusting this packet's description of having fixed it.

### Runtime Boundary And Mock Audit
Pure documentation change. No application, database, Supabase, device, or production runtime
boundary is implicated. No mocks are relevant — verification is direct source inspection plus a
real Git OID/SHA-256 comparison against this repo's actual current state.
