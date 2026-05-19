# /gemini-review

Invoke the Gemini CLI on all files currently queued in `.claude/review-queue.txt`.

## Steps

1. Read `.claude/review-queue.txt`. If it is empty or missing, tell the user there is nothing to review and stop.

2. Read the following context files in full:
   - `GEMINI.md`
   - `AGENTS_ROSTER.md`
   - `AGENTS.md`
   - `SPEC.md`
   - `docs/schema-contract.md`
   - `docs/review-severity.md`

3. Read each file listed in the review queue.

4. Run the Gemini CLI with the combined prompt. Use the following bash command pattern, adjusting the file list from the queue:

```bash
gemini -p "$(cat GEMINI.md AGENTS_ROSTER.md AGENTS.md SPEC.md docs/schema-contract.md docs/review-severity.md; echo '---'; echo 'Review the following changed files. Return your verdict in the Gemini review format defined in GEMINI.md:'; for f in $(cat .claude/review-queue.txt | tr -d '\r'); do echo "=== FILE: $f ==="; cat "$f"; echo; done)"
```

5. Display the full Gemini response to the user.

6. Based on Gemini's verdict:
   - **APPROVE**: Inform the user Gemini has approved. Do not clear the queue yet — wait for Codex via `/codex-prompt`.
   - **REQUEST CHANGES**: List all findings by severity. Do not commit. Claude must fix all REQUEST CHANGES items before re-running.
   - **BLOCK**: Stop everything. List BLOCK findings clearly. No commit until all BLOCK items are resolved and Gemini re-reviews.

7. If the verdict contains both BLOCK/REQUEST CHANGES findings and APPROVE items, treat the overall verdict as the strictest level present.

## Notes

- Run this command after every non-trivial implementation task, before generating the Codex prompt.
- If Gemini CLI is not available (command not found), tell the user to install it and provide the manual prompt they can run themselves.
- Never skip this step to move faster. The review gate exists because PostGIS, RLS, and trust-engine correctness cannot be safely self-reviewed.
