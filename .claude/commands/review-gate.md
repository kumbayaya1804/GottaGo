# /review-gate

Prepare the full review gate for the current task. This command coordinates an internal code-review pre-check, Antigravity packet generation, Codex packet generation, and final commit readiness. Claude prepares artifacts; the user runs the external reviewer CLIs.

## Order

1. Internal pre-check with Claude Code's built-in `/code-review` on the task's changes. It is not an approval; Antigravity and Codex remain the gate.
2. Stage the exact queue and compute its deterministic `scope_hash`.
3. Generate both blind packets with a shared `review_id` before either reviewer runs.
4. User-run Antigravity verdict saved and archived.
5. User-run Codex verdict saved and archived without access to the Antigravity output.
6. Compare only after both initial archives exist.
7. Fix and re-review all BLOCK and REQUEST CHANGES findings as new attempts.

## Inputs

- Scope is always the files in `.claude/review-queue.txt`.
- Optional `/code-review` effort level (`low` through `max`). Defaults to the level last used.

`/code-review` here means Claude Code's built-in review command (listed as `code-review`, with no plugin prefix). It is not the `engineering:code-review` plugin skill, which takes a PR URL. Invoke it as `/code-review [low|medium|high|xhigh|max] [path ...]`, passing the queued paths; with no target it reviews the current diff.

## Steps

1. Confirm `.claude/review-queue.txt` lists only current task files. Remove stale entries only with explicit confirmation that they belong to a closed task.
2. Run `/code-review` on the queued paths. Fix what it finds that holds up, with the same TDD and verification rules as any change, before staging. Its findings are Claude's own check, not reviewer evidence. If the built-in command is unavailable in the session, do not substitute another tool and do not stall: note "pre-check unavailable" in both packets' verification table and continue.
3. Stage every queued path (including deletions), inspect `git diff --cached`, and compute `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`. Any later edit changes this hash, so do all pre-check fixes first.
4. Run `/antigravity-review` and `/codex-prompt` before opening either existing verdict.
5. Ask the user to run Antigravity with the short command shown by `/antigravity-review`; require the policy-allowed verdict and append-only archive.
6. Ask the user to run Codex with the short command shown by `/codex-prompt`; do not provide the Antigravity verdict and require its append-only archive.
7. After both initial verdict archives exist, compare findings and resolve conflicts.
8. After Codex is APPROVE and Antigravity has its policy-allowed verdict, verify freshness:
   - run `node .claude/hooks/check-review-artifacts.js`; this is the first point at which the full cross-review gate may run
   - queue matches changed files
   - prompt manifests match current queue
   - both verdicts reference current scope
   - both prompts and verdicts repeat the current staged `scope_hash`
   - both verdicts satisfy evidence, blind-review, runtime, and archive requirements
   - relevant verification has run or blockers are documented
9. Commit only after the minimum gate in `docs/agent-harness.md` is satisfied.

## Stop Conditions

- Missing or empty review queue.
- Missing reviewer verdict.
- Missing append-only verdict archive.
- BLOCK or REQUEST CHANGES from any reviewer.
- Reviewer verdict scope does not match current queue/diff.
- Relevant stale-info finding is unresolved and not explicitly deferred.

## Non-Negotiables

- Do not run reviewers on stale packets.
- Do not run the full cross-review artifact gate from either blind reviewer process; use its fingerprint-only form until both initial verdicts are archived.
- Do not approve from summaries.
- Do not treat probationary Antigravity `ADVISORY` as approval.
- Do not skip Codex for implementation, security, privacy, TypeScript, tests, or user-visible failure states.
- Do not clear `.claude/review-queue.txt` until after commit.
