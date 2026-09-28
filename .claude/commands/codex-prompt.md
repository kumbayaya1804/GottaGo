# /codex-prompt

Generate the blind reviewer packets for the files in `.claude/review-queue.txt`. One script writes both packets, or only the Codex packet for a low-tier batch. Claude prepares the packets; the user runs the reviewers.

## Steps

1. Read `.claude/review-queue.txt`. If it is missing or empty, report that there is nothing to review and stop.
2. Read `docs/context-router.md`, `.claude/skills/artifact_qa_gate.md`, and `.claude/skills/review_packet_generator.md` for the evidence contract and context tiers.
3. Write `.claude/review-claims.md` (gitignored) for this task:

   ```md
   ---
   title: <short batch name>
   attempt: <1, 2, ...>
   risk_level: medium|high
   runtime_required: true|false
   context_tier: 0|1|2
   ---

   ## Task Goal
   ## Neutral Claim Table
   ## User Advocacy Gate
   ## Runtime Boundary And Mock Audit
   ## Verification
   ```

   - The claim table separates each implementation claim, its authority source, the disproof to attempt, and the evidence needed. Never state the conclusion you want.
   - On a later attempt, say what changed since the last one, without quoting either reviewer's verdict.
   - Add Tier 1 excerpts only when the queue touches that boundary. For a changed or recreated `SECURITY DEFINER` RPC, include its full body, return shape, generated types, later migrations, grants, and callers, and ask for an explicit return/filter/ACL assessment. When STATE, execution-state, or a handoff is queued, include the claims those documents must reconcile.
   - Name no model, and never name either reviewer's verdict file or tell a reviewer to run the full gate. The script refuses to write packets that do.
4. Run `node .claude/hooks/review-packets.js`. It:
   - stages the queue, including deletions;
   - computes the `scope_hash`, a new `review_id`, and the risk tier from the staged paths;
   - embeds the staged diffs, replacing any that name reviewer output with a read-from-disk pointer;
   - checks each packet against the gate's own requirements, and writes nothing if one fails.
5. Report what it printed: scope, review ID, tier, and the exact reviewer commands.

## Tiers

With `lowRiskCodexOnly` on in `.claude/antigravity-review-policy.json`, a batch whose every queued path is Markdown under `docs/` (except `docs/agent-harness.md`, `docs/review-severity.md`, `docs/schema-contract.md`, and `docs/legal/`) or `AGENTS_ROSTER.md`, and whose claims declare `risk_level: low`, is low tier: Codex only. Declaring `medium` or `high` sends it to both reviewers. Commands, skills, root agent files other than the roster, and all app, database, hook, settings, policy, and spec files keep both reviewers (the rule is in `AGENTS.md`). The gate computes the tier the same way, counting a rename as its old path plus its new path, so a packet cannot lower its own tier.

## Rules

- Never inline a packet into a CLI command; the command only points at the file.
- Do not include secrets, tokens, `.env` values, service-role keys, or precise user location data.
- Do not show either reviewer the other's verdict until both are saved and archived (`node .claude/hooks/archive-review-artifact.js antigravity|codex`).
- If any queued byte changes after the packets are written, run the script again; every verdict must carry the new `review_id`.
- Do not overwrite or delete an archived verdict. A revision is a new attempt.
- Do not clear `.claude/review-queue.txt`; it is cleared only after commit.
