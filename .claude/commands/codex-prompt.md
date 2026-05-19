# /codex-prompt

Generate a complete, self-contained Codex review prompt for all files in `.claude/review-queue.txt`.
Write the prompt to `.claude/codex-prompt-latest.md` so the human can open it and paste it into the Codex app.

## Steps

1. Read `.claude/review-queue.txt`. If it is empty or missing, tell the user there is nothing to review and stop.

2. Read the following context files in full:
   - `CODEX.md`
   - `AGENTS_ROSTER.md`
   - `AGENTS.md`
   - `SPEC.md`
   - `docs/schema-contract.md`
   - `docs/review-severity.md`
   - `docs/verification.md`

3. Read each file listed in the review queue.

4. Write the complete Codex prompt to `.claude/codex-prompt-latest.md` using this structure:

```
# Codex Review Request — Gotta Go

## Your Role
[Paste full contents of CODEX.md here]

## Agent Coordination Rules
[Paste relevant sections of AGENTS_ROSTER.md and AGENTS.md here — roles, workflow, non-negotiables]

## Product Spec
[Paste full contents of SPEC.md here]

## Schema Contract
[Paste full contents of docs/schema-contract.md here]

## Verdict Definitions
[Paste full contents of docs/review-severity.md here]

## Verification Commands
[Paste full contents of docs/verification.md here]

---

## Files To Review

[For each file in review-queue.txt:]
### <file path>
\`\`\`<language>
<full file contents>
\`\`\`

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

### Approved
- What is correct or ready to merge.
```

5. After writing the file, tell the user:
   - The prompt is ready at `.claude/codex-prompt-latest.md`
   - Open that file, copy all contents, and paste into the Codex app
   - After Codex returns its verdict, share it here so Claude can address any findings

6. If the returned Codex verdict is APPROVE, and Gemini also returned APPROVE:
   - Claude may proceed to commit
   - Clear `.claude/review-queue.txt` after the commit

7. If BLOCK or REQUEST CHANGES:
   - Claude fixes all findings
   - Re-runs `/gemini-review` and `/codex-prompt` on the affected files
   - Does not commit until both reviewers return APPROVE

## Notes

- This command exists because Codex is a GUI app, not a CLI. The human must perform the paste step.
- The generated prompt is intentionally verbose — Codex needs full context to review correctly.
- Always run `/gemini-review` first (architectural correctness), then `/codex-prompt` (implementation quality).
- If the queue has more than ~10 files, split into logical groups and generate one prompt per group.
