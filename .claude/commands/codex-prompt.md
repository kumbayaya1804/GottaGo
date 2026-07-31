# /codex-prompt

Generate `.claude/codex-prompt-latest.md` for the files in `.claude/review-queue.txt`. Claude prepares the packet; the user runs Codex.

## Steps

1. Read `.claude/review-queue.txt`. If missing or empty, report that there is nothing to review and stop.
2. Read `docs/context-router.md`, `.claude/skills/artifact_qa_gate.md`, `.claude/skills/review_packet_generator.md`, and `CODEX.md`.
3. Collect Tier 0 context:
   - stage the exact queue, including deletions, and inspect `git diff --cached`
   - run `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`
   - queue entries
   - `git status --short`
   - `git diff HEAD -- <queue files>`
   - full queued files or explicit diffs
   - verification evidence and blockers
   - a neutral claim table separating the implementation claim, authority source, required disproof, and evidence needed
   - Runtime Boundary And Mock Audit
   - shared Artifact QA Gate contract plus the Codex overlay
   - `### Required Skills` naming `.claude/skills/artifact_qa_gate.md`, the `Codex Overlay`, and task-relevant skills available in the Codex harness
   - Codex verdict format from `CODEX.md`, including `### Reviewed Queue`
4. Add Tier 1 excerpts only when the queued files require them:
   - product/user-flow excerpts for emergency UX or product guarantees
   - schema/RLS/PostGIS/trust excerpts for Supabase or migration changes
   - harness/stale-info excerpts for workflow, prompt, command, or review-gate changes
   - nearby callers, providers, route guards, hooks, RPCs, policies, migrations, and tests
5. Use Tier 2 full-doc context only when the whole document is directly in scope.
6. Write `.claude/codex-prompt-latest.md` with a visible freshness header:

```md
<!-- review-manifest
reviewer: codex
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

7. Do not read or include `.claude/antigravity-review-latest.md` or a named
   Antigravity verdict. The initial review is blind.
8. Tell the user to run Codex, for example:

```powershell
codex exec --sandbox workspace-write "You are Codex reviewing Gotta Go. Read .claude/codex-prompt-latest.md in full without reading any Antigravity verdict, inspect every queued file and material boundary, satisfy the packet evidence contract, write your verdict to .claude/codex-review-latest.md, run node .claude/hooks/archive-review-artifact.js codex, and print the same verdict."
```

If the user chooses read-only sandboxing, tell them to capture stdout into `.claude/codex-review-latest.md`.

The verdict must repeat the packet's exact `scope_hash:` line. If any queued path is
re-staged afterward, regenerate both reviewer packets and obtain both verdicts again.

## Output

After writing the packet, report:

- packet path
- queued files
- selected context tier
- exact command for the user to run
- reminder that Codex must inspect files from disk and include `Runtime Boundary Check`
- reminder that Codex must apply `.claude/skills/artifact_qa_gate.md` shared core plus its Codex overlay
- reminder that the verdict must include `### Skills Applied`
- reminder that Codex must list every inspected queue file under `### Reviewed Queue`
- reminder that runtime-required work needs executed runtime evidence for approval
- append-only archive path printed by `.claude/hooks/archive-review-artifact.js`

## Rules

- Do not paste the whole project into the packet.
- Do not include secrets, tokens, `.env` values, service-role keys, or precise user location data.
- Do not treat an old Codex verdict as current unless its scope matches the current queue and diff.
- Do not expose the other reviewer verdict before the initial Codex verdict is saved and archived.
- Do not overwrite or delete an archived verdict. A revision is a new attempt.
- Do not clear `.claude/review-queue.txt`; it is cleared only after commit.
