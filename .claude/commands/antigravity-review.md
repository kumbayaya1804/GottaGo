# /antigravity-review

Same flow as `/codex-prompt`: follow `.claude/commands/codex-prompt.md`. One script, `node .claude/hooks/review-packets.js`, writes the blind packets from `.claude/review-claims.md`: Codex's for every batch, and Antigravity's when the policy requires it for the batch.

Whether Antigravity is required for a batch is decided by the review policy (`.claude/antigravity-review-policy.json`). The rule, with every setting, is stated once in `AGENTS.md` ("Who reviews"). When Antigravity is not required, no Antigravity packet is written. The script prints the reviewers the batch requires.

When the Antigravity packet is written, the user runs:

```bash
agy -p "You are Antigravity reviewing Gotta Go. Read .claude/antigravity-prompt-latest.md and .claude/antigravity-review-policy.json in full. Review independently without reading any other reviewer's verdict. Apply the packet's required skills and evidence contract. Write the verdict to .claude/antigravity-review-latest.md, then run node .claude/hooks/archive-review-artifact.js antigravity, and print the same verdict."
```

If `agy` is unavailable but `antigravity` is available, use the same prompt with `antigravity -p`.

During probation, Antigravity's allowed verdicts are ADVISORY, REQUEST CHANGES, and BLOCK. Its verdict must include `### Reviewed Queue`, `### Skills Applied`, `### Claim And State Audit`, and `### Runtime Boundary Check`, and must repeat the packet's `scope_hash` and `review_id`.
