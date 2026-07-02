# Skill: Review Packet Generator

## Purpose
Generate the Antigravity and Codex review packets correctly, so neither reviewer has to infer scope from chat history and every review is artifact-driven per [docs/agent-harness.md](file:///C:/Users/mrsai/Gotta%20Go/docs/agent-harness.md).

## Workflow
1. Confirm `.claude/review-queue.txt` lists exactly the files changed for the current task, with no stale entries from a prior, already-reviewed task.
2. Write the Antigravity packet to `.claude/antigravity-prompt-latest.md`, then run `/antigravity-review`. Antigravity reads the file, inspects the actual files on disk, and returns a verdict. Save it to `.claude/antigravity-review-latest.md`.
3. Write the Codex packet to `.claude/codex-prompt-latest.md` after Antigravity returns. Include Antigravity's result or summary. Codex reads the file, inspects files on disk, runs practical verification, and returns a verdict. Save it to `.claude/codex-review-latest.md`.
4. Every packet must include, per the "Prompt Packet Requirements" section of `docs/agent-harness.md`: task goal and phase; changed files from `.claude/review-queue.txt`; relevant project context and constraints; actual file contents or an explicit diff; runtime-boundary context; mock-boundary context; verification commands already run and their outcomes; known caveats or missing tooling; the required output format and verdict definitions from [docs/review-severity.md](file:///C:/Users/mrsai/Gotta%20Go/docs/review-severity.md).
5. Runtime-boundary context means the nearest callers/callees, providers, route guards, hooks, RPCs, migrations, policies, scheduled jobs, external callbacks, and production wiring that can affect the changed behavior.
6. Mock-boundary context means tests that replace any of those boundaries, plus a direct prompt for the reviewer to decide whether production behavior could differ from the test.
7. Keep packets self-contained but not bloated. Prefer focused excerpts, exact diffs, full changed files, and the relevant dependency chain over pasting every project document wholesale.
8. Never include secrets, service-role keys, auth tokens, `.env` values, or precise user location data in a packet.
9. BLOCK and REQUEST CHANGES findings must be fixed and the affected files re-enter the queue for both reviewers before commit. No commit without APPROVE from both, per the Minimum Commit Gate in `docs/agent-harness.md`.
