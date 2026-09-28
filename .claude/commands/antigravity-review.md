# /antigravity-review

Same flow as `/codex-prompt`: follow `.claude/commands/codex-prompt.md`. One script, `node .claude/hooks/review-packets.js`, writes both blind packets (Antigravity and Codex) from `.claude/review-claims.md`.

For a low-tier batch (Markdown under `docs/` (except `docs/agent-harness.md`, `docs/review-severity.md`, `docs/schema-contract.md`, and `docs/legal/`) or `AGENTS_ROSTER.md` only, declared `risk_level: low`, with `lowRiskCodexOnly` on; the rule is in `AGENTS.md`), no Antigravity packet is written and Antigravity is not required. The script says so in its output.

When the Antigravity packet is written, the user runs:

```bash
agy -p "You are Antigravity reviewing Gotta Go. Read .claude/antigravity-prompt-latest.md and .claude/antigravity-review-policy.json in full. Review independently without reading any other reviewer's verdict. Apply the packet's required skills and evidence contract. Write the verdict to .claude/antigravity-review-latest.md, then run node .claude/hooks/archive-review-artifact.js antigravity, and print the same verdict."
```

If `agy` is unavailable but `antigravity` is available, use the same prompt with `antigravity -p`.

During probation, Antigravity's allowed verdicts are ADVISORY, REQUEST CHANGES, and BLOCK. Its verdict must include `### Reviewed Queue`, `### Skills Applied`, `### Claim And State Audit`, and `### Runtime Boundary Check`, and must repeat the packet's `scope_hash` and `review_id`.
