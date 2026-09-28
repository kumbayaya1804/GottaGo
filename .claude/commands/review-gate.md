# /review-gate

Prepare the full review gate for the current task. This command coordinates an internal code-review pre-check, reviewer packet generation, and final commit readiness. Claude prepares artifacts; the user runs the external reviewer CLIs.

## Order

1. Internal pre-check with Claude Code's built-in `/code-review` on the task's changes. It is not an approval; the reviewers remain the gate.
2. Write the task's claims and run `node .claude/hooks/review-packets.js`. It stages the exact queue, computes the `scope_hash`, a shared `review_id`, and the risk tier, and writes the blind packets before any reviewer runs.
3. Full tier: user-run Antigravity verdict saved and archived. Low tier: skipped.
4. User-run Codex verdict saved and archived without access to any Antigravity output.
5. Compare only after every required initial verdict is archived.
6. Fix and re-review all BLOCK and REQUEST CHANGES findings as new attempts. Findings in lines the batch did not change are follow-ups, not blockers (see the follow-up rule in `.claude/skills/artifact_qa_gate.md`).

## Inputs

- Scope is always the files in `.claude/review-queue.txt`.
- Optional `/code-review` effort level (`low` through `max`). Default: `medium`.

`/code-review` here means Claude Code's built-in review command (listed as `code-review`, with no plugin prefix). It is not the `engineering:code-review` plugin skill, which takes a PR URL. Invoke it as `/code-review [low|medium|high|xhigh|max] [path ...]`, passing the queued paths; with no target it reviews the current diff.

## Steps

1. Confirm `.claude/review-queue.txt` lists only current task files. Remove stale entries only with explicit confirmation that they belong to a closed task.
2. Run `/code-review medium` once on the queued paths. Fix what it finds that holds up, with the same TDD and verification rules as any change, before generating packets. Re-run it only after a fix that changes logic, not after a wording fix. Its findings are Claude's own check, not reviewer evidence. If the built-in command is unavailable in the session, do not substitute another tool and do not stall: note "pre-check unavailable" in the claims file's Verification section and continue.
3. Write `.claude/review-claims.md` and run `node .claude/hooks/review-packets.js` (see `/codex-prompt`). Any later edit to a queued file changes the `scope_hash`, so do all pre-check fixes first.
4. Full tier only: ask the user to run Antigravity with the command the script printed; require the policy-allowed verdict and append-only archive.
5. Ask the user to run Codex with the command the script printed; do not provide any Antigravity verdict, and require its append-only archive.
6. After every required initial verdict is archived, compare findings and resolve conflicts. Record each follow-up as a file in `.planning/todos/pending/`.
7. After Codex is APPROVE (and, in the full tier, Antigravity has its policy-allowed verdict), verify freshness:
   - run `node .claude/hooks/check-review-artifacts.js`; this is the first point at which the full cross-review gate may run
   - queue matches changed files
   - prompt manifests match current queue
   - required verdicts reference the current scope and `review_id`
   - verdicts satisfy evidence, blind-review, runtime, and archive requirements
   - relevant verification has run or blockers are documented
8. Commit only after the minimum gate in `docs/agent-harness.md` is satisfied, and only with the user's go-ahead.

## Stop Conditions

- Missing or empty review queue.
- Missing required reviewer verdict.
- Missing append-only verdict archive.
- BLOCK or REQUEST CHANGES from any reviewer, including an Antigravity objection on a low-tier batch.
- Reviewer verdict scope does not match current queue/diff.
- Relevant stale-info finding is unresolved and not explicitly deferred.

## Non-Negotiables

- Do not run reviewers on stale packets.
- Do not run the full cross-review artifact gate from either blind reviewer process; use its fingerprint-only form until every required initial verdict is archived.
- Do not approve from summaries.
- Do not treat probationary Antigravity `ADVISORY` as approval.
- Do not skip Codex for any batch.
- Do not clear `.claude/review-queue.txt` until after commit.
