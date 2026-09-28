> **RETIRED: this scope (`sha256:4bca170f…`) was approved and committed as `1e1d210` on 2026-09-27. Do not review it again. A new review needs freshly generated packets.**

<!-- review-manifest
reviewer: codex
generated_at: 2026-09-27T22:37:41Z
scope_hash: sha256:4bca170fe96d2a419447141416a362ff7976ae9e113f1bac545ec180e942d524
review_id: rv-20260927T223741Z-71c8c8f2
risk_level: high
runtime_required: true
blind_review: true
queue:
  - .claude/hooks/harness-hooks.js
  - .claude/hooks/harness-hooks.test.js
diff_base: HEAD
context_tier: 1
-->

# Codex Review Packet: Windows Path Canonicalization Fix

You are Codex, the implementation-quality, security, test-quality, and failure-state reviewer. This packet is a set of claims, not proof. Inspect both queued files from disk and confirm the staged scope matches `scope_hash`. Verdicts: APPROVE, REQUEST CHANGES, or BLOCK. Because `runtime_required: true`, APPROVE requires runtime evidence you executed yourself. Windows itself cannot run here; say whether the named CI gap blocks approval.

## Task Goal

Follow-up to commit `fd6c252` (the OS-portability batch). Its first real CI run, GitHub Actions run 36355663591 on push `47ae9f4` (2026-09-27), passed on ubuntu-latest and macos-latest but failed 5 of 140 harness tests on windows-latest. This batch fixes the root causes. Two queued files only.

## Queue (2 paths, both staged; nothing else in the index)

```
.claude/hooks/harness-hooks.js
.claude/hooks/harness-hooks.test.js
```

## Root Cause (from the windows-latest log)

1. **Tests 69, 70, 89, 90.** `os.tmpdir()` on the runner returned the 8.3 short name `C:\Users\RUNNER~1\...`, while `git rev-parse --show-toplevel` returned the long name `C:\Users\runneradmin\...`. `realpathOfExisting` used `fs.realpathSync`, which follows symlinks but does not expand 8.3 names. So a file spelled with the short name never matched a root spelled with the long name, and `queue-edit` queued nothing (`actual: ~`). The same would happen on a real Windows host whenever the hook input path and git's top level spell the directory differently. Test 69 compared both sides with the same non-native resolver and saw the same short-versus-long mismatch.
2. **Test 110.** Git on Windows printed `warning: in the working copy of '--weird; echo PWNED $(whoami).txt', LF will be replaced by CRLF ...`. The assertion rejected any `PWNED` substring, so it failed on the quoted filename inside a harmless warning, not on an executed command.

## Changes (implementer claims, to be disproved)

| Claim | Where |
|---|---|
| `realpathOfExisting` resolves with `fs.realpathSync.native`, the OS resolver: `realpath(3)` on POSIX and `GetFinalPathNameByHandle` through libuv on Windows. It returns the canonical spelling: it expands 8.3 names and restores on-disk case. Callers are unchanged: `toRepoRelative` (lexical, then resolved containment), `sameRepoWorktreeRoot` (git common-dir equality), and the symlink handling. | `harness-hooks.js` `realpathOfExisting` |
| New test: a non-canonical spelling of the root still resolves inside it. On case-insensitive volumes it re-spells the root's basename in upper case and passes `caseInsensitive: false`, so only canonical resolution can make it match. It is skipped where no second spelling can be created (case-sensitive volumes); on Windows it covers the same class as 8.3. | `harness-hooks.test.js` |
| Test 69 compares with `.native` on both sides. | `harness-hooks.test.js:69` |
| Test 110 now rejects only output where a line starts with `PWNED`, which is what an executed `echo PWNED $(whoami)` prints. A quoted filename inside a git message no longer fails it. The staged-name assertion in the same test (exactly the tricky literal name, and nothing else, is staged) is unchanged. | `harness-hooks.test.js` (stage-queue literal-path test) |

## Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED | the new non-canonical-spelling test failed before the fix with `actual: null`, the same symptom as Windows tests 70, 89, and 90 |
| GREEN | `harness-hooks.test.js` 47/47 pass after the fix |
| Test 110 regex semantics | `/^\s*PWNED\b/m` is false on the exact Windows warning text, true on `PWNED runneradmin` after another line, and true on `PWNED yael` alone |
| Full suites (`harness-hooks`, the gate test file, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 144 tests, 139 pass, 0 fail, 5 skipped (Windows-only) |
| Windows | NOT run locally. The windows-latest job reruns on the next push after commit. This is the unverified boundary. |

## Runtime Boundary And Mock Audit

- The Claude Code hook dispatch (exec form, `node` plus `args`) is unchanged.
- `fs.realpathSync.native` behavior differs by OS. Assess whether it can throw where the JS resolver did not. The call is inside the same try/catch that walks up to the deepest existing ancestor. Also assess whether it can return a form that breaks `stripPrefix`, for example a `\\?\` prefix or a different drive-letter case on Windows. `toForwardSlashes` and the case-insensitive prefix match apply afterwards.
- The tests use real temp directories and real git repos. The Windows short-name case is exercised only by the CI runner, not by a mock.

## Required Skills

- `.claude/skills/artifact_qa_gate.md` shared core plus its **Codex Overlay**.
- `superpowers:systematic-debugging` (the root-cause claims above), `superpowers:verification-before-completion`, and, for Antigravity, `superpowers:using-superpowers`. Name any that are unavailable as gaps.

## Blind-Review Rules

- Exclude `.claude/reviews/**` and every `.claude/*-review-latest.md` file from repository-wide searches. Do not read the other reviewer's packet, verdict, or archives.
- The only gate command you may run is the fingerprint preflight: `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`. It exits before reading any verdict. The orchestrator runs any other gate check after both verdicts are archived.
- Read the full diff from disk: `git diff --cached -- .claude/hooks/harness-hooks.js .claude/hooks/harness-hooks.test.js`.

## Required Verdict Format

Write to `.claude/codex-review-latest.md`, run `node .claude/hooks/archive-review-artifact.js codex`, and print the verdict.

```md
## Codex Review - Windows path canonicalization fix

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

scope_hash: sha256:4bca170fe96d2a419447141416a362ff7976ae9e113f1bac545ec180e942d524
review_id: rv-20260927T223741Z-71c8c8f2
risk_level: high
runtime_required: true
blind_review: true
prior_reviewer_outputs_read: false
evidence_level: 0|1|2|3|4
runtime_evidence: executed|not_applicable|unavailable

### Reviewed Queue
### Skills Applied
### Findings
### Open Questions
### Verification
### Evidence Receipts
### Adversarial Disproof
### Unverified Boundaries
### Runtime Boundary Check
### Approved
```
