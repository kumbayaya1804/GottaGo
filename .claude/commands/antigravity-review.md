# /antigravity-review

Generate `.claude/antigravity-prompt-latest.md` for the files in `.claude/review-queue.txt`. Claude prepares the packet; the user runs Antigravity.

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
   - Antigravity verdict format from `ANTIGRAVITY.md`, including `### Reviewed Queue`
4. Add Tier 1 excerpts for PostGIS, RLS, trust, confidence, Supabase, migrations, schema, harness, or stale-info behavior only when touched by the queue.
5. Add nearest dependency files and tests that can change runtime behavior.
6. Use Tier 2 full-doc context only when the whole document is directly in scope.
7. Write `.claude/antigravity-prompt-latest.md` with a visible freshness header:

```md
<!-- review-manifest
reviewer: antigravity
generated_at: <ISO timestamp>
queue:
  - <path>
diff_base: HEAD
context_tier: 0|1|2
-->
```

8. Tell the user to run Antigravity, for example:

```powershell
agy -p "You are Antigravity reviewing Gotta Go. Read .claude/antigravity-prompt-latest.md in full, inspect every file it names from disk, write your verdict to .claude/antigravity-review-latest.md, and print the same verdict."
```

If `agy` is unavailable but `antigravity` is available, use the same short prompt with `antigravity -p`.

## Output

After writing the packet, report:

- packet path
- queued files
- selected context tier
- exact command for the user to run
- reminder that Antigravity must inspect files from disk and include `Runtime Boundary Check`
- reminder that Antigravity must list every inspected queue file under `### Reviewed Queue`

## Rules

- Never inline the packet into the CLI command. Windows command-line limits can truncate it.
- Do not include secrets, tokens, `.env` values, service-role keys, or precise user location data.
- Do not treat an old Antigravity verdict as current unless its scope matches the current queue and diff.
- Do not clear `.claude/review-queue.txt`; it is cleared only after commit.
