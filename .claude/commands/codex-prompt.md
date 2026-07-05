# /codex-prompt

Generate `.claude/codex-prompt-latest.md` for the files in `.claude/review-queue.txt`. Claude prepares the packet; the user runs Codex.

## Steps

1. Read `.claude/review-queue.txt`. If missing or empty, report that there is nothing to review and stop.
2. Read `docs/context-router.md` and `.claude/skills/review_packet_generator.md`.
3. Collect Tier 0 context:
   - queue entries
   - `git status --short`
   - `git diff HEAD -- <queue files>`
   - full queued files or explicit diffs
   - verification evidence and blockers
   - Runtime Boundary And Mock Audit
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
queue:
  - <path>
diff_base: HEAD
context_tier: 0|1|2
-->
```

7. Tell the user to run Codex, for example:

```powershell
codex exec --sandbox workspace-write "You are Codex reviewing Gotta Go. Read .claude/codex-prompt-latest.md in full, inspect every file it names from disk, run practical read-only verification where useful, write your verdict to .claude/codex-review-latest.md, and print the same verdict."
```

If the user chooses read-only sandboxing, tell them to capture stdout into `.claude/codex-review-latest.md`.

## Output

After writing the packet, report:

- packet path
- queued files
- selected context tier
- exact command for the user to run
- reminder that Codex must inspect files from disk and include `Runtime Boundary Check`
- reminder that Codex must list every inspected queue file under `### Reviewed Queue`

## Rules

- Do not paste the whole project into the packet.
- Do not include secrets, tokens, `.env` values, service-role keys, or precise user location data.
- Do not treat an old Codex verdict as current unless its scope matches the current queue and diff.
- Do not clear `.claude/review-queue.txt`; it is cleared only after commit.
