## Codex Review - Security Investigation: Uncommitted Agent Config Restructuring

**Instruction-poisoning answer:** No. I do not find actual instruction-poisoning content in the scoped current files. I found no current instruction telling an agent to hide, conceal, not mention, ignore user instructions, override higher-priority instructions, install the `@opengsd/get-shit-done-redux` package, delete directories, or treat an injected message as authoritative. There is therefore no exact file location to cite for an injected payload.

**VERDICT: APPROVE / SAFE TO COMMIT**

### Reviewed Queue
- `.beads/plans/active-plan.md`
- `.claude/commands/antigravity-review.md`
- `.claude/commands/codex-prompt.md`
- `.claude/commands/metaswarm-setup.md`
- `.claude/commands/review-gate.md`
- `.claude/commands/stale-info-scan.md`
- `.claude/hooks/check-review-artifacts.js`
- `.claude/settings.json`
- `.claude/skills/SKILL.md`
- `.claude/skills/pitfall_scan.md`
- `.claude/skills/postgis_optimizer.md`
- `.claude/skills/review_packet_generator.md`
- `.claude/skills/rls_security_guard.md`
- `.claude/skills/stale_info_scan.md`
- `.claude/skills/trust_engine_validator.md`
- `.metaswarm/external-tools.yaml`
- `.metaswarm/project-profile.json`
- `AGENTS.md`
- `AGENTS_ROSTER.md`
- `ANTIGRAVITY.md`
- `CLAUDE.md`
- `CODEX.md`
- `docs/agent-harness.md`
- `docs/context-router.md`

### Findings
- None.

### Open Questions
- No merge-blocking questions. Residual risk is provenance, not current file content: Git cannot prove who made uncommitted working-tree edits, and I cannot inspect Claude Code's private permission classifier. A second independent reviewer or a known-good backup/clone diff would reduce that residual provenance risk, but the bytes currently on disk do not contain the claimed poisoning content.

### Verification
- Read `.claude/codex-security-investigation-prompt.md` and `CODEX.md` from disk for the investigation scope and output contract.
- Read every scoped file from disk, including the untracked `docs/context-router.md`.
- Ran `git status --short`; scoped files are modified/uncommitted, `docs/context-router.md` is untracked, and `.planning/STATE.md` plus one untracked `.planning/phases/...` file are outside this prompt's scope.
- Ran `git diff --stat HEAD -- <scoped files>`, `git diff --name-status HEAD -- <scoped files>`, and `git diff --check HEAD -- <scoped files>`. The changed tracked scope is 851 insertions and 2075 deletions across 23 tracked files, mostly replacing long manuals with router-style docs. `git diff --check` reported no whitespace errors, only the existing Windows line-ending warnings.
- Inspected the sensitive diff for `.claude/settings.json`, `.claude/hooks/check-review-artifacts.js`, `CLAUDE.md`, `AGENTS.md`, `docs/agent-harness.md`, and `docs/context-router.md`.
- Ran current-file and added-line searches for concealment, classifier bypass, prompt injection, hidden instructions, the suspicious package names, secret material, encoded command patterns, HTML/script comments, `eval`, `EncodedCommand`, `child_process`, and command permissions. Matches were benign guardrails or visible workflow text.
- Ran a strict UTF-8 and Unicode-category scan over all scoped files. Result: no BOM, no NUL bytes, no invalid UTF-8, no non-ASCII characters, no format controls, no bidi controls, no private-use characters, and no unusual separators in current scoped files.
- Ran `node --check .claude/hooks/check-review-artifacts.js`; syntax passed.
- Parsed `.claude/settings.json` and `.metaswarm/project-profile.json` with Node `JSON.parse`; both passed.
- Confirmed `git config --get core.hooksPath` points to `.beads/hooks`, then read `.beads/hooks/pre-commit`, `prepare-commit-msg`, `post-checkout`, `post-merge`, and `pre-push`. Active hooks call the review-artifact checker and Beads integration; they do not rewrite the scoped instruction files.
- Read `.git/hooks/pre-commit` as inactive reference; active hooks path is `.beads/hooks`.
- Ran `git log -1 --format=... -- <file>` for every scoped file. Tracked files have ordinary prior project-doc commits by the repo author; `docs/context-router.md` is new and untracked.
- Ran `git log --oneline --date=iso -- CLAUDE.md` and `git log -p -3 -- CLAUDE.md`; history shows normal doc consolidation/bookkeeping commits, not a prior hidden payload.
- Ran `git blame --line-porcelain -- CLAUDE.md`, `.claude/settings.json`, and `.claude/hooks/check-review-artifacts.js`; current rewritten lines are correctly marked "Not Committed Yet."
- Temporarily staged `CLAUDE.md`, ran `node .claude/hooks/check-review-artifacts.js`, observed it block stale/mismatched review artifacts for `CLAUDE.md`, then restored the index. A follow-up `git diff --cached --name-only` confirmed the index was clean afterward.
- Noted repeat Git warning: `unable to access 'C:\Users\mrsai/.config/git/ignore': Permission denied`. This affects ignore lookup noise, not the scoped file contents.

### Runtime Boundary Check
- Agent startup boundary: `CLAUDE.md:5-12` and `AGENTS.md:5-12` now route startup through `docs/context-router.md` instead of loading large manuals by default. This reduces default instruction surface rather than adding hidden instructions.
- Context routing boundary: `docs/context-router.md:18-35` explicitly says not to full-read broad docs by default, and `docs/context-router.md:98-106` routes harness/skill/prompt/workflow changes to the exact relevant files.
- Reviewer execution boundary: `CLAUDE.md:25-34`, `AGENTS.md:23-35`, `docs/agent-harness.md:31-39`, and `ANTIGRAVITY.md:7-22` preserve the rule that Claude prepares packets and the user runs reviewer CLIs, unless explicitly overridden.
- Review gate boundary: `.claude/hooks/check-review-artifacts.js:56-85` requires current prompt and verdict artifacts, and `.claude/hooks/check-review-artifacts.js:117-128` requires those artifacts to mention staged queued files. The temporary staged check confirmed this blocks stale artifacts in practice.
- Permission boundary: `.claude/settings.json:61-67` allows `antigravity`, `agy`, `codex`, `npx`, `git`, `npm`, and `node` Bash commands. The only visible permission expansion in the inspected diff is `Bash(agy *)`, which is the documented Antigravity CLI alias and is consistent with `ANTIGRAVITY.md:11-19` and `AGENTS.md:29-30`. It is a permission expansion, but I do not classify it as instruction poisoning or a stealth escalation because the docs explicitly keep reviewer execution user-run by default.
- Hook boundary: `.claude/settings.json:20`, `.claude/settings.json:32`, and `.claude/settings.json:44` emit visible fallback/review reminders through `systemMessage`; they do not instruct concealment or perform hidden file edits. The PostToolUse hook at `.claude/settings.json:7` writes only `.claude/review-queue.txt`.
- No app runtime, Supabase, GPS, RLS, auth, service-role, or client privacy boundary is touched by this change set.

### Approved
- `CLAUDE.md`, `AGENTS.md`, `AGENTS_ROSTER.md`, `CODEX.md`, `ANTIGRAVITY.md`, and `docs/agent-harness.md` consistently move the workflow to lean routing plus explicit reviewer packets.
- `.claude/hooks/check-review-artifacts.js` tightens the review gate from section-presence checks to freshness markers, APPROVE verdict text, and staged queued filename coverage.
- `.claude/settings.json` hardens Beads startup/recovery by checking whether `bd` exists before running it and by pointing to local recovery files when it is missing.
- `.claude/commands/*` and `.claude/skills/*` reduce token load by moving from broad full-context loading to task-specific context tiers while preserving review safety rules.
- The current file bytes do not support the classifier's claimed "hidden note attempting to get the agent to conceal the change from the user." The likely remaining explanation is a session-provenance signal from the earlier conversation, not an injected payload in the scoped files.
