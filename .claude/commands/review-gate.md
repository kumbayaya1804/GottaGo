# /review-gate

Prepare the full review gate for the current task. This command coordinates GSD review, Antigravity packet generation, Codex packet generation, and final commit readiness. Claude prepares artifacts; the user runs the external reviewer CLIs.

## Order

1. GSD code review for the scoped phase or files.
2. Antigravity packet generation with `/antigravity-review`.
3. User-run Antigravity verdict saved to `.claude/antigravity-review-latest.md`.
4. Codex packet generation with `/codex-prompt`.
5. User-run Codex verdict saved to `.claude/codex-review-latest.md`.
6. Fix and re-review all BLOCK and REQUEST CHANGES findings.

## Inputs

- Optional phase number. Defaults to current active phase from GSD state.
- Optional `--depth=quick|standard|deep` for GSD code review.

## Steps

1. Confirm `.claude/review-queue.txt` lists only current task files. Remove stale entries only with explicit confirmation that they belong to a closed task.
2. Run the installed GSD code-review command (`/gsd-code-review` or `/gsd:code-review`, depending on runtime) for the same scope.
3. Run `/antigravity-review` to write `.claude/antigravity-prompt-latest.md`.
4. Ask the user to run Antigravity with the short command shown by `/antigravity-review`.
5. After `.claude/antigravity-review-latest.md` exists and is APPROVE, run `/codex-prompt`.
6. Ask the user to run Codex with the short command shown by `/codex-prompt`.
7. After `.claude/codex-review-latest.md` exists and is APPROVE, verify freshness:
   - queue matches changed files
   - prompt manifests match current queue
   - both verdicts reference current scope
   - relevant verification has run or blockers are documented
8. Commit only after the minimum gate in `docs/agent-harness.md` is satisfied.

## Stop Conditions

- Missing or empty review queue.
- Missing reviewer verdict.
- BLOCK or REQUEST CHANGES from any reviewer.
- Reviewer verdict scope does not match current queue/diff.
- Relevant stale-info finding is unresolved and not explicitly deferred.

## Non-Negotiables

- Do not run reviewers on stale packets.
- Do not approve from summaries.
- Do not skip Antigravity for SQL, RLS, PostGIS, trust, confidence, or architecture.
- Do not skip Codex for implementation, security, privacy, TypeScript, tests, or user-visible failure states.
- Do not clear `.claude/review-queue.txt` until after commit.
