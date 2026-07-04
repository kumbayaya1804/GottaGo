# Antigravity Review Packet — Quick Task 260704-0kt: Harness Integrity Fix Batch (Round 2)

**Date:** 2026-07-04
**Requested verdict format:** Antigravity review format per `ANTIGRAVITY.md` § Output Format, including the mandatory **Runtime Boundary Check** section. Verdict will be saved to `.claude/antigravity-review-latest.md`.

## Round 2 — What Changed Since Your Round 1 APPROVE

You approved this batch in Round 1. Codex's independent pass then found a MAJOR defect in the T1 hook fix you approved: the rooted-path check only recognized a backslash-prefixed root. `[System.IO.Path]::IsPathRooted` also returns true for forward-slash absolute paths (e.g. `C:/Users/.../AGENTS.md`), so such a path took the "rooted" branch, failed the backslash-only prefix test, `$rel` stayed null, and the file was silently dropped from the queue — the exact silent-failure class the fix was meant to close, reached via a different separator style. Codex reproduced this with the exact fixture `C:/Users/.../Gotta Go/AGENTS.md`.

**Fix applied:** `.claude/settings.json` PostToolUse hook now normalizes both `$root` and `$fp` to forward slashes (`$rootFwd`, `$fpFwd`) before the rooted-prefix comparison, and uses `$fpFwd` directly for the relative-path branch (removing the now-redundant trailing `-replace`). Only `.claude/settings.json` changed in Round 2 — the other four files are unchanged from your Round 1 APPROVE.

**Re-verification:** 7 cases run against the extracted, fixed command — backslash absolute in-repo, duplicate, out-of-repo backslash, Codex's exact forward-slash absolute in-repo repro, out-of-repo forward-slash, relative backslash, relative forward-slash. All pass; queue contains exactly the 4 expected entries, no duplicates, no out-of-repo leakage. `settings.json` still parses via `node -e "JSON.parse(...)"`.

Please re-review `.claude/settings.json` specifically for this fix, and confirm your Round 1 approval of the other four files still stands.

## Your Role And Context (read from disk)

Read in full: `ANTIGRAVITY.md`. Consult as needed: `docs/agent-harness.md` (harness contract this change modifies), `docs/review-severity.md` (verdict definitions), `AGENTS.md`, `AGENTS_ROSTER.md`. This is a **process/harness change set** — no app code, no SQL, no PostGIS, no RLS. Your review dimensions here are: correctness of the hook logic, integrity of the review-gate machinery, and cross-document consistency of the harness contract.

## Task Goal

A 2026-07-04 audit of the Claude/Antigravity/Codex harness found five defects. This change set fixes all five:

1. **`.claude/settings.json` (PostToolUse hook):** The hook appended raw absolute Windows paths (`C:\Users\mrsai\Gotta Go\app\...`) to `.claude/review-queue.txt`. The pre-commit gate `.claude/hooks/check-review-artifacts.js` intersects queue entries with `git diff --cached --name-only` (repo-relative, forward slashes) — absolute entries never match, so the gate silently no-ops. Verified empirically before the fix. The fix relativizes against the project root (hook CWD), flips to forward slashes, and skips out-of-repo files entirely.
2. **`.claude/commands/antigravity-review.md`:** Step 4 invoked `antigravity -p $prompt` with the entire multi-document packet inline — this exceeds Windows' ~32K command-line limit and fails silently (established during WU-02-T5). Fixed: packet still written to `.claude/antigravity-prompt-latest.md` (unchanged), invocation now a short prompt directing Antigravity to read the packet from disk. Note `docs/agent-harness.md` § Standard Flow step 4 *already* described the read-from-disk contract — the command script was the drifted artifact. **You are being invoked via the new pattern right now.**
3. **`AGENTS_ROSTER.md` output formats:** Both reviewer format blocks predate the 2026-07-02 process change (`c2e1e33`) and lacked the mandatory "Runtime Boundary Check" section — a reviewer following the roster produces a verdict the commit hook rejects. Fixed: section added with wording byte-identical to `ANTIGRAVITY.md`/`CODEX.md`, plus precedence notes making those files canonical.
4. **`.claude/settings.json` (Stop hook):** The "Reviewers needed before committing" reminder fired unconditionally on every turn end. Fixed: emits only when the review queue has at least one non-blank line.
5. **`.claude/commands/review-gate.md`:** Stale "on Phase 1" wording → "on the current active phase".

## Changed Files (review queue)

- `.claude/settings.json`
- `.claude/commands/antigravity-review.md`
- `.claude/commands/review-gate.md`
- `AGENTS_ROSTER.md`
- `AGENTS.md`

Inspect all five from disk. The exact diff against HEAD is reproducible with:
`git diff HEAD -- .claude/settings.json .claude/commands/antigravity-review.md .claude/commands/review-gate.md AGENTS_ROSTER.md AGENTS.md`

## Dependency Call Chains

These are configuration/instruction artifacts; their "callers" are the tools and agents that execute them:

- `.claude/settings.json` PostToolUse hook → writes `.claude/review-queue.txt` → consumed by (a) `.claude/hooks/check-review-artifacts.js` (invoked from `.beads/hooks/pre-commit`; intersects queue with staged files; requires the four review artifacts to carry required headings), (b) `/antigravity-review` (`$files = Get-Content .claude\review-queue.txt`), (c) `/codex-prompt` (same). **Read `.claude/hooks/check-review-artifacts.js` and `.beads/hooks/pre-commit` from disk** — they are unchanged by this change set and define the matching contract the hook fix must satisfy.
- `.claude/settings.json` Stop hook → emits a systemMessage consumed by the Claude Code harness at turn end.
- `.claude/commands/antigravity-review.md` → executed by Claude to invoke you; its output artifacts (`antigravity-prompt-latest.md`, `antigravity-review-latest.md`) are checked by `check-review-artifacts.js` for the headings "Runtime Boundary And Mock Audit" (packet) and "Runtime Boundary Check" (verdict).
- `AGENTS_ROSTER.md`/`AGENTS.md` → required startup reading for all three agents; the roster's format blocks are followed by reviewers when producing verdicts.
- `.claude/commands/review-gate.md` → orchestrates the GSD → Antigravity → Codex chain.

## Runtime Boundary And Mock Audit

- **Real runtime boundaries:** (1) Claude Code hook runtime executes the two PowerShell one-liners under `powershell.exe` (5.1) with CWD = project root, JSON on stdin; (2) `git` pre-commit executes `check-review-artifacts.js` via Node; (3) the `antigravity` CLI receives the short prompt as its literal command line. There are no application-runtime boundaries (no providers, routes, RPCs, migrations) in scope.
- **Mock/test boundary:** hook verification was performed by *extracting the command strings from the edited settings.json* (post-JSON-escaping — the exact artifact the runtime will execute) and running them under `powershell.exe` in a scratch fake project root with piped JSON fixtures. What this does NOT prove: that Claude Code's hook runtime passes CWD = project root (asserted from platform behavior; these project hooks only load when the session is rooted at the project, in which case CWD is the project root) and that `tool_input.file_path` is always absolute (a defensive relative-path branch is retained regardless).
- **Ordering/failure paths to verify:** (a) the queue file is created on first use if missing; (b) an out-of-repo path is *dropped* rather than queued — confirm you agree this is fail-safe (an absolute out-of-repo entry was previously un-reviewable noise that also weakened the gate's intersection semantics); (c) hooks-snapshot timing: settings.json changes take effect at next session start, so the in-flight session's queue was hand-set to the five files above — confirm the queue content matches the actual change set.
- **Silent-failure audit:** the entire point of fixes 1 and 2 is removing two silent-failure modes (gate no-op on path mismatch; 32K CLI truncation). Verify no new silent path was introduced — in particular the hook has no output channel in either the queued or dropped case (statusMessage is static), which is pre-existing behavior, unchanged.

## Verification Context

Commands run this session:
- `ConvertFrom-Json` parse of edited `.claude/settings.json` → OK.
- PostToolUse hook (extracted from edited JSON), 5 cases: in-repo absolute → `app/src/foo.ts`; duplicate → single entry; out-of-repo absolute → skipped; relative backslash path → `docs/agent-harness.md`; no `file_path` key → no-op. All pass.
- Stop hook (extracted), 3 cases: populated queue → systemMessage JSON; missing queue file → no output; empty queue file → no output. All pass.
- Repo-wide grep: no live instruction file retains an inline-packet `antigravity -p` invocation (`.beads/context/*` historical notes describe the failure mode and prescribe the same workaround — consistent, untouched).
- App suite not re-run: no `app/` files in scope (last green: 25 suites / 200 tests, this session, commit `bc9a52b`).
- GSD self-review: `.planning/quick/260704-0kt-harness-integrity-fix-batch-queue-path-n/260704-0kt-REVIEW.md` (PASS, 0 blocking).

## Required Output

Return your verdict in the `ANTIGRAVITY.md` § Output Format, including Issues (with exact file:line), Concerns, Verification (commands you ran), **Runtime Boundary Check**, and Approved sections. Print the full verdict to stdout.
