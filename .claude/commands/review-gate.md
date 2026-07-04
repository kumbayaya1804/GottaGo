# /review-gate

Run the full three-part review cycle on the current active phase (or a specified phase). This command is the mandatory entry point for all code review. Never run `/antigravity-review` or `/codex-prompt` independently — always use this command so all three reviewers run in the correct order.

## Order

1. **GSD code review** (`/gsd-code-review <phase>`) — Claude's systematic file-by-file pass
2. **Antigravity review** (`/antigravity-review`) — architectural, PostGIS, RLS, trust math
3. **Codex prompt** (`/codex-prompt`) — security, privacy, TypeScript, test quality

All three must complete before any commit is allowed. BLOCK or REQUEST CHANGES from any reviewer stops the line.

## Arguments

- Phase number (optional) — defaults to current active phase from GSD state
- `--depth=quick|standard|deep` — passed to GSD code review (default: standard)

## Steps

### Step 1 — GSD Code Review

Invoke the `/gsd-code-review` skill with the phase argument and depth flag.

Wait for the review to complete and `01-REVIEW.md` (or equivalent) to be created in the phase directory. Commit the REVIEW.md artifact.

### Step 2 — Antigravity Review

Immediately after GSD review completes, run `/antigravity-review` on the **same set of files** that GSD reviewed (from `.claude/review-queue.txt`).

Do not skip this step. Antigravity owns:
- PostGIS query correctness (ST_DWithin, SRID, meter semantics, geographic vs geometry)
- RLS policy placement (shadowban + soft-delete at DB layer, not UI layer)
- Trust and confidence math
- Materialized view refresh strategy
- Architecture and tier boundaries
- Edge cases: null coordinates, expired flags, zero trust scores

Save Antigravity's verdict to `.claude/antigravity-review-latest.md`.

If Antigravity returns BLOCK or REQUEST CHANGES:
- Fix all findings before proceeding
- Re-run `/antigravity-review` on affected files
- Do not proceed to Step 3 until Antigravity returns APPROVE

### Step 3 — Codex Prompt

Immediately after Antigravity returns APPROVE, run `/codex-prompt` to generate `.claude/codex-prompt-latest.md`.

The Codex prompt must include:
- Full CODEX.md context
- All files from `.claude/review-queue.txt`
- Antigravity verdict (from `.claude/antigravity-review-latest.md`)
- GSD code review findings (from phase REVIEW.md)
- Verification evidence (what passed, what could not be run)

Tell the user: "The Codex prompt is ready at `.claude/codex-prompt-latest.md`. Open it, copy all contents, paste into the Codex app. After Codex returns its verdict, paste it here so Claude can address any findings."

### Step 4 — Resolve and Commit

After Codex returns its verdict:
1. Copy Codex's verdict to `.claude/codex-review-latest.md`
2. If APPROVE from both Antigravity and Codex: proceed to commit
3. If BLOCK or REQUEST CHANGES from either: fix all findings, re-run the affected reviewer(s)
4. Commit only when both reviewers return APPROVE
5. Clear `.claude/review-queue.txt` after commit
6. Advance GSD phase state

## Non-Negotiables

- Never skip Antigravity. It is the primary validator for all SQL, RLS, and trust-engine correctness.
- Never skip Codex prompt generation. Even if Codex returns APPROVE quickly, the artifact must exist.
- Never commit with an outstanding BLOCK.
- Never bypass with `--no-verify`.
- Each reviewer inspects the actual files — not the other reviewer's summary.
