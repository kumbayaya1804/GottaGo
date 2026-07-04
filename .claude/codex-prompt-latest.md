# Codex Review Request - Gotta Go (Round 2)

## Round 2 — Your Round 1 Finding Is Fixed

Your Round 1 REQUEST CHANGES found a MAJOR defect: the T1 hook only recognized a backslash-prefixed root, so a forward-slash absolute in-repo path (your exact repro: `C:/Users/.../Gotta Go/AGENTS.md`) took the rooted branch, failed the backslash-only prefix test, and was silently dropped from the queue.

**Fix applied to `.claude/settings.json` PostToolUse hook only** (the other four files are unchanged from Round 1): both `$root` and `$fp` are now normalized to forward slashes (`$rootFwd`, `$fpFwd`) before the rooted-prefix comparison, and `$fpFwd` is used directly for the relative-path branch.

**Re-verification:** re-ran your exact repro (`C:/Users/.../Gotta Go/AGENTS.md`) plus 6 other cases (backslash absolute, duplicate, out-of-repo backslash, out-of-repo forward-slash, relative backslash, relative forward-slash) against the extracted fixed command. Your repro now correctly queues as `AGENTS.md`; all other cases behave as in Round 1. `settings.json` still parses via `ConvertFrom-Json`/`JSON.parse`.

Please re-inspect `.claude/settings.json` from disk and confirm the fix closes the finding, and confirm your Round 1 approvals of the other four files still stand.

---

## Your Role

You are Codex, the senior implementation-quality reviewer and escalation engineer for Gotta Go. Read `CODEX.md` in full for your operating standard. This review is a **harness/process change set** — no app code, no PostGIS, no RLS, no GPS logic. Apply the sections of `CODEX.md` that generalize: read the actual queued files from disk before judging, trace call-paths and mock boundaries, report exact `file:line` findings, don't approve on intent alone. The security/privacy/GPS/RLS-specific guardrails in `CODEX.md` are out of scope for this change (nothing here touches Supabase, client trust, or location data) — flag if you disagree.

## Agent Coordination Rules

Full context in `AGENTS_ROSTER.md` and `AGENTS.md`. Relevant points for this review:
- Claude does not self-approve. This change requires both Antigravity APPROVE (received, see below) and Codex APPROVE before commit.
- Non-negotiable: never commit with a BLOCK outstanding; never bypass `--no-verify`.
- This exact change modifies `AGENTS_ROSTER.md` and `AGENTS.md` themselves (fixing stale content) — you are reviewing edits to the document that describes your own coordination contract.

## Agent Harness

Full contract in `docs/agent-harness.md`. This change touches the harness's own machinery:
- § "Required Review Artifacts" defines `.claude/review-queue.txt`, the four prompt/verdict files, and the stale-info-scan artifact — this change fixes how the first of those (the queue) gets populated.
- § "Minimum Commit Gate" requires Antigravity APPROVE + Codex APPROVE + reviewer verdicts in the commit message — unaffected by this change, just being exercised by it.
- § "Standard Flow" step 4 already documents "Antigravity reads this file [the packet], inspects files on disk" — i.e., the harness doc already specified the packet-file pattern this change brings the command script into alignment with. Confirm you read it the same way.

## Verdict Definitions

Full text in `docs/review-severity.md`. Given this is a harness/tooling change with no security-sensitive application code, expect verdicts to turn on: does the hook logic actually do what it claims (a defect here is a MAJOR — it either weakens or gives false confidence in the entire review gate), and is the documentation now internally consistent (defects here are MINOR/non-blocking unless they'd cause an agent to violate the gate).

## Verification Commands

Full text in `docs/verification.md`. This change touches no `app/` files, so the Expo/Jest/typecheck/lint commands in that doc do not apply. Verification for this change is: PowerShell execution of the hook command strings against fixture input, and cross-document grep for stale patterns.

## Stale Information Scan Protocol

Full text in `docs/stale-info-scan.md`. This change *is* a stale-info remediation for two of the five findings (T2: stale invocation pattern present in 3 files; T3: stale output-format blocks in the roster). Confirm the fixes are complete and no other live instruction file retains the pre-2026-07-02 format or the inline-packet invocation.

---

## Antigravity Review

```
## Antigravity Review - Harness Integrity Fix Batch (2026-07-04)

**VERDICT: APPROVE**

### Issues
- None.

### Concerns
- None.

### Verification
- **JSON Parsing Verification:** Verified that the updated PowerShell `PostToolUse` and `Stop` hooks in `.claude/settings.json` parse correctly via `ConvertFrom-Json`.
- **PowerShell -replace Regex Logic Test:** Tested PowerShell `-replace` behavior to verify that `$rel = $rel -replace '\\\\','/'` in the JSON string decodes to `$rel = $rel -replace '\\','/'` at execution time, which correctly replaces single backslashes in Windows paths with forward slashes.
- **Hook Output Logic Test:** Confirmed that the `Stop` hook only outputs a `systemMessage` when `.claude/review-queue.txt` contains at least one non-blank line.
- **Windows Command Length Verification:** Confirmed that writing the full prompt packet to `.claude/antigravity-prompt-latest.md` and invoking Antigravity with a short prompt referencing the file successfully bypasses Windows' ~32KB CLI length limitation.

### Runtime Boundary Check
- **Call-paths Traced:**
  - **Review Queue Logging:** Claude tool execution -> `PostToolUse` hook in `.claude/settings.json` -> relativizes `tool_input.file_path` against project root, flips to forward slashes -> appends to `.claude/review-queue.txt` -> read by `/antigravity-review` (`Get-Content .claude\review-queue.txt`) -> constructs packet in `.claude/antigravity-prompt-latest.md` -> invokes Antigravity with short prompt pointing to file.
  - **Commit Hook Validation:** `git commit` -> `.beads/hooks/pre-commit` -> runs `.claude/hooks/check-review-artifacts.js` via Node -> checks `.claude/review-queue.txt` against `git diff --cached --name-only` -> requires prompt/verdict files to exist and carry specific headings ("Runtime Boundary Check", "Runtime Boundary And Mock Audit").
- **Audit Findings:**
  - This is a harness configuration change set. No application features, database schemas, API endpoints, PostGIS queries, or RLS policies are affected.
  - Test suites and test mocks are unaffected by these harness changes.
  - Resolving absolute/relative path formatting issues prevents silent bypass of the commit gate and ensures queue matching behaves correctly.

### Approved
- Updates to `.claude/settings.json` (PostToolUse and Stop hooks) are approved.
- Short-prompt invocation pattern and command scripts in `.claude/commands/antigravity-review.md` and `.claude/commands/review-gate.md` are approved.
- Roster and agent role updates in `AGENTS_ROSTER.md` and `AGENTS.md` to enforce the "Runtime Boundary Check" output format and short prompt invocation are approved.
```

## Latest Stale Information Scan

`.planning/stale-info-scan-latest.md` exists but predates this session (regenerated during the 2026-07-03 audit, before this harness audit). Not directly evidence for this change; the five findings fixed here were surfaced by a separate, later harness-specific audit (documented in this session's conversation, not yet a `/stale-info-scan` artifact).

## Verification Context

=== Git Status ===
```
 M .claude/antigravity-prompt-latest.md
 M .claude/antigravity-review-latest.md
 M .claude/commands/antigravity-review.md
 M .claude/commands/review-gate.md
 M .claude/settings.json
 M AGENTS.md
 M AGENTS_ROSTER.md
?? .claude/codex-prompt-latest.md
?? .planning/quick/260704-0kt-harness-integrity-fix-batch-queue-path-n/
```

=== Git Diffs ===

```diff
diff --git a/.claude/commands/antigravity-review.md b/.claude/commands/antigravity-review.md
index 6603f6c..b645e55 100644
--- a/.claude/commands/antigravity-review.md
+++ b/.claude/commands/antigravity-review.md
@@ -20,7 +20,11 @@ Invoke the Antigravity CLI on all files currently queued in `.claude/review-queu

 3. Read each file listed in the review queue.

-4. Run the Antigravity CLI with the combined prompt. Include `docs/agent-harness.md`, `docs/stale-info-scan.md`, the latest stale-information scan if present, verification evidence, every file listed in `.claude/review-queue.txt`, and the nearest runtime-boundary files that can affect the changed behavior. Use the following PowerShell command pattern on Windows, adjusting the file list from the queue:
+4. Build the full review packet and write it to `.claude/antigravity-prompt-latest.md`. Include `docs/agent-harness.md`, `docs/stale-info-scan.md`, the latest stale-information scan if present, verification evidence, every file listed in `.claude/review-queue.txt`, and the nearest runtime-boundary files that can affect the changed behavior. Then invoke Antigravity with a SHORT prompt that points at the packet file — never pass the packet itself on the command line.
+
+   > **WHY (do not regress this):** Windows caps a process command line at ~32K characters. `antigravity -p "<full packet>"` exceeds that for any real packet and fails silently ("The filename or extension is too long"), leaving a stale or empty review artifact. Antigravity is itself an agentic CLI with filesystem access: give it a short prompt naming the packet file and it reads the packet and the queued files from disk itself. This is the pattern that carried the WU-02-T5/T6 reviews.
+
+   Use the following PowerShell command pattern on Windows, adjusting the file list from the queue:

 ```powershell
 $files = Get-Content .claude\review-queue.txt | Where-Object { $_.Trim() }
@@ -77,7 +81,15 @@ $prompt = @(
 ) -join "`n"

 $prompt | Set-Content -Path .claude\antigravity-prompt-latest.md
-$response = antigravity -p $prompt
+
+# SHORT prompt only — the packet stays on disk (Windows ~32K command-line limit; see step 4 note).
+$shortPrompt = @(
+  'You are Antigravity, reviewing for the Gotta Go project.'
+  'Read the review packet at .claude/antigravity-prompt-latest.md in full. It contains your role guide, project context, verification evidence, dependency call chains, the Runtime Boundary And Mock Audit instructions, and every changed file in scope.'
+  'Inspect the actual files it names from disk — the packet is review input, not a substitute for evidence.'
+  'Return your complete verdict in the Antigravity review format defined in ANTIGRAVITY.md, including the mandatory Runtime Boundary Check section. Print the full verdict to stdout.'
+) -join ' '
+$response = antigravity -p $shortPrompt
 $response | Set-Content -Path .claude\antigravity-review-latest.md
 $response
 ```
diff --git a/.claude/commands/review-gate.md b/.claude/commands/review-gate.md
index c3ec670..2742f47 100644
--- a/.claude/commands/review-gate.md
+++ b/.claude/commands/review-gate.md
@@ -1,6 +1,6 @@
 # /review-gate

-Run the full three-part review cycle on Phase 1 (or a specified phase). This command is the mandatory entry point for all code review. Never run `/antigravity-review` or `/codex-prompt` independently — always use this command so all three reviewers run in the correct order.
+Run the full three-part review cycle on the current active phase (or a specified phase). This command is the mandatory entry point for all code review. Never run `/antigravity-review` or `/codex-prompt` independently — always use this command so all three reviewers run in the correct order.

 ## Order

diff --git a/.claude/settings.json b/.claude/settings.json
index 25599f6..e1d3def 100644
--- a/.claude/settings.json
+++ b/.claude/settings.json
@@ -4,7 +4,7 @@
       {
         "hooks": [
           {
-            "command": "$j = [Console]::In.ReadToEnd() | ConvertFrom-Json; $fp = $j.tool_input.file_path; if ($fp) { $q = '.claude\\review-queue.txt'; if (!(Test-Path $q)) { New-Item -ItemType File -Path $q -Force | Out-Null }; $existing = Get-Content $q -ErrorAction SilentlyContinue; if ($existing -notcontains $fp) { Add-Content -Path $q -Value $fp } }",
+            "command": "$j = [Console]::In.ReadToEnd() | ConvertFrom-Json; $fp = $j.tool_input.file_path; if ($fp) { $root = (Get-Location).Path.TrimEnd('\\'); $rel = $null; if (-not [System.IO.Path]::IsPathRooted($fp)) { $rel = $fp } elseif ($fp.StartsWith($root + '\\', [System.StringComparison]::OrdinalIgnoreCase)) { $rel = $fp.Substring($root.Length + 1) }; if ($rel) { $rel = $rel -replace '\\\\','/'; $q = '.claude\\review-queue.txt'; if (!(Test-Path $q)) { New-Item -ItemType File -Path $q -Force | Out-Null }; $existing = Get-Content $q -ErrorAction SilentlyContinue; if ($existing -notcontains $rel) { Add-Content -Path $q -Value $rel } } }",
             "shell": "powershell",
             "statusMessage": "Queuing file for Antigravity + Codex review...",
             "type": "command"
@@ -39,7 +39,7 @@
       {
         "hooks": [
           {
-            "command": "@{systemMessage='Reviewers needed before committing: run Antigravity and Codex review on changed files. Check .claude/review-queue.txt, save Antigravity output to .claude/antigravity-review-latest.md, generate .claude/codex-prompt-latest.md, and save Codex output to .claude/codex-review-latest.md when available.'} | ConvertTo-Json -Compress",
+            "command": "$q = '.claude\\review-queue.txt'; $pending = @(); if (Test-Path $q) { $pending = @(Get-Content $q -ErrorAction SilentlyContinue | Where-Object { $_.Trim() }) }; if ($pending.Count -gt 0) { @{systemMessage='Reviewers needed before committing: run Antigravity and Codex review on changed files. Check .claude/review-queue.txt, save Antigravity output to .claude/antigravity-review-latest.md, generate .claude/codex-prompt-latest.md, and save Codex output to .claude/codex-review-latest.md when available.'} | ConvertTo-Json -Compress }",
             "shell": "powershell",
             "statusMessage": "Checking review queue...",
             "type": "command"
diff --git a/AGENTS.md b/AGENTS.md
index b79b99c..52f9db4 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -41,11 +41,13 @@ Antigravity acts as the senior architectural auditor for system-level reasoning:
 - Cross-feature data integrity and edge cases
 - **Dynamic Runtime State-Flow Audits**: Trace async lifecycles, event interleaving, and state transition boundaries to identify race conditions (e.g., router redirects preempting slow post-auth writes). Audit whether mocks in unit tests mask live database-layer constraints or privilege revocations.

-**Invoke from terminal:**
-```bash
-antigravity -p "$(Get-Content ANTIGRAVITY.md; Get-Content docs/agent-harness.md); Review this file: $(Get-Content <file>)"
+**Invoke from terminal** (after `/antigravity-review` has written the packet to `.claude/antigravity-prompt-latest.md`):
+```powershell
+antigravity -p "You are Antigravity, reviewing for the Gotta Go project. Read the review packet at .claude/antigravity-prompt-latest.md in full, inspect the files it names from disk, and return your verdict in the Antigravity review format defined in ANTIGRAVITY.md, including the Runtime Boundary Check section."
 ```

+Never pass the packet contents inline with `-p` — Windows' ~32K command-line limit truncates it and Antigravity fails silently. The short prompt + on-disk packet is the only supported invocation on this host.
+
 Or open Antigravity CLI in this project. `ANTIGRAVITY.md` loads automatically.

 ---
diff --git a/AGENTS_ROSTER.md b/AGENTS_ROSTER.md
index efaa7c4..a8c8ca5 100644
--- a/AGENTS_ROSTER.md
+++ b/AGENTS_ROSTER.md
@@ -79,13 +79,16 @@ If any file listed above conflicts with another, flag the conflict for human res

 ### Invocation

-```bash
+```powershell
 # Run /antigravity-review in Claude Code to invoke automatically on queued files.
-# Manual invocation:
-antigravity -p "$(cat ANTIGRAVITY.md AGENTS_ROSTER.md AGENTS.md docs/agent-harness.md SPEC.md docs/schema-contract.md docs/review-severity.md docs/verification.md); Review the following changed files and return your verdict:\n$(cat <file>)"
+# It writes the full review packet to .claude/antigravity-prompt-latest.md, then calls
+# Antigravity with a SHORT prompt pointing at that packet. Manual invocation (after the
+# packet exists):
+antigravity -p "You are Antigravity, reviewing for the Gotta Go project. Read the review packet at .claude/antigravity-prompt-latest.md in full, inspect the files it names from disk, and return your verdict in the Antigravity review format defined in ANTIGRAVITY.md, including the Runtime Boundary Check section."
 ```

-> Use `/antigravity-review` in Claude Code — it builds the full context prompt and calls Antigravity automatically.
+> **Never inline the packet:** `antigravity -p "$(cat <many files>)"` exceeds Windows' ~32K command-line limit and fails silently ("The filename or extension is too long"). Antigravity is an agentic CLI with filesystem access — the short prompt + on-disk packet is the only supported invocation on this host.
+> Use `/antigravity-review` in Claude Code — it builds the packet and calls Antigravity automatically.

 ### Primary Focus Areas

@@ -115,10 +118,15 @@ antigravity -p "$(cat ANTIGRAVITY.md AGENTS_ROSTER.md AGENTS.md docs/agent-harne
 ### Verification
 - Commands run and results, or why verification was not run.

+### Runtime Boundary Check
+- Mandatory whenever the review packet includes a "Dependency Call Chains" or "Runtime Boundary And Mock Audit" section (i.e. any multi-file or cross-boundary change). State the call-path traced, which tests mock which boundaries, and whether any mock could hide production behavior. If the packet omitted this context, say so explicitly instead of skipping the section.
+
 ### Approved
 - What is correct and ready.
 ```

+> Canonical format lives in `ANTIGRAVITY.md` § Output Format — if this block and that file ever diverge, `ANTIGRAVITY.md` wins. The pre-commit hook (`.claude/hooks/check-review-artifacts.js`) rejects verdicts missing the Runtime Boundary Check section.
+
 ---

 ## Agent 3 — Codex (Codex App)
@@ -179,10 +187,15 @@ Open that file, copy the contents, and paste into the Codex app.
 ### Verification
 - Commands run and results, or why verification was not run.

+### Runtime Boundary Check
+- Mandatory whenever the review packet includes a "Dependency Call Chains" or "Runtime Boundary And Mock Audit" section (i.e. any multi-file or cross-boundary change). State the call-path traced, which tests mock which boundaries, and whether any mock could hide production behavior. If the packet omitted this context, say so explicitly instead of skipping the section.
+
 ### Approved
 - What is correct or ready to merge.
 ```

+> Canonical format lives in `CODEX.md` § Review Output — if this block and that file ever diverge, `CODEX.md` wins. The pre-commit hook (`.claude/hooks/check-review-artifacts.js`) rejects verdicts missing the Runtime Boundary Check section.
+
 ---

 ## Agent 4 — GSD (Get Stuff Done Orchestration)
```

## Dependency Call Chains

### === DEPENDENCY FILE: .claude/hooks/check-review-artifacts.js ===
```javascript
#!/usr/bin/env node
/**
 * Pre-commit gate: blocks a commit if it stages files that are currently in
 * .claude/review-queue.txt but the reviewer packets/verdicts don't carry the
 * runtime-boundary and mock-boundary sections required by docs/agent-harness.md
 * "Prompt Packet Requirements" and the CODEX.md/ANTIGRAVITY.md Review Output formats.
 *
 * This is a presence check, not a quality check — it proves the required section
 * exists, not that the analysis in it is correct. It exists to catch the "skipped
 * the step entirely" failure mode, which review packets don't self-report.
 *
 * Scoped to the intersection of staged files and review-queue.txt so it stays a
 * no-op for commits that don't touch anything pending review (docs-only changes,
 * bookkeeping files, etc).
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function readFileSafe(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

const queueFile = path.join('.claude', 'review-queue.txt');
const queue = new Set(readLines(queueFile));

if (queue.size === 0) {
  process.exit(0);
}

let staged;
try {
  staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
} catch (e) {
  console.error('check-review-artifacts: could not read staged files (' + e.message + '), skipping check');
  process.exit(0);
}

const touchesReviewedFiles = staged.some((f) => queue.has(f));
if (!touchesReviewedFiles) {
  process.exit(0);
}

const REQUIRED = [
  {
    file: path.join('.claude', 'antigravity-prompt-latest.md'),
    label: 'Antigravity prompt packet',
    headings: ['Runtime Boundary And Mock Audit'],
  },
  {
    file: path.join('.claude', 'codex-prompt-latest.md'),
    label: 'Codex prompt packet',
    headings: ['Runtime Boundary And Mock Audit'],
  },
  {
    file: path.join('.claude', 'antigravity-review-latest.md'),
    label: 'Antigravity review verdict',
    headings: ['Runtime Boundary Check'],
  },
  {
    file: path.join('.claude', 'codex-review-latest.md'),
    label: 'Codex review verdict',
    headings: ['Runtime Boundary Check'],
  },
];

let failed = false;
for (const req of REQUIRED) {
  const content = readFileSafe(req.file);
  if (content === null) {
    console.error(
      'BLOCKED: ' + req.label + ' is missing (' + req.file + ') but staged files are in the active review queue.'
    );
    failed = true;
    continue;
  }
  for (const heading of req.headings) {
    if (!content.includes(heading)) {
      console.error(
        'BLOCKED: ' + req.label + ' (' + req.file + ') is missing the required "' + heading + '" section.'
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error('');
  console.error(
    'Per docs/agent-harness.md "Prompt Packet Requirements" and the CODEX.md/ANTIGRAVITY.md Review Output'
  );
  console.error(
    'formats, every reviewer packet and verdict must include runtime-boundary and mock-boundary context.'
  );
  console.error('Regenerate the missing artifact(s) before committing files in .claude/review-queue.txt.');
  console.error('');
  console.error('This check only confirms the section is present, not that its content is correct.');
  process.exit(1);
}

process.exit(0);
```

### === DEPENDENCY FILE: .beads/hooks/pre-commit ===
```sh
#!/usr/bin/env sh
# --- BEGIN PROJECT CUSTOM HOOKS (tracked in git, safe from beads upgrades) ---
# node .claude/hooks/check-review-artifacts.js blocks commits that stage files
# currently in .claude/review-queue.txt if the Antigravity/Codex packets or
# verdicts are missing required runtime-boundary/mock-boundary sections.
if command -v node >/dev/null 2>&1; then
  node .claude/hooks/check-review-artifacts.js || exit 1
fi
# --- END PROJECT CUSTOM HOOKS ---
# --- BEGIN BEADS INTEGRATION v1.0.4 ---
# This section is managed by beads. Do not remove these markers.
if command -v bd >/dev/null 2>&1; then
  export BD_GIT_HOOK=1
  _bd_timeout=${BEADS_HOOK_TIMEOUT:-300}
  if command -v timeout >/dev/null 2>&1; then
    timeout "$_bd_timeout" bd hooks run pre-commit "$@"
    _bd_exit=$?
    if [ $_bd_exit -eq 124 ]; then
      echo >&2 "beads: hook 'pre-commit' timed out after ${_bd_timeout}s — continuing without beads"
      _bd_exit=0
    fi
  else
    bd hooks run pre-commit "$@"
    _bd_exit=$?
  fi
  if [ $_bd_exit -eq 3 ]; then
    echo >&2 "beads: database not initialized — skipping hook 'pre-commit'"
    _bd_exit=0
  fi
  if [ $_bd_exit -ne 0 ]; then exit $_bd_exit; fi
fi
# --- END BEADS INTEGRATION v1.0.4 ---
```

## Runtime Boundary And Mock Audit

- **Nearest callers/callees:**
  - `.claude/settings.json` PostToolUse hook (queue writer) → `.claude/review-queue.txt` → read by `/antigravity-review` and `/codex-prompt` (`Get-Content .claude\review-queue.txt`) → also read by `.claude/hooks/check-review-artifacts.js` (intersected against `git diff --cached --name-only`).
  - `.beads/hooks/pre-commit` → `check-review-artifacts.js` (invoked on every `git commit`, scoped to the intersection of staged files and the queue).
  - `.claude/settings.json` Stop hook → emits a systemMessage consumed by the Claude Code harness UI at end of turn; independent of the PostToolUse hook and the commit gate.
- **Tests/mocks:** None — there is no automated test harness for `.claude/settings.json` hook bodies or the command `.md` files; verification was manual extraction-and-execution (see Verification Context below), not a checked-in test. This is a real gap worth naming explicitly rather than letting the review imply otherwise: **there is no regression test that will catch a future accidental revert of this fix.** Confirm whether you consider that acceptable for tooling-only config or want a lightweight follow-up (e.g. a `node`/`jest` test that loads `settings.json`, extracts the hook command, and runs it against fixtures).
- **Auth/routing/GPS/Supabase/async-UI relevance:** none — this change touches no application runtime.
- **Ordering/failure paths to verify:**
  - Hooks are snapshotted at Claude Code session start. This means the settings.json fix does not affect the *current* session's live hook — the review-queue entries used to build this exact review cycle were hand-set to the five files in scope (visible in `.claude/review-queue.txt` on disk right now). Confirm you agree this is an acceptable one-time manual bridge and not a defect in the fix itself.
  - Confirm the out-of-repo-path-drop behavior in the PostToolUse hook fix is intentional and correct: previously an absolute out-of-repo path would be queued (unreviewable noise); now it is silently skipped. No user-visible signal either way (the hook's `statusMessage` is a static string regardless of outcome) — same as pre-fix behavior, so no regression, but worth Codex's independent judgment on whether silent-drop is the right choice versus surfacing a warning.

## Files To Review

### === FILE: .claude/settings.json ===
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "command": "$j = [Console]::In.ReadToEnd() | ConvertFrom-Json; $fp = $j.tool_input.file_path; if ($fp) { $root = (Get-Location).Path.TrimEnd('\\'); $rel = $null; if (-not [System.IO.Path]::IsPathRooted($fp)) { $rel = $fp } elseif ($fp.StartsWith($root + '\\', [System.StringComparison]::OrdinalIgnoreCase)) { $rel = $fp.Substring($root.Length + 1) }; if ($rel) { $rel = $rel -replace '\\\\','/'; $q = '.claude\\review-queue.txt'; if (!(Test-Path $q)) { New-Item -ItemType File -Path $q -Force | Out-Null }; $existing = Get-Content $q -ErrorAction SilentlyContinue; if ($existing -notcontains $rel) { Add-Content -Path $q -Value $rel } } }",
            "shell": "powershell",
            "statusMessage": "Queuing file for Antigravity + Codex review...",
            "type": "command"
          }
        ],
        "matcher": "Write|Edit|MultiEdit"
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "command": "bd prime",
            "type": "command"
          }
        ],
        "matcher": ""
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "command": "bd prime",
            "type": "command"
          }
        ],
        "matcher": ""
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "command": "$q = '.claude\\review-queue.txt'; $pending = @(); if (Test-Path $q) { $pending = @(Get-Content $q -ErrorAction SilentlyContinue | Where-Object { $_.Trim() }) }; if ($pending.Count -gt 0) { @{systemMessage='Reviewers needed before committing: run Antigravity and Codex review on changed files. Check .claude/review-queue.txt, save Antigravity output to .claude/antigravity-review-latest.md, generate .claude/codex-prompt-latest.md, and save Codex output to .claude/codex-review-latest.md when available.'} | ConvertTo-Json -Compress }",
            "shell": "powershell",
            "statusMessage": "Checking review queue...",
            "type": "command"
          },
          {
            "command": "$p = '.planning\\stale-info-scan-latest.md'; $due = $true; if (Test-Path $p) { $due = ((New-TimeSpan -Start (Get-Item $p).LastWriteTime -End (Get-Date)).TotalDays -ge 30) }; if ($due) { @{systemMessage='Stale-information scan is due or missing: run /stale-info-scan before phase transitions, milestone close, release, or dependency/schema/harness changes.'} | ConvertTo-Json -Compress }",
            "shell": "powershell",
            "statusMessage": "Checking stale-information scan cadence...",
            "type": "command"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(antigravity *)",
      "Bash(codex *)",
      "Bash(npx *)",
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(node *)"
    ]
  }
}
```

### === FILE: .claude/commands/antigravity-review.md (full) ===
```markdown
# /antigravity-review

Invoke the Antigravity CLI on all files currently queued in `.claude/review-queue.txt`.

## Steps

1. Read `.claude/review-queue.txt`. If it is empty or missing, tell the user there is nothing to review and stop.

2. Read the following context files. Include only the sections needed for the current review packet unless the whole file is directly relevant:
   - `ANTIGRAVITY.md`
   - `AGENTS_ROSTER.md`
   - `AGENTS.md`
   - `docs/agent-harness.md`
   - `SPEC.md`
   - `docs/schema-contract.md`
   - `docs/review-severity.md`
   - `docs/verification.md`
   - `docs/stale-info-scan.md`
   - `.planning/stale-info-scan-latest.md` if present

3. Read each file listed in the review queue.

4. Build the full review packet and write it to `.claude/antigravity-prompt-latest.md`. Include `docs/agent-harness.md`, `docs/stale-info-scan.md`, the latest stale-information scan if present, verification evidence, every file listed in `.claude/review-queue.txt`, and the nearest runtime-boundary files that can affect the changed behavior. Then invoke Antigravity with a SHORT prompt that points at the packet file — never pass the packet itself on the command line.

   > **WHY (do not regress this):** Windows caps a process command line at ~32K characters. `antigravity -p "<full packet>"` exceeds that for any real packet and fails silently ("The filename or extension is too long"), leaving a stale or empty review artifact. Antigravity is itself an agentic CLI with filesystem access: give it a short prompt naming the packet file and it reads the packet and the queued files from disk itself. This is the pattern that carried the WU-02-T5/T6 reviews.

   Use the following PowerShell command pattern on Windows, adjusting the file list from the queue:

```powershell
$files = Get-Content .claude\review-queue.txt | Where-Object { $_.Trim() }
$gitStatus = git status --short
$gitDiff = git diff HEAD -- $files

# Find calling/dependent files (excluding files already queued)
$dependencies = @()
$files | ForEach-Object {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($_)
  if ($name -and $_ -match '\.tsx?$') {
    $escapedName = [regex]::Escape($name)
    $pattern = 'from [''"].*' + $escapedName + '[''"]|' + $escapedName + '|useSession|useSegments|router\.|rpc\(|onAuthStateChange'
    $refs = Get-ChildItem -Path app\src -Recurse -File -ErrorAction SilentlyContinue |
      Select-String -Pattern $pattern -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty Path -Unique
    $dependencies += $refs
  }
}
$dependencies = $dependencies | Where-Object { $files -notcontains $_ }

$prompt = @(
  Get-Content ANTIGRAVITY.md -Raw
  Get-Content AGENTS_ROSTER.md -Raw
  Get-Content AGENTS.md -Raw
  Get-Content docs\agent-harness.md -Raw
  Get-Content SPEC.md -Raw
  Get-Content docs\schema-contract.md -Raw
  Get-Content docs\review-severity.md -Raw
  Get-Content docs\verification.md -Raw
  Get-Content docs\stale-info-scan.md -Raw
  if (Test-Path .planning\stale-info-scan-latest.md) { Get-Content .planning\stale-info-scan-latest.md -Raw }
  '---'
  '## Verification Context'
  '=== Git Status ==='
  $gitStatus
  '=== Git Diffs ==='
  $gitDiff
  '---'
  '## Dependency Call Chains And Runtime Boundaries'
  if ($dependencies) {
    $dependencies | ForEach-Object { "=== DEPENDENCY FILE: $_ ===`n$(Get-Content $_ -Raw)" }
  } else {
    'No external dependency files detected in app/src.'
  }
  '---'
  '## Runtime Boundary And Mock Audit'
  'Audit nearest callers/callees, providers, route guards, hooks, RPCs, migrations, policies, scheduled jobs, and external callbacks that can affect this change.'
  'Check whether tests mock those boundaries and whether the mocks hide production behavior.'
  'For PostGIS, RLS, trust/shadowban, auth, GPS, Supabase writes, and async UI flows, verify event ordering and failure paths.'
  '---'
  'Review the following changed files. Return your verdict in the Antigravity review format defined in ANTIGRAVITY.md.'
  ($files | ForEach-Object { "=== FILE: $_ ===`n$(Get-Content $_ -Raw)" })
) -join "`n"

$prompt | Set-Content -Path .claude\antigravity-prompt-latest.md

# SHORT prompt only — the packet stays on disk (Windows ~32K command-line limit; see step 4 note).
$shortPrompt = @(
  'You are Antigravity, reviewing for the Gotta Go project.'
  'Read the review packet at .claude/antigravity-prompt-latest.md in full. It contains your role guide, project context, verification evidence, dependency call chains, the Runtime Boundary And Mock Audit instructions, and every changed file in scope.'
  'Inspect the actual files it names from disk — the packet is review input, not a substitute for evidence.'
  'Return your complete verdict in the Antigravity review format defined in ANTIGRAVITY.md, including the mandatory Runtime Boundary Check section. Print the full verdict to stdout.'
) -join ' '
$response = antigravity -p $shortPrompt
$response | Set-Content -Path .claude\antigravity-review-latest.md
$response
```

5. Save the full Antigravity response to `.claude/antigravity-review-latest.md` and display it to the user.

6. Based on Antigravity's verdict:
   - **APPROVE**: Inform the user Antigravity has approved. Do not clear the queue yet — wait for Codex via `/codex-prompt`.
   - **REQUEST CHANGES**: List all findings by severity. Do not commit. Claude must fix all REQUEST CHANGES items before re-running.
   - **BLOCK**: Stop everything. List BLOCK findings clearly. No commit until all BLOCK items are resolved and Antigravity re-reviews.

7. If the verdict contains both BLOCK/REQUEST CHANGES findings and APPROVE items, treat the overall verdict as the strictest level present.

## Notes

- Run this command after every non-trivial implementation task, before generating the Codex prompt.
- If Antigravity CLI is not available (command not found), tell the user to install it and provide the manual prompt they can run themselves.
- Never skip this step to move faster. The review gate exists because PostGIS, RLS, and trust-engine correctness cannot be safely self-reviewed.
- Antigravity review is independent. Do not ask Antigravity to approve based on Claude's summary; include actual files, verification evidence, dependency boundaries, and mock-boundary context.
```

### === FILE: .claude/commands/review-gate.md (title line only — remainder unchanged) ===
```markdown
# /review-gate

Run the full three-part review cycle on the current active phase (or a specified phase). This command is the mandatory entry point for all code review. Never run `/antigravity-review` or `/codex-prompt` independently — always use this command so all three reviewers run in the correct order.
```

### === FILE: AGENTS_ROSTER.md (excerpt — Antigravity Invocation + both format blocks) ===
```markdown
### Invocation

​```powershell
# Run /antigravity-review in Claude Code to invoke automatically on queued files.
# It writes the full review packet to .claude/antigravity-prompt-latest.md, then calls
# Antigravity with a SHORT prompt pointing at that packet. Manual invocation (after the
# packet exists):
antigravity -p "You are Antigravity, reviewing for the Gotta Go project. Read the review packet at .claude/antigravity-prompt-latest.md in full, inspect the files it names from disk, and return your verdict in the Antigravity review format defined in ANTIGRAVITY.md, including the Runtime Boundary Check section."
​```

> **Never inline the packet:** `antigravity -p "$(cat <many files>)"` exceeds Windows' ~32K command-line limit and fails silently ("The filename or extension is too long"). Antigravity is an agentic CLI with filesystem access — the short prompt + on-disk packet is the only supported invocation on this host.
> Use `/antigravity-review` in Claude Code — it builds the packet and calls Antigravity automatically.

[... Primary Focus Areas table unchanged ...]

### Output Format

​```md
## Antigravity Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Issues
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Concerns
- Architectural or logic concerns that may need follow-up.

### Verification
- Commands run and results, or why verification was not run.

### Runtime Boundary Check
- Mandatory whenever the review packet includes a "Dependency Call Chains" or "Runtime Boundary And Mock Audit" section (i.e. any multi-file or cross-boundary change). State the call-path traced, which tests mock which boundaries, and whether any mock could hide production behavior. If the packet omitted this context, say so explicitly instead of skipping the section.

### Approved
- What is correct and ready.
​```

> Canonical format lives in `ANTIGRAVITY.md` § Output Format — if this block and that file ever diverge, `ANTIGRAVITY.md` wins. The pre-commit hook (`.claude/hooks/check-review-artifacts.js`) rejects verdicts missing the Runtime Boundary Check section.

[... Agent 3 Codex section: Invocation unchanged, Output Format below ...]

### Output Format

​```md
## Codex Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Runtime Boundary Check
- Mandatory whenever the review packet includes a "Dependency Call Chains" or "Runtime Boundary And Mock Audit" section (i.e. any multi-file or cross-boundary change). State the call-path traced, which tests mock which boundaries, and whether any mock could hide production behavior. If the packet omitted this context, say so explicitly instead of skipping the section.

### Approved
- What is correct or ready to merge.
​```

> Canonical format lives in `CODEX.md` § Review Output — if this block and that file ever diverge, `CODEX.md` wins. The pre-commit hook (`.claude/hooks/check-review-artifacts.js`) rejects verdicts missing the Runtime Boundary Check section.
```

### === FILE: AGENTS.md (excerpt — Antigravity Invocation) ===
```markdown
**Invoke from terminal** (after `/antigravity-review` has written the packet to `.claude/antigravity-prompt-latest.md`):
​```powershell
antigravity -p "You are Antigravity, reviewing for the Gotta Go project. Read the review packet at .claude/antigravity-prompt-latest.md in full, inspect the files it names from disk, and return your verdict in the Antigravity review format defined in ANTIGRAVITY.md, including the Runtime Boundary Check section."
​```

Never pass the packet contents inline with `-p` — Windows' ~32K command-line limit truncates it and Antigravity fails silently. The short prompt + on-disk packet is the only supported invocation on this host.

Or open Antigravity CLI in this project. `ANTIGRAVITY.md` loads automatically.
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
