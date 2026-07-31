<!-- review-manifest
reviewer: antigravity
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

# Antigravity Review Packet — `docs/agent-harness.md` Known Limitations Section, ROUND 4

Your round-3 ADVISORY was clean and independently confirmed the exact same pointer-path-vs-archive
distinction the other reviewer's round-3 REQUEST CHANGES was about to demand — good agreement
there. But the other reviewer's round-3 pass found one more real defect your round-3 pass didn't
flag: the round-3 fix's concluding sentence.

The other reviewer's feedback across rounds 2-3 found two related real defects in limitation 1's
archive-binding claim: round 2 said the canonical `*-review-latest.md` *pathnames* are OID-bound to
the Git index (false — only a derived content-addressed archive copy is); round 3 found the fix's
concluding sentence then swung too far the other way, claiming an unstaged edit to "any" listed
input (including canonical verdicts) is invisible to the commit — also false, because when the gate
passes, a byte-identical archive copy of the exact reviewed canonical content IS guaranteed to be in
the commit, even though the pointer pathname itself may commit different bytes.

**Current fix:** the paragraph now states plainly — the gate/caller reads canonical content via
`readFileSafe(req.file)` and passes it to `hasArchivedCopy()`, which derives and OID-compares only
the content-addressed archive path, never the canonical pointer path's own index entry; canonical
verdicts are a real exception to the "invisible to the commit" problem (their reviewed content is
captured via the archive), while policy, the review queue, calibration contract/evidence, and
prompt packets have no equivalent guarantee and are genuinely invisible when edited unstaged.

**BLIND REVIEW:** review independently. Do not read the other reviewer's saved output for this
scope before saving your own verdict.

### Required Skills
- `.claude/skills/artifact_qa_gate.md` shared core
- Antigravity Overlay
- `superpowers:using-superpowers`
- `superpowers:verification-before-completion`

## Reviewed Queue
- `docs/agent-harness.md` (limitation 1's paragraph; limitation 2 is unchanged since round 1)

## What To Verify
- Read the gate's main check-A loop and `hasArchivedCopy()` together and confirm: who reads the
  canonical verdict content (the loop, via `readFileSafe`), and what `hasArchivedCopy()` itself
  receives as its `content` parameter vs. what path it independently derives and OID-checks.
- Independently confirm, using real `git ls-files --stage` / working-tree hash-object output on
  this repo's current canonical pointer files, that their index OIDs differ from their working-tree
  OIDs right now, while a byte-identical archive copy under `.claude/reviews/**` does have a
  matching staged OID.
- Confirm the "real exception, not another instance" framing is accurate and doesn't overclaim or
  underclaim relative to the other four working-tree-only inputs (policy, queue, calibration,
  packets), which have no archive-copy equivalent at all.

### Runtime Boundary And Mock Audit
Pure documentation change. No code, hook, application, database, Supabase, or production runtime
boundary is touched. Verification is direct source-reading plus real `git` OID inspection of this
repo's actual current state — no mocks involved.

### Claim And State Audit
- Packet claim: limitation 2 has been stable and confirmed accurate since round 1 — no need to
  re-derive it, though a fresh spot-check is welcome.
- Packet claim: this is the only currently-queued file; no other batch is in flight.
