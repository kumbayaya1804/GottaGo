# /antigravity-review

Generate `.claude/antigravity-prompt-latest.md` for the files in `.claude/review-queue.txt`. Claude prepares the packet; the user runs Antigravity.

## Steps

1. Read `.claude/review-queue.txt`. If missing or empty, report that there is nothing to review and stop.
2. Read `docs/context-router.md`, `.claude/antigravity-review-policy.json`, `.claude/skills/artifact_qa_gate.md`, `.claude/skills/review_packet_generator.md`, and `ANTIGRAVITY.md`. Carry the shared artifact-QA core, Antigravity overlay, adversarial-review discipline, and current policy into the packet; do not copy only the verdict headings.
3. Collect Tier 0 context:
   - stage the exact queue, including deletions, and inspect `git diff --cached`
   - run `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`
   - queue entries
   - `git status --short`
   - `git diff HEAD -- <queue files>`
   - full queued files or explicit diffs
   - verification evidence and blockers
   - a neutral claim table separating the implementation claim, authority source, required disproof, and evidence needed; do not state the desired reviewer conclusion
   - Runtime Boundary And Mock Audit across caller/client, resolver/driver, transport, kernel/container/proxy, server, auth rule, and resulting state
   - shared Artifact QA Gate contract plus the Antigravity overlay
   - `### Required Skills` containing:
     - `.claude/skills/artifact_qa_gate.md` shared core and `Antigravity Overlay`
     - `superpowers:using-superpowers`
     - `superpowers:verification-before-completion`
     - only the additional Superpowers and project domain skills whose triggers match this queue
   - Antigravity verdict format from `ANTIGRAVITY.md`, including `### Reviewed Queue` and `### Claim And State Audit`
4. Add Tier 1 excerpts for PostGIS, RLS, trust, confidence, Supabase, migrations, schema, harness, or stale-info behavior only when touched by the queue.
   - For a changed/recreated `SECURITY DEFINER` RPC, include its complete body, return shape, current generated table/RPC types, relevant later schema migrations, execute grants/revokes, and current callers. Ask for an explicit return/filter/ACL assessment; "unchanged" or "no caller" is not a safety conclusion.
   - When STATE, execution-state, a handoff, or a `*-latest` scan is queued, include the batch completion/deployment/verification claims needed to reconcile those active documents. Ask for an explicit contradiction check.
5. Add nearest dependency files and tests that can change runtime behavior.
6. Use Tier 2 full-doc context only when the whole document is directly in scope.
7. Write `.claude/antigravity-prompt-latest.md` with a visible freshness header:

```md
<!-- review-manifest
reviewer: antigravity
generated_at: <ISO timestamp>
scope_hash: <staged scope hash>
review_id: <opaque id shared by both blind packets>
risk_level: low|medium|high
runtime_required: true|false
blind_review: true
queue:
  - <path>
diff_base: HEAD
context_tier: 0|1|2
-->
```

8. Do not read or include `.claude/codex-review-latest.md` or a named Codex verdict. The
   initial review is blind.
9. Tell the user to run Antigravity, for example:

```powershell
agy --effort high -p "You are Antigravity reviewing Gotta Go. Use the strongest high-reasoning model selected for this CLI profile. Read .claude/antigravity-prompt-latest.md and .claude/antigravity-review-policy.json in full. Review independently without reading any Codex verdict. Apply the packet's required skills and evidence contract. Write the policy-allowed verdict to .claude/antigravity-review-latest.md, then run node .claude/hooks/archive-review-artifact.js antigravity, and print the same verdict."
```

If `agy` is unavailable but `antigravity` is available, use the same short prompt with `antigravity -p`.

The verdict must repeat the packet's exact `scope_hash:` line. If any queued path is
re-staged afterward, regenerate both reviewer packets and obtain both verdicts again.

## Output

After writing the packet, report:

- packet path
- queued files
- selected context tier
- exact command for the user to run
- reminder that Antigravity must inspect files from disk and include `Runtime Boundary Check`
- reminder that Antigravity must apply `.claude/skills/artifact_qa_gate.md` shared core plus its Antigravity overlay
- reminder that Antigravity must invoke the packet's Superpowers and project skills, including `superpowers:verification-before-completion`
- reminder that the verdict must include `### Skills Applied`
- reminder that Antigravity must include `Claim And State Audit` and apply every pre-positive-verdict gate from `ANTIGRAVITY.md`
- reminder that Antigravity must list every inspected queue file under `### Reviewed Queue`
- reminder that probation permits `ADVISORY`, `REQUEST CHANGES`, or `BLOCK`, not `APPROVE`
- reminder that `runtime_required: true` requires `runtime_evidence: executed` for a positive verdict
- append-only archive path printed by `.claude/hooks/archive-review-artifact.js`

## Rules

- Never inline the packet into the CLI command. Windows command-line limits can truncate it.
- Do not include secrets, tokens, `.env` values, service-role keys, or precise user location data.
- Do not treat an old Antigravity verdict as current unless its scope matches the current queue and diff.
- Do not expose the other reviewer verdict before the initial Antigravity verdict is saved and archived.
- Do not overwrite or delete an archived verdict. A revision is a new attempt.
- Do not clear `.claude/review-queue.txt`; it is cleared only after commit.
