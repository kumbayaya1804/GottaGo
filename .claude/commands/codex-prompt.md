# /codex-prompt

Generate a complete, self-contained Codex review prompt for all files in `.claude/review-queue.txt`.
Write the prompt to `.claude/codex-prompt-latest.md` so the human can open it and paste it into the Codex app.

## Steps

1. Read `.claude/review-queue.txt`. If it is empty or missing, tell the user there is nothing to review and stop.

2. Read the following context files. Include only the sections needed for the current review packet unless the whole file is directly relevant:
   - `CODEX.md`
   - `AGENTS_ROSTER.md`
   - `AGENTS.md`
   - `docs/agent-harness.md`
   - `SPEC.md`
   - `docs/schema-contract.md`
   - `docs/review-severity.md`
   - `docs/verification.md`
   - `docs/stale-info-scan.md`
   - `.claude/antigravity-review-latest.md` if present
   - `.planning/stale-info-scan-latest.md` if present

3. Read each file listed in the review queue.

4. Run `git status --short` and `git diff HEAD -- <queue files>` to get the verification context.

5. Locate dependent/calling files in `app/src` that import or route through the queued files. Search for import lines, route names, hook usage, provider/layout effects, RPC calls, and tests that mock the same boundary. Read the full content of relevant calling files, callee helpers, providers, route guards, migrations, policies, or tests needed to judge behavior. Keep this scoped to the nearest behavior boundary; do not dump unrelated project files.

6. Write the complete Codex prompt to `.claude/codex-prompt-latest.md` using this structure:

```
# Codex Review Request - Gotta Go

## Your Role
[Paste full contents of CODEX.md here, or the relevant sections if the packet would otherwise become noisy. Always include Quick Start, Review Priorities, Required Behavior During Review, Testing Expectations, and Review Output.]

## Agent Coordination Rules
[Paste only relevant sections of AGENTS_ROSTER.md and AGENTS.md: roles, workflow, artifact ownership, non-negotiables, and user advocacy checks.]

## Agent Harness
[Paste relevant sections of docs/agent-harness.md: harness principles, required artifacts, standard flow, scope rules, prompt packet requirements, and failure handling.]

## Product Spec
[Paste relevant SPEC.md excerpts for the reviewed behavior. If the change touches core product guarantees, include the full affected section.]

## Schema Contract
[Paste relevant docs/schema-contract.md excerpts for touched tables, RPCs, policies, or data contracts.]

## Verdict Definitions
[Paste full contents of docs/review-severity.md here.]

## Verification Commands
[Paste full contents of docs/verification.md here.]

## Stale Information Scan Protocol
[Paste relevant sections of docs/stale-info-scan.md here. Include full stale prompt drift rules when reviewing workflow, docs, planning, schema, generated types, dependencies, or review artifacts.]

---

## Antigravity Review
[Paste .claude/antigravity-review-latest.md here if present. If missing, state that Antigravity has not returned a saved artifact yet.]

## Latest Stale Information Scan
[Paste .planning/stale-info-scan-latest.md here if present. If missing, state that no saved stale-information scan is available.]

## Verification Context
=== Git Status ===
[Paste git status output here]
=== Git Diffs ===
[Paste git diff output here]

## Dependency Call Chains
[For each dependency file detected, paste:]
### === DEPENDENCY FILE: <file path> ===
```<language>
<full file contents>
```
If no dependency files are detected, state: "No external dependency files detected in app/src."

## Runtime Boundary And Mock Audit
- State the nearest callers/callees, providers, route guards, hooks, RPCs, migrations, policies, scheduled jobs, or external callbacks that can affect this change.
- State which tests mock those boundaries and whether that could hide production behavior.
- For auth, routing, GPS, Supabase writes, RLS-sensitive reads, trust/shadowban logic, or async UI flows, explicitly ask Codex to verify event ordering and failure paths.

## Files To Review

[For each file in review-queue.txt:]
### === FILE: <file path> ===
```<language>
<full file contents>
```

---

## Your Task

Review all files above. Return your verdict in the Codex review format:

## Codex Review - [list of files]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Runtime Boundary Check
- Call-path and mock-boundary assessment, including any production behavior not covered by tests.

### Approved
- What is correct or ready to merge.
```

7. After writing the file, tell the user:
   - The prompt is ready at `.claude/codex-prompt-latest.md`
   - Open that file, copy all contents, and paste it into the Codex app
   - Codex must read `.claude/codex-prompt-latest.md` before returning a verdict, then inspect the actual files from disk
   - If `.claude/codex-prompt-latest.md` is missing for a review request, Codex must report that instead of guessing the scope
   - After Codex returns, copy the verdict to `.claude/codex-review-latest.md` before committing
   - After Codex returns its verdict, share it here so Claude can address any findings

8. If the returned Codex verdict is APPROVE, and Antigravity also returned APPROVE:
   - Claude may proceed to commit
   - Clear `.claude/review-queue.txt` after the commit

9. If BLOCK or REQUEST CHANGES:
   - Claude fixes all findings
   - Re-runs `/antigravity-review` and `/codex-prompt` on the affected files
   - Does not commit until both reviewers return APPROVE

## Notes

- This command exists because Codex is a GUI app, not a CLI. The human must perform the paste step.
- The generated prompt should be self-contained but not bloated. Prefer focused excerpts plus full changed files, exact diffs, dependency call chains, and explicit runtime-boundary questions over pasting every project document wholesale.
- Always run `/antigravity-review` first (architectural correctness), then `/codex-prompt` (implementation quality).
- If the queue has more than ~10 files, split into logical groups and generate one prompt per group.
