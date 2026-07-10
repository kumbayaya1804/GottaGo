# /antigravity-review

Generate `.claude/antigravity-prompt-latest.md` for the files in `.claude/review-queue.txt`. Claude prepares the packet; the user runs Antigravity.

## Steps

1. Read `.claude/review-queue.txt`. If missing or empty, report that there is nothing to review and stop.
2. Read `docs/context-router.md`, `.claude/skills/review_packet_generator.md`, and `ANTIGRAVITY.md`. Carry Antigravity's adversarial-review discipline and approval gates into the packet; do not copy only the verdict headings.
3. Collect Tier 0 context:
   - stage the exact queue, including deletions, and inspect `git diff --cached`
   - run `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`
   - queue entries
   - `git status --short`
   - `git diff HEAD -- <queue files>`
   - full queued files or explicit diffs
   - verification evidence and blockers
   - Runtime Boundary And Mock Audit
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
queue:
  - <path>
diff_base: HEAD
context_tier: 0|1|2
-->
```

8. Tell the user to run Antigravity, for example:

```powershell
agy -p "You are Antigravity reviewing Gotta Go. Read .claude/antigravity-prompt-latest.md in full, treat its claims as untrusted until verified against every queued file, audit the complete resulting security and active-state surface, write your verdict to .claude/antigravity-review-latest.md, and print the same verdict."
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
- reminder that Antigravity must include `Claim And State Audit` and apply every pre-APPROVE gate from `ANTIGRAVITY.md`
- reminder that Antigravity must list every inspected queue file under `### Reviewed Queue`

## Rules

- Never inline the packet into the CLI command. Windows command-line limits can truncate it.
- Do not include secrets, tokens, `.env` values, service-role keys, or precise user location data.
- Do not treat an old Antigravity verdict as current unless its scope matches the current queue and diff.
- Do not clear `.claude/review-queue.txt`; it is cleared only after commit.
