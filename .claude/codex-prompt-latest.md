<!-- review-manifest
reviewer: codex
generated_at: 2026-09-27T15:19:44Z
scope_hash: sha256:46d7a8a574650fd77b8306b24c429709dd00edfc8d2a3ebb3410da9f2aff846a
review_id: rv-20260927T151944Z-cc859f85
risk_level: high
runtime_required: true
blind_review: true
queue:
  - .claude/settings.json
  - .claude/hooks/harness-hooks.js
  - .claude/hooks/harness-hooks.test.js
  - .beads/hooks/pre-commit
  - .beads/hooks/pre-push
  - .beads/hooks/post-checkout
  - .beads/hooks/post-merge
  - .beads/hooks/prepare-commit-msg
  - .claude/commands/antigravity-review.md
  - .claude/commands/codex-prompt.md
  - .claude/commands/review-gate.md
  - .claude/commands/stale-info-scan.md
  - .claude/skills/review_packet_generator.md
  - .claude/skills/SKILL.md
  - .editorconfig
  - .gitattributes
  - .github/workflows/ci.yml
  - .metaswarm/project-profile.json
  - ANTIGRAVITY.md
  - CODEX.md
  - docs/stale-info-scan.md
  - docs/agent-harness.md
  - docs/verification.md
  - README.md
  - scripts/os-portability.test.js
  - supabase/scripts/run-isolated-db-suite.test.js
  - .claude/hooks/check-review-artifacts.js
  - .claude/hooks/check-review-artifacts.test.js
diff_base: HEAD
context_tier: 1
-->

# Codex Review Packet: OS-Portability Harness Batch (Round 12)

You are Codex, the implementation-quality, security, test-quality, and failure-state reviewer. This packet is a set of claims, not proof. Inspect every queued file from disk, confirm that the staged scope matches `scope_hash` above, and rebuild the evidence yourself. This is a blind review. Do not read the other reviewer (Antigravity)'s packet, verdict, or archived verdicts under `.claude/reviews/`.

Verdicts: `APPROVE`, `REQUEST CHANGES`, or `BLOCK`. Codex is the approval-bearing reviewer. Because `runtime_required: true`, `APPROVE` requires `runtime_evidence: executed` that you reproduce yourself, at minimum running the four `node --test` suites below in your sandbox. If you cannot reproduce it, return a non-approval verdict and name the missing boundary. Note that CI has never run on Windows or Linux for this batch; you decide whether that gap blocks approval or is an acceptable named residual risk.

### Required Skills

- `.claude/skills/artifact_qa_gate.md`: the shared core (preflight, evidence ladder, fail-closed) and the **Codex Overlay**.
- Superpowers process skills, if available in your harness: `superpowers:verification-before-completion` before an `APPROVE`, and `superpowers:systematic-debugging` for any failure you try to reproduce. If they are unavailable, name them as gaps. Do not claim that they ran.
- Project domain skills: none triggered. There is no PostGIS, RLS, or trust boundary.

List every skill you actually invoked under `### Skills Applied`.

### Tier 1 Context Selected

This is a harness and workflow change. Read `docs/agent-harness.md` (the review-gate and hook sections), `.claude/hooks/check-review-artifacts.js` (the scope_hash that the pre-commit gate enforces), `.beads/hooks/pre-commit`, and `supabase/scripts/run-isolated-db-suite.js` (`makeRunSupabase`, `resolveCliJsEntry`) for C13. For Claude Code hook-dispatch semantics (the shell used when `"shell"` is omitted, expansion of `$CLAUDE_PROJECT_DIR` on Windows, and the effect of a non-zero exit on PostToolUse and Stop hooks), cite the official documentation. Do not rely on memory.

`.planning/STATE.md` and `.beads/context/execution-state.md` are not queued. Their 2026-09-26 entries describe this batch as verified and uncommitted.

Codex-specific focus: security of the subprocess calls (`spawnSync` argv versus shell, and pathspec or option injection through queue contents), silent failure paths that let an edit escape the review queue, and whether the tests would fail on a real regression rather than only on the implementation as written. Also check that loud failures surface usefully to the user.

## Blind-Review Search Rule (mandatory)

Every repository-wide search (`rg`, `grep -r`, `find`, `git grep`, and so on) MUST exclude `.claude/reviews/**` and every `.claude/*-review-latest.md` file. For example: `rg -n PATTERN --glob '!.claude/reviews/**' --glob '!.claude/*-review-latest.md'`. A prior attempt in this batch broke blindness through an unscoped search. If any other reviewer's output reaches you anyway, declare `prior_reviewer_outputs_read: true` and say so. Do not issue a positive verdict on that attempt.

During this blind run, do not execute the full cross-review artifact gate. It reads both canonical verdicts and can expose the other reviewer's output through diagnostics. You may execute only the fingerprint preflight: `node .claude/hooks/check-review-artifacts.js --print-staged-scope-hash`. The orchestrator runs the full gate after both initial verdicts are archived.

## Round 12: Changes Since Round 11

The round-11 scope was `sha256:023b3eb724a06785e683a9ed4373ed4be7b6b8704693b930554ef2aabcb34f58`. Its verdicts are archived and must not be read. The queue is the same 28 paths. Three queued files changed: the gate script and its test file under `.claude/hooks/`, and `docs/agent-harness.md`.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **The gate-name boundary is now a denylist.** The token naming the gate script is `check-review-artifacts`, optionally followed by `.js`. It counts as ended unless the next character continues a filename: a word character, `-`, or `.` followed by a word character. The round-11 version listed the allowed terminators and omitted shell redirection operators, so a redirect written directly against the script name did not count as naming the gate. With the denylist, every shell metacharacter after the name counts. | scanner function in the gate script (`gateToken`) |
| **Tests.** The real-gate integration test gains both round-11 reproductions (output and input redirection touching the name). The helper contract test gains a sweep of 21 shell metacharacters placed directly after the script name, each of which must be blocked. It also checks that names which merely extend it (the `.test.js` file, a `.jsx`, an `_v2.js`, a `.js.bak`) stay other files. | gate test file |
| **Disclosure.** The Known Limitations paragraph now states the boundary rule and lists redirections among the blocked forms. It is still marked as not accepted or rejected by the user. | `docs/agent-harness.md` |

### Round-12 Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED before GREEN | the metacharacter sweep failed on `>` before the fix. One false start: the test edit first produced a syntax error, not a RED, because a scripted replacement treated `$'` as a special pattern. It was fixed, confirmed with `node --check` and the diff, and rerun to a real assertion failure. |
| Gate test file | 66/66 pass |
| Full suites (`harness-hooks`, gate, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 143 tests, 138 pass, 0 fail, 5 skipped (Windows-only) |
| False-positive scan | the exported function flags no line of either round-12 packet; the orchestrator gate reports no packet-level block |

## Round 11: Changes Since Round 10

The round-10 scope was `sha256:576457183e42551ce964b837e61579becdfef1f9c016c6e434c9836e1f4eb999`. Its verdicts are archived and must not be read. The queue is the same 28 paths. Three queued files changed: the gate script and its test file under `.claude/hooks/`, and `docs/agent-harness.md`. The user chose a line-level rule over accepting the round-10 forms as documented risk.

Note on wording: this packet refers to the gate as "the gate script" wherever a line also mentions a runtime or shell word. Under the rule being reviewed, a line naming both is blocked, so earlier rounds' rows below were reworded the same way. The exact test strings are in the test file on disk.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **The scanner is line-level and order-independent.** After canonicalization, quote-to-space, and removal of the allowed fingerprint form (unchanged), a line is unsafe when it names the gate script AND contains, anywhere and in any order, a runtime or shell word, a direct `./` run of the gate, or an assignment of its path. The runtime-word boundary now also accepts a preceding `-`, so a `find -exec` form with no runtime after it is caught. This closes both round-10 reproductions, a pipeline feeding the path into `xargs` with a runtime and a `find` naming the file before `-exec` with a runtime, plus a `find -exec {}` direct run. Grammar-based segmentation was removed. | scanner function in the gate script |
| **Conservative false positives are pinned.** A new `conservativelyBlocked` list in the helper contract test asserts that prose naming a runtime word and the gate file on one line is blocked. Three former allowed-prose examples moved there. The remaining allowed examples contain no runtime word. | gate test file |
| **Disclosure updated.** The Known Limitations paragraph states the line-level rule, that every one-line command spelling the gate's name is blocked, the conservative cost, and the out-of-model cases: commands assembled across lines, and executions that never spell the gate's name. It is still marked as not accepted or rejected by the user. | `docs/agent-harness.md` |

Please assess: any single-line command that spells the gate's name and executes it but still evades; the practical false-positive cost on packets; and whether the disclosure is accurate.

### Round-11 Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED before GREEN | the helper contract test failed first on the pipeline form; the integration test failed on the new forms |
| Mutation: restore the old boundary that rejects a preceding `-` | the helper contract test fails; file restored byte-identical (`cmp`) |
| Full suites (`harness-hooks`, gate, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 143 tests, 138 pass, 0 fail, 5 skipped (Windows-only) |
| False-positive handling | the stricter rule flagged four lines in each round-10 packet, all prose: three historical round rows and one runtime-boundary bullet. They were reworded as described above. The exported function then flags no line of either round-11 packet, and the orchestrator gate reports no packet-level block. |

## Round 10: Changes Since Round 9

The round-9 scope was `sha256:6576b7723a41809f5d3f94f450f05bf5c7a0d5adf4f585e836fc398df6522966`. Its verdicts are archived and must not be read. The queue is the same 28 paths. Three queued files changed: `.claude/hooks/check-review-artifacts.js`, `.claude/hooks/check-review-artifacts.test.js`, and `docs/agent-harness.md`. The user chose to extend the scanner rather than accept the remaining single-line forms as a documented risk.

Note on wording: this packet describes the blocked command forms in prose instead of spelling them out, because spelled-out forms would be (correctly) blocked by the very scanner under review. The exact strings are in the test file on disk.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **The scanner matches word order within a command segment, not flag grammar.** After canonicalization, quote-to-space, and removal of the allowed fingerprint form, each line is split into segments at `;`, `&&`, `\|\|`, `\|`, and a period followed by whitespace. A segment is unsafe when a runtime or shell word (the same list as round 9) appears anywhere before a token naming the gate script. That token is the gate script or the gate script, bounded so that the `.test.js` file and other files sharing the prefix (such as a `-helper.js`) do not match. A direct `./` run and an assignment of the gate path are unsafe anywhere on the line. Newly blocked: all three round-9 reproductions (a Node option with a separate value before the path, a Node option with an attached `=` value, and a `sh -c` wrapper that receives the path as a positional argument), plus an `env VAR=value` prefix, several options stacked with values, an extensionless gate path, and a trailing extra argument after the fingerprint flag. | `referencesUnsafeFullGateInvocation` |
| **The allowed fingerprint form must end its command.** The safe pattern now requires end of line, a segment separator, or closing punctuation after the flag. A trailing extra argument no longer rides along on the removal. That form is also rejected at runtime with exit 2, by round 8's argument check. | same function |
| **Helper-level contract test.** Codex requested this. The test lists 14 blocked and 8 allowed strings and calls the exported function directly, so a parser regression names the exact form. The real-gate integration test also gains the three round-9 reproductions. One earlier allowed-prose example, a single sentence naming runtime words and then the gate file, is now blocked by design (conservative). The test uses a two-sentence version instead. | `check-review-artifacts.test.js` |
| **The disclosure states the exact rule.** It gives the segment separators, the runtime-before-token rule, the conservative false-positive case, and the out-of-model cases (commands assembled across lines; executions that never spell the gate's name, such as globs or computed strings). It is still marked as not accepted or rejected by the user. | `docs/agent-harness.md` Known Limitations |

Please assess: any single-line, single-segment execution that spells the gate's name and still evades; whether the segment separators create an evasion (for example, a runtime word placed in an earlier segment of the same command); and whether the documented boundary is accurate and testable.

### Round-10 Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED before GREEN | the helper contract test failed on the first round-9 form, and the integration test failed on the new cases, before the fix |
| Mutation: match the whole line instead of segments | fails on the allowed two-sentence prose; restored byte-identical |
| Mutation: require the runtime word adjacent to the path instead of anywhere before it | fails on the value-taking option form; restored byte-identical |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 143 tests, 138 pass, 0 fail, 5 skipped (Windows-only) |
| False-positive scan | the exported function over every line of both round-9 packets flagged none; the orchestrator gate reports no packet-level block for the round-10 packets |

## Round 9: Changes Since Round 8

The round-8 scope was `sha256:b556683eae62af78cc122e6281131e9a64f502242d594869ab01b516f8395696`. Its verdicts are archived and must not be read. The queue is the same 28 paths. Five queued files changed: `.claude/hooks/check-review-artifacts.js`, `.claude/hooks/check-review-artifacts.test.js`, `.claude/commands/stale-info-scan.md`, `docs/stale-info-scan.md`, and `docs/agent-harness.md`.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **The full-gate packet scanner blocks execution shapes instead of enumerating unsafe spellings.** Each line is canonicalized, quote characters become spaces, and the single allowed fingerprint form is removed. The line is then blocked if what remains executes the gate script (the gate script, excluding its `.test` file) in one of three shapes. (1) A runtime or shell word (`node`, `nodejs`, `npx`, `bun`/`bunx`, `deno`, `bash`, `sh`, `zsh`, `fish`, `pwsh`, `powershell`, `cmd`, `exec`, `source`, `env`, `xargs`, optionally `.exe`), optionally followed by flags, whose next argument is the gate path. (2) A direct `./` execution of the gate path. (3) An assignment of the gate path to a variable. Newly blocked cases in the real-gate test: a variable assignment followed by running through it; a `cd` into the hooks directory followed by running the basename; an exported assignment on its own line; a sentence-final period after the path; a `bash -c` wrapper; a flag between the runtime and the path; and a direct `./` run. **Design note:** a first version of this round flagged any marker word anywhere on a line that named the gate. It falsely blocked both round-9 packets on ordinary prose (`$CLAUDE_PROJECT_DIR`, a quoted PowerShell `$files`, and any text describing the detector itself). Those real lines are now pinned as allowed in the test, and the rule was narrowed to execution shapes. The code comment states the threat model: an accidental-instruction guard over packet text, per line, not a sandbox. | `referencesUnsafeFullGateInvocation`; `check-review-artifacts.test.js` |
| **Stale-scan templates obey the blind-review search rule.** Every `rg` line in the active templates that searches `.claude` now carries `--glob '!.claude/reviews/**' --glob '!.claude/*-review-latest.md'`: two lines in each file. A new structural test fails if any repository-wide `rg`, `grep -r`, or `git grep` line over `.claude` in either template lacks both exclusions. Runtime check: `rg -l VERDICT .claude` matched 53 reviewer-output files without the globs and 0 with them. | `.claude/commands/stale-info-scan.md:33,35`, `docs/stale-info-scan.md:146,148`; test |
| **The scanner's limits are disclosed.** A new paragraph in `docs/agent-harness.md` Known Limitations says the scanner is heuristic, names the two backstops (unknown-argument refusal, and `prior_reviewer_outputs_read` enforcement), and is explicitly marked as not yet accepted or rejected by the user. It is not added to the two user-accepted gaps. | `docs/agent-harness.md` Known Limitations |

Please assess: the false-positive surface of the marker list, where a legitimate packet line naming the gate script also contains a marker word; any remaining single-line evasion; and multi-line evasions, which are out of this heuristic's per-line model by design. Also say whether the disclosure is accurate.

### Round-9 Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED before GREEN | the extended blocked-packet test and the stale-scan template test failed before their fixes; after the false-positive discovery, the allowed-references test (with the four real packet lines added) and the new `./` and flag cases failed before the narrowing fix |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 142 tests, 137 pass, 0 fail, 5 skipped (Windows-only), run after the last code change |
| Direct probes before the fix | the variable, `cd`, and trailing-period forms all returned `false` from `referencesUnsafeFullGateInvocation`; all now return `true` (via the real-gate test) |
| Orchestrator gate after writing both round-9 packets | no packet-level block for either packet: no exposure, no full-gate instruction, no missing queued file. The narrowed scanner therefore produces no false positive on these packets. |

## Round 8: Changes Since Round 7

The round-7 scope was `sha256:f389886dae9611409bd8648419d87053420651a9de54ab78619c4ee720543beb`. Its verdicts are archived and must not be read. The queue is the same 28 paths. Six queued files changed: `.claude/hooks/check-review-artifacts.js`, `.claude/hooks/check-review-artifacts.test.js`, `.claude/settings.json`, `.claude/hooks/harness-hooks.js`, `.claude/hooks/harness-hooks.test.js`, and `README.md`.

**Blind-review preflight:** run only the `--print-staged-scope-hash` form of the gate script. Starting this round, the gate rejects every other argument with exit 2 and a usage message, before reading anything. A mistyped flag therefore cannot silently turn into a full run, as happened to a reviewer in round 7.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **The gate CLI runs only when executed directly.** All former top-level CLI code is wrapped in `main(argv)`. It runs only under `if (require.main === module)`. The module exports `canonicalizePathText`, `referencesReviewerOutput`, `referencesUnsafeFullGateInvocation`, `requiresReview`, `stagedIndexRecords`, and `stagedScopeHash`. Requiring the module reads no verdict and prints nothing. The block was re-indented by two spaces; the implementer checked beforehand that no multi-line template literal spans it. | `check-review-artifacts.js` tail |
| **Arguments are validated first.** Only zero arguments (the pre-commit gate) or exactly `--print-staged-scope-hash` (the fingerprint) are accepted. Anything else exits 2 with a usage message before any file or verdict is read. This includes an unknown flag, an extra argument after the fingerprint flag, or the flag without its dashes. | `main` preamble |
| **Quoting cannot evade the full-gate detector.** `referencesUnsafeFullGateInvocation` replaces every `"`, `'`, and backtick on a line with a space before matching. A space is used rather than deletion so that a sentence-final `.` after the script name keeps the path boundary; deletion made even the plain form evade, which was caught during implementation. The replacement only widens detection. Newly blocked: the script path in double or single quotes, `node` itself quoted, and a quoted path followed by a lookalike flag with a suffix. The quoted fingerprint-only form stays allowed. | `referencesUnsafeFullGateInvocation`; the tests extend the existing blocked and allowed cases |
| **NotebookEdit really reaches `queue-edit`.** Per https://code.claude.com/docs/en/hooks#matcher-patterns, a matcher of only letters, digits, `_`, `-`, spaces, `,`, and `\|` is a list of EXACT tool names. `Write\|Edit\|MultiEdit` therefore never matched `NotebookEdit`. The earlier round-3 test modeled it as an unanchored regex and was wrong. The matcher is now `Write\|Edit\|MultiEdit\|NotebookEdit`. The settings test implements the documented two-mode rule and asserts that all four tools match and that `Read` does not. The misleading comment in `queueEdit` is corrected. | `.claude/settings.json`, `harness-hooks.test.js` settings test, `harness-hooks.js` `queueEdit` |
| **README status no longer duplicates volatile phase data.** It points to `.planning/STATE.md` and `.planning/ROADMAP.md` instead of listing phases that had gone stale ("Phase 2 not started"). | `README.md` Status |

### Round-8 Verification (implementer-run, macOS 27.0, Node v26.10.0, Claude Code 2.1.283)

| Evidence | Result |
|---|---|
| RED before GREEN | the extended quoted-invocation test, the unknown-argument test, the no-side-effect import test, and the matcher test all failed before their fixes, each for the intended reason |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 140 tests, 135 pass, 0 fail, 5 skipped (Windows-only) |
| Mutations (each reverted, then the file restored and checked with `cmp`) | removing the quote replacement fails the blocked-packet test; replacing the `require.main` guard with `if (true)` fails the import test; disabling argument validation fails the unknown-argument test; dropping `NotebookEdit` from the matcher fails the settings test |
| Live Claude Code probe after the matcher change | an Edit to a non-queued file was queued by the exec-form hook; reverted, and the queue returned to 28. No live `NotebookEdit` event was fired: the implementer's session has no notebook tool. |

Please assess: remaining detector evasions (a shell variable holding the path, a `cd` into the hooks directory, wrappers like `npx` or `bash -c`); whether exporting helpers creates a new side-effect path; and whether exit code 2 for bad arguments interacts badly with `.beads/hooks/pre-commit`, which passes no arguments.

## Round 7: Changes Since Round 6

The round-6 scope was `sha256:9e41fb85e60e47abec19e1856b7af066e01440b99fbadb706a01759c0682d464`. Its verdicts are archived and must not be read. The queue grew from 26 to 28 paths by adding `.claude/commands/review-gate.md` and `docs/agent-harness.md`. Seven queued files changed: those two files plus `.claude/hooks/check-review-artifacts.js`, `.claude/hooks/check-review-artifacts.test.js`, `.claude/skills/review_packet_generator.md`, `.claude/commands/codex-prompt.md`, and `.claude/commands/antigravity-review.md`.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **Blind reviewers cannot be instructed to run the cross-review gate.** `referencesUnsafeFullGateInvocation` canonicalizes packet text, removes the fingerprint-only form, and rejects any remaining invocation. This includes forward/backslash, percent-encoded separator, and Windows `node.exe` spellings. | the gate script packet checks |
| **The safe preflight remains available.** A packet may contain the `--print-staged-scope-hash` form, which exits after hashing and never opens either verdict. | `.claude/hooks/check-review-artifacts.js` early-return path and tests |
| **Workflow ownership is explicit.** Packet-generation and reviewer commands forbid the full gate during a blind run; the review-gate command and harness docs assign it to the orchestrator only after both initial verdicts are archived. | packet generator, reviewer commands, `review-gate.md`, `docs/agent-harness.md` |

### Round-7 Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED before GREEN | the new unsafe-packet test exited 0 before implementation and failed on `0 !== 1` |
| Focused regression | exact full invocation, backslash path, percent-encoded path, and `node.exe` variants are blocked; fingerprint-only form passes |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 138 tests, 133 pass, 0 fail, 5 skipped (Windows-only) |
| Current staged fingerprint | `sha256:f389886dae9611409bd8648419d87053420651a9de54ab78619c4ee720543beb` |

## Round 6: Changes Since Round 5

The round-5 scope was `sha256:4dff3c9b18c9a8c8c4832fad8013affdf1d7856d110e9c8d514551cb2db99494`. Its verdicts are archived; do not read them. The queue is the same 26 paths. Three queued files changed: `.claude/hooks/check-review-artifacts.js`, `.claude/hooks/check-review-artifacts.test.js`, and `.claude/skills/review_packet_generator.md`.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **The gate reads staged names raw.** Check B's staged set and Check C's staged deletions now come from a new helper, `stagedNames(extraArgs)`. It runs `execFileSync('git', ['diff','--cached','--name-only','-z', ...extraArgs])` and splits on NUL, with no trimming and no unquoting. Before, `execSync('git diff --cached --name-only')` returned names under `core.quotePath` C-quoting (`"docs/caf\303\251.md"`). That string matched no protected prefix and no queue entry, so an unqueued protected file with a non-ASCII, tab, or newline name passed Check B, and the gate exited 0 when it was the only staged file. The unused `execSync` import was removed. | `check-review-artifacts.js` `stagedNames`, Check B/C inputs |
| **Regression tests (real git).** (1) An unqueued `docs/café.md` is blocked by name. (2) An unqueued `docs/a<TAB>b.md` is blocked; this test is skipped on Windows. (3) A queued `docs/café.md` is recognized as queued: it is not reported missing, and Check A then demands reviewer artifacts, so the test cannot pass vacuously. | `check-review-artifacts.test.js` (last three tests) |
| **Packet-side exposure rule.** New `review_packet_generator.md` rules: a packet never contains the other reviewer's output path, not even in "do not read X" instructions. The gate's `referencesReviewerOutput` treats any such mention as exposure. When a queued file's diff contains those filenames, the reviewer reads that diff from disk instead of getting it embedded. Every packet requires searches to exclude review archives and latest verdicts. The gate's exposure detector is deliberately NOT relaxed; see the reasoning below. | `.claude/skills/review_packet_generator.md` Rules |

**Why the detector was not relaxed.** Round 5 found that both generated packets failed the real gate with "exposes the other reviewer verdict before blind review". That was a packet-generation defect: the implementer's packets named the other reviewer's verdict file in a "do not read" line and in the search rule, and they embedded diffs of queued docs that contain that filename. The queued command files do not require the packet to name it. Steps 7/8 there are instructions to the packet author not to read or include it. `referencesReviewerOutput` is a hardened control; it went through seven July review rounds against encoding evasions. An exception for "filename-only, negative instruction" text would reintroduce an ambiguity an attacker-controlled packet could exploit. So this batch changes packet generation, not detection. **This packet follows the rule:** it does not name the other reviewer's output path and does not embed the staged diff. Read each diff from disk with `git diff --cached -- <queued-path>` and a literal path from the manifest. Assess whether this reasoning holds, and whether any remaining workflow step forces a packet to trip the detector.

### Round-6 Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED before GREEN | all 3 new tests failed before the fix, including the queued-name test after it was tightened to require that Check A engages |
| `node --test .claude/hooks/check-review-artifacts.test.js` | 59/59 pass |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 136 tests, 131 pass, 0 fail, 5 skipped (Windows-only) |
| Mutation: drop `-z` from `stagedNames` | all 3 new tests fail; file restored byte-identical (`cmp`) |
| Reviewer-style reproduction | fresh repo with the policy file and an unqueued `docs/café.md`: git prints `"docs/caf\303\251.md"`; the gate exits 1 with `missing from .claude/review-queue.txt: docs/café.md` |
| Packet validation lesson | the round-6 packet incorrectly required a cross-review gate run inside the blind reviewer process; Round 7 removes and machine-blocks that instruction |

## Round 5: Changes Since Round 4 (queue grew from 24 to 26 paths)

The round-4 scope was `sha256:679f567bcc68b63e38adc395460922119d7a53ad667ab561ab9623d4afd58ca8`. Its verdicts are archived and must not be read. The Blind-Review Search Rule below still applies. This round adds two queued files; no other queued file changed.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **The gate fingerprint reads each queued name literally.** A new helper, `stagedIndexRecords(file)`, runs `git --literal-pathspecs ls-files --stage -z -- <file>`. It splits the output on NUL and throws if any record names a path other than `file` itself or a path under `file/`. `stagedScopeHash` builds each descriptor from those records, joined by `\n`, or uses `DELETED` when there are none. This descriptor format matches the previous one for ordinary names, so existing hashes are unchanged; this was verified on this repo's round-4 staged scope before the queue grew. `stagedBlobOid`, used by the archive-copy check, goes through the same helper and returns an OID only for exactly one record. Before this change, a queued name such as `:(exclude)*.txt` was read as pathspec magic and matched no index entry, so its staged bytes could change while the `scope_hash` stayed the same. A glob name such as `a*.txt` could also pull other files' bytes into the hash. | `.claude/hooks/check-review-artifacts.js` `stagedIndexRecords`, `stagedScopeHash`, `stagedBlobOid` |
| **Regression test.** In a real git fixture, for `:(exclude)*.txt`, `:(top)x.md`, `a*.txt`, and `b?.txt`, restaging the queued file with new bytes must change the scope_hash. Separately, changing an unqueued `ab.txt` must NOT change the hash of a queued `a*.txt`. Skipped on Windows, which cannot create `:` or `*` in filenames. | `.claude/hooks/check-review-artifacts.test.js` (last test) |

Assess the claim that no other gate call site passes a queue path to git as a pathspec. Of the gate's git calls, `hash-object --` takes a file path, not a pathspec, and `git diff --cached --name-only` takes no path arguments. Also assess whether the gate's `git diff --cached --name-only` output quoting of unusual names (`core.quotePath`) could make the gate misread the staged set. The implementer has not changed that behavior. Say whether it fails closed.

### Round-5 Verification (implementer-run, macOS 27.0, Node v26.10.0)

| Evidence | Result |
|---|---|
| RED before GREEN | the new gate test failed before the fix: `:(exclude)*.txt: changed staged bytes must change the scope_hash` |
| `node --test .claude/hooks/check-review-artifacts.test.js` | 56/56 pass |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 133 tests, 128 pass, 0 fail, 5 skipped (Windows-only) |
| Mutation: drop `--literal-pathspecs` from `stagedIndexRecords` | the new test fails; file restored byte-identical (`cmp`) |
| Hash stability | after the gate change and before the queue grew, `--print-staged-scope-hash` on this repo still printed the round-4 value `sha256:679f567b…58ca8` |
| Reviewer-style reproduction | in a temp repo queuing `:(exclude)*.txt`, restaging with new content now changes the hash (`f6fc278d…` → `96a26e2f…`); before the fix it did not (`9e37a029…` both times) |

The gate script and its test were edited through the shell, so the PostToolUse hook did not see those edits. Both were added to `.claude/review-queue.txt` by hand before staging.

## Round 4: Changes Since Round 3

The round-3 scope was `sha256:092e58f22d0826e23b22962ac8a43de38d251dfa34d96830883fe8a61193ae7c`. Its verdicts are archived and must not be read. The queue is the same 24 paths. Only `.claude/hooks/harness-hooks.js` and `.claude/hooks/harness-hooks.test.js` changed since round 3. The earlier round sections below still apply unless superseded here.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **Queue entries are never rewritten.** `readQueue` no longer trims: it splits on `\r?\n` and skips whitespace-only lines only. A new `assertRepresentable(entry)` throws when an entry has leading or trailing whitespace or contains `\r`/`\n`. The queue is a line format, and the pre-commit gate's reader (`check-review-artifacts.js:70-71`) trims each line, so such names cannot be represented end to end. `stageQueue` asserts every entry before calling git, and stages nothing if any entry fails. `appendToQueue` (reached from `queue-edit`) asserts before writing. Both failures exit non-zero with a stderr message. The limit is enforced and loud, not silently widened or narrowed. | `readQueue`, `assertRepresentable`, `appendToQueue`, `stageQueue` |
| **Resolved containment is required as well as lexical containment.** After a lexical match, `toRepoRelative` also requires `realpathOfExisting(file)` to lie inside `realpathOfExisting(root)`. A relative path is resolved against `root`. Only a foreign-platform absolute path (for example `C:\` on POSIX) skips this, and such a path cannot match a POSIX root lexically anyway. A symlink inside the repo that points outside (`repo/link -> ../outside`) is no longer queued. A symlink that stays inside the repo still is. | `toRepoRelative` tail |

Superseded by round 5 (now fixed and queued). Round-4 text: out of scope, noted for the reviewer: `check-review-artifacts.js`, which is not queued, computes `stagedScopeHash` with `git ls-files --stage -- <entry>` and no `--literal-pathspecs`. That gate-side pathspec handling is unchanged by this batch. Assess whether it affects this batch's guarantees. Do not require it to be fixed here unless it does.

### Round-4 Verification (implementer-run, macOS 27.0, Node v26.10.0, Claude Code 2.1.283)

| Evidence | Result |
|---|---|
| RED before GREEN | 3 new tests failed before implementation, each for the intended reason: symlink escape, whitespace in `stage-queue`, and unrepresentable names in `queue-edit` |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 132 tests, 127 pass, 0 fail, 5 skipped (Windows-only) |
| Fresh case-sensitive APFS volume (`hdiutil`, no sudo), `TMPDIR` on it | `harness-hooks.test.js` 46/46 pass; volume detached and image deleted afterwards |
| Mutation: disable the resolved-containment check | symlink test fails; file restored byte-identical (`cmp`) |
| Mutation: restore `.trim()` in `readQueue` | whitespace test fails; restored |
| Reviewer-style reproductions | a queue holding `spaced.txt ` (with `spaced.txt` also present) makes `stage-queue` exit 1 with the "cannot be represented" message, staging nothing; `toRepoRelative(repo/link/x.txt, repo)` with `link -> ../outside` returns `null` |
| Live Claude Code probe | an Edit to a non-queued file was queued by the exec-form hook; reverted, and the queue returned to 24 |

Still not executed: Windows and Linux, Node 22, NTFS `ino` semantics for the case probe, live `Stop` and `NotebookEdit` events, a real `bd`, and a live Claude Code worktree session. The whitespace test is skipped on Windows, which cannot create names with trailing spaces.

## Round 3: Changes Since Round 2

The round-2 scope was `sha256:5fd6e5de3e2674353e87c8c863cadaa39df3e83283a3c3529f8ed80c2355d447`. Both verdicts for it are archived under `.claude/reviews/5fd6e5de…/`. Do not read them for this blind round. The queue is the same 24 paths. Only two queued files changed since round 2: `.claude/hooks/harness-hooks.js` and `.claude/hooks/harness-hooks.test.js`. Everything in the Round 2 section below still applies unless it is superseded here.

| Change (implementer claim, to be disproved) | Where |
|---|---|
| **Case folding is probed per filesystem, not assumed per OS.** `isCaseInsensitiveFs(dir)` walks to the nearest existing ancestor whose basename contains letters, stats it and its case-swapped spelling, and returns true only when both are the same file (`dev` and `ino`). It writes nothing. A path with no letters anywhere falls back to the platform default. `toRepoRelative` uses this probe of `root` whenever `caseInsensitive` is not passed. `CASE_INSENSITIVE_FS` is removed, and `isCaseInsensitiveFs` is exported. | `harness-hooks.js` `isCaseInsensitiveFs`, `toRepoRelative` |
| **NotebookEdit is queued.** `queueEdit` reads `tool_input.file_path \|\| tool_input.notebook_path`. The PostToolUse matcher is unchanged (`Write\|Edit\|MultiEdit`). As an unanchored regex it matches `NotebookEdit`, and a new settings-test assertion pins that. | `queueEdit`; settings test |
| **The Stop reminder checks the active worktree.** `stop-review-queue` now reads the hook payload from stdin. It reminds when either the queue of the same-repo worktree holding payload `cwd`, or the project-root queue, has entries. Empty stdin means no payload (a manual run). Non-empty non-JSON stdin exits non-zero with stderr. | `reviewQueueMessage(root, stdinText)`, `main` |

### Round-3 Verification (implementer-run, macOS 27.0, Node v26.10.0, Claude Code 2.1.283)

| Evidence | Result |
|---|---|
| RED before GREEN | 4 new tests failed before implementation, each for the intended reason: filesystem probe, NotebookEdit, worktree Stop, and non-JSON Stop stdin. The default-case test passed before the fix on this case-insensitive volume, by design, and is proven by the case-sensitive run below. |
| Full suites (`harness-hooks`, `check-review-artifacts`, `run-isolated-db-suite`, `os-portability`, `probity.config`) | exit 0; 129 tests, 124 pass, 0 fail, 5 skipped (Windows-only) |
| **Real case-sensitive APFS volume** (`hdiutil create -fs "Case-sensitive APFS"`, attached without sudo; `diskutil info` reports `Case-sensitive APFS`), with `TMPDIR` on that volume | `harness-hooks.test.js`: 43/43 pass. Direct calls: `isCaseInsensitiveFs` → `false`; the case-only sibling `…/REVIEW-ROOT/other.txt` → `null`; `…/review-root/x.txt` → `x.txt`. On the host's default volume `isCaseInsensitiveFs(os.tmpdir())` → `true`. The volume was detached and the image deleted afterwards. |
| Mutation: revert default to the platform constant, run on the case-sensitive volume | default-case test fails; file restored byte-identical (`cmp`) |
| Mutation: drop `notebook_path` | NotebookEdit test fails; restored |
| Reviewer-style reproductions | a synthetic `NotebookEdit` payload queues `a.ipynb`; a real `git worktree` with only its own queue populated produces the Stop reminder while `CLAUDE_PROJECT_DIR` names the main checkout |
| Live Claude Code probe (exec form, changed `queue-edit`) | an Edit to a non-queued file was queued; the edit was reverted and the queue returned to 24 |

Still not executed: Windows and Linux runners, Node 22, a live `Stop` or `NotebookEdit` event in Claude Code (CLI-level only), a real `bd`, and a live Claude Code worktree session. The case probe on NTFS (Windows `ino` semantics) is not run.

## Round 2: Changes Since The Round-1 Staged Scope

The round-1 scope was `sha256:8618cfc0b41a806cad8155a64ec14c5026457f9bbbfcb289d760edf52b6e24af`. Both reviewer verdicts for it are archived under `.claude/reviews/8618cfc…/`. Do not read them for this blind round. The queue is the same 24 paths. Four queued files changed:

| File | Change (implementer claim, to be disproved) |
|---|---|
| `.claude/settings.json` | All five hooks now use exec form: `{"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/harness-hooks.js", "<subcommand>"]}`. No `shell` field. Per the Claude Code hooks reference (https://code.claude.com/docs/en/hooks, "Exec form and shell form"), exec form spawns `command` directly with no shell and substitutes `${CLAUDE_PROJECT_DIR}` into each `args` element as a plain string. |
| `.claude/hooks/harness-hooks.js` | (a) `toRepoRelative` applies `path.posix.normalize` before the containment check, and rejects `.`, `..`, and `../`-prefixed results. (b) Case-insensitive prefix matching only when `CASE_INSENSITIVE_FS` is set (darwin/win32) or passed explicitly as `{ caseInsensitive }`. (c) `queueEdit` selects the queue root from candidates, most specific first: the same-repo worktree holding the file, the same-repo worktree holding the hook-input `cwd`, then the project root. "Same-repo" means an identical `git rev-parse --path-format=absolute --git-common-dir`. Unrelated repositories are never written to. (d) `stageQueue` runs `git --literal-pathspecs add -A -- <paths>`. (e) `beadsOrFallback` detaches `bd`'s stdin (`stdio: ['ignore','inherit','inherit']`). When `bd` is missing, fails with non-zero status or a signal, or cannot spawn, it emits the pointer message with the reason (`bd CLI not found.` / `bd prime failed (exit N).`). (f) The header comment lists these deliberate differences from the PowerShell originals. |
| `.claude/hooks/harness-hooks.test.js` | New tests: case-sensitive sibling; `CASE_INSENSITIVE_FS` default; embedded `..` (relative, absolute, backslash); worktree outside the main checkout; worktree nested at `.claude/worktrees/<name>` with hook cwd at main; unrelated-repo cwd; failing `bd` that also tries to read stdin; literal pathspecs (`*.txt`, `?ne.txt`, `:(glob)*.txt`, `:(top)one.txt`). The settings test now asserts exec form. |
| `scripts/os-portability.test.js` | `npm.cmd` matching is case-insensitive. The Windows user-path rule also matches `C:/Users/`. New rule: absolute POSIX home paths (`/Users/<name>/`, `/home/<name>/`) preceded by start-of-line, whitespace, a quote, `(`, `=`, or `:`. The self-test includes variants plus allowed forms (`~/…`, `app/Users/…`, `src/home/…`). Deliberately unchanged: generated `*-latest.md` packets and verdicts stay excluded, because they embed review diffs whose removed lines contain the very Windows strings being forbidden. Assess whether that exclusion is sound. |
| `.claude/skills/review_packet_generator.md` | One sentence: `stage-queue` stages literal pathspecs. |

### Round-2 Verification (implementer-run, macOS 27.0, Node v26.10.0, Claude Code 2.1.283)

| Evidence | Result |
|---|---|
| RED before GREEN | 8 new tests failed before implementation, each for the intended reason: 7 failures, then 1 more for the nested-worktree case, added before its fix. The unrelated-repo guard passed both before and after, by design. |
| `node --test .claude/hooks/harness-hooks.test.js .claude/hooks/check-review-artifacts.test.js supabase/scripts/run-isolated-db-suite.test.js scripts/os-portability.test.js probity.config.test.js` | exit 0; 125 tests, 120 pass, 0 fail, 5 skipped (Windows-only) |
| Mutation: remove `--literal-pathspecs` | the pathspec test fails; file restored byte-identical (`cmp`) |
| Mutation: remove `path.posix.normalize` | the `..` test fails; file restored |
| Direct counterexamples | `toRepoRelative('a/../../outside.txt')`, `('/tmp/review-root/a/../../outside.txt')`, and `('/tmp/REVIEW-ROOT/other.txt', {caseInsensitive:false})` all return `null`. A queue of `*.txt` makes `stage-queue` fail (git 128) and stage nothing. |
| **Live exec-form dispatch in this Claude Code session** | (1) The PostToolUse hook was temporarily pointed at a scratch wrapper, `args: [wrapper.js, "${CLAUDE_PROJECT_DIR}"]`. An Edit made the wrapper record `argv: ["/Users/yaelsaint-armand/GottaGo"]`, which shows Claude Code reloaded settings live, spawned `node` in exec form, and substituted the placeholder inside `args`. (2) With the real exec-form settings restored, an Edit to a non-queued file was appended to the queue by `queue-edit`. Both probe edits were reverted and the queue returned to exactly 24 lines. |

Still not executed (named gaps): Windows and Linux (the CI matrix only runs after push); Node 22; live `SessionStart`, `PreCompact`, and `Stop` firing (unit tests only); a real `bd` binary (fakes only); a live worktree session in Claude Code (real `git worktree` fixtures only); `bd` resolution on Windows (without a shell, `spawnSync('bd')` does not resolve `bd.cmd`, so it produces `ENOENT` and the pointer message rather than a silent skip).

Note on staging: the archive script put the two round-1 verdict archives in the index, as the gate's archive-copy check requires. `git diff --cached --stat` therefore shows 26 files, but the queue and `scope_hash` cover exactly the 24 queued paths (`stagedScopeHash(queueEntries)`, `check-review-artifacts.js:553`).

## Task Goal And Phase

Out-of-phase harness maintenance (not a GSD phase plan). The repository moved from a Windows development host to macOS on 2026-09-26. This batch:

1. Replaces the five PowerShell-only Claude Code hooks in `.claude/settings.json` with exec-form `node` invocations of a new cross-platform script, `.claude/hooks/harness-hooks.js`, which has its own test file.
2. Adds `harness-hooks.js stage-queue` as the OS-neutral replacement for the PowerShell `git add -A -- $files` staging step used before `--print-staged-scope-hash`.
3. Sets the executable bit (100644 -> 100755) on the five tracked `.beads/hooks/*` git hooks. The contents are unchanged. `core.hooksPath=.beads/hooks` is armed on this clone.
4. Changes `.github/workflows/ci.yml` triggers from `main` to `master` (the repo's actual default branch) and adds a `harness-portability` job with an ubuntu/macos/windows matrix on Node 22.
5. Adds `.gitattributes` (`* text=auto eol=lf`) and `.editorconfig`, plus `scripts/os-portability.test.js`, which guards active docs against OS-specific commands and absolute machine paths, and checks for CRLF in tracked files.
6. Makes docs and commands OS-agnostic: `powershell` fences become `bash`, `npm.cmd` becomes `npm`, and `file:///C:/...` links become relative. It also changes `.metaswarm/project-profile.json` `root` from an absolute Windows path to `.`.
7. `supabase/scripts/run-isolated-db-suite.test.js`: the real-CLI round-trip test now runs a native (non-`.js`) Supabase CLI entry directly instead of always passing it to `node`.

No `app/src/**`, SQL, migration, RLS, PostGIS, trust, or RPC file is in the queue.

## Queue (26 paths as of round 5; the list below is the round-1 set of 24; round 5 added `.claude/hooks/check-review-artifacts.js` and `.claude/hooks/check-review-artifacts.test.js`; the index also holds archived verdicts, which are outside the scope)

```
.claude/settings.json
.claude/hooks/harness-hooks.js
.claude/hooks/harness-hooks.test.js
.beads/hooks/pre-commit
.beads/hooks/pre-push
.beads/hooks/post-checkout
.beads/hooks/post-merge
.beads/hooks/prepare-commit-msg
.claude/commands/antigravity-review.md
.claude/commands/codex-prompt.md
.claude/commands/stale-info-scan.md
.claude/skills/review_packet_generator.md
.claude/skills/SKILL.md
.editorconfig
.gitattributes
.github/workflows/ci.yml
.metaswarm/project-profile.json
ANTIGRAVITY.md
CODEX.md
docs/stale-info-scan.md
docs/verification.md
README.md
scripts/os-portability.test.js
supabase/scripts/run-isolated-db-suite.test.js
```

`git status --short` at packet time shows exactly these 24 paths as staged (`M`/`A`), with no unstaged or untracked entries among them. HEAD is `8d040dd`. Restricted to the queue, `git diff --cached --stat` reports 26 files changed, 1373 insertions, and 79 deletions.

New-file sha256 values (read these files in full from disk):

```
1d21af2fdf09eeff911497a817321c8b2f309e1281502f220ec552617188d6c9  .claude/hooks/harness-hooks.js
e07ccb0c86f32aed244694faf07177a9b3e96421407ddfac77ca1511cf6964da  .claude/hooks/harness-hooks.test.js
cbbc1208492ea958922c237314a369f7088b3180d317b69beacd420d20457f5a  scripts/os-portability.test.js
```

## Round-1 Baseline Verification (implementer-run, superseded where round 2 differs; macOS 27.0, Node v26.10.0, git 2.54.0 Apple Git-157)

| Command | Result |
|---|---|
| `node --test .claude/hooks/harness-hooks.test.js scripts/os-portability.test.js supabase/scripts/run-isolated-db-suite.test.js` | exit 0; 59 tests, 54 pass, 0 fail, 5 skipped. All 5 skips are Windows-only (npm `.cmd` shim parsing, `%VAR%` expansion fixture). |
| `node --test .claude/hooks/check-review-artifacts.test.js` | exit 0; 55/55 pass |
| `node --test probity.config.test.js` | exit 0; 3/3 pass |
| Live hook probe in this Claude Code session: Edit on a non-queued file (`.planning/CLAUDE-HANDOFF-2026-07-09.md`) | the path was appended to `.claude/review-queue.txt` by the new `queue-edit` hook; the edit was reverted with `git checkout` and the queue line removed |
| Working tree vs `~/GottaGo-savepoints/2026-09-26-portability/MANIFEST.md` sha256 values | all 24 queued files byte-identical |
| `node .claude/hooks/harness-hooks.js stage-queue` then `--print-staged-scope-hash` | staged 24 paths; hash shown in the manifest above |

Not executed (named gaps, not claims):

- No run on Windows or Linux. The CI matrix job has never executed, because CI runs only after push. The pre-fix `main` trigger means CI has never run on this repository at all.
- Node 22 (the version CI pins) was not run locally; only Node v26.10.0.
- The `session-start`, `pre-compact`, and both `Stop` hooks were not individually observed firing live in this session. Only `queue-edit` was probed live. The other four are covered by the unit tests only.
- `app/` Jest/typecheck/lint were not run. No app file is in scope.
- The isolated pgTAP suite was not rerun. No SQL is in scope. The last macOS run, from before this session, was 7/8 files; the failing file's fix lives in unrecovered 2026-08-01 work, which is outside this batch.

## Neutral Claim Table

| # | Implementation claim | Authority source | Disproof attempt required | Evidence needed |
|---|---|---|---|---|
| C1 | The five new `node` hook commands are behaviorally equivalent to the removed PowerShell commands, including the queue path format, dedupe, and message text. | Removed PowerShell in `git diff --cached -- .claude/settings.json`; `harness-hooks.js` | Find an input where the old command queued or messaged and the new one does not, or the reverse. Examples: relative paths, `./` prefixes, backslashes, case differences, CRLF queue files, missing trailing newline. | Side-by-side trace plus the tests in `harness-hooks.test.js` |
| C2 | `queue-edit` never silently skips a file inside the repo. Invalid input fails with a non-zero exit. | `harness-hooks.js` failure-policy comment (lines 20-22), `queueEdit`, `toRepoRelative` | Construct an in-repo path that `toRepoRelative` maps to `null`: symlinked roots (`/var` vs `/private/var`), a `CLAUDE_PROJECT_DIR` spelling that differs from the model's `file_path`, case, trailing slashes, Windows drive letters on POSIX, or `..` segments that resolve back inside. Also check how Claude Code treats a non-zero PostToolUse hook exit (blocking or not) and whether the edit is still unqueued. | Code trace plus Claude Code hook semantics from the official docs |
| C3 | `toRepoRelative` never queues a path outside the repo, including sibling directories that share the root as a name prefix and `..` escapes. | `toRepoRelative`, `stripPrefixIgnoreCase` | Case-insensitive prefix matching on a case-sensitive filesystem (Linux) when two distinct directories differ only by case. A relative `file_path` containing `../` segments in the middle (for example `a/../../x`) is not normalized before the `startsWith('../')` check. | Counterexample, or a reasoned proof |
| C4 | `resolveProjectRoot` writes the root queue, never `app/.claude/review-queue.txt`, even when run from `app/`. | `resolveProjectRoot` order: env, then git top-level, then marker walk | `CLAUDE_PROJECT_DIR` set to a path that exists but is not the repo. Git unavailable. Worktrees or submodules. | Tests at `harness-hooks.test.js:61` and `:72`, plus reasoning |
| C5 | `stage-queue` stages exactly the queued paths, including deletions, with no shell and no option injection, and fails loudly on an empty queue or a rejected path. | `stageQueue` | A queued name starting with `-`. A name git treats as a pathspec glob or magic (`*`, `:(...)`), which could stage more than listed. A deleted file path. | Test at `harness-hooks.test.js:339`, plus git pathspec semantics (`git help glossary`, "pathspec") |
| C6 | `session-start` and `pre-compact` fall back to the pointer message only when `bd` is missing, and pass `bd` output through as hook context when it exists. | `beadsOrFallback` | `bd` present but failing (non-zero): nothing is emitted, which matches the old behavior? `stdio: 'inherit'` also inherits the hook's stdin: can `bd` block on or consume stdin? On Windows, does `spawnSync('bd')` without a shell resolve `bd.cmd`/`bd.exe` the way PowerShell `Get-Command` did? | Code trace plus Node `child_process` docs (PATHEXT behavior) |
| C7 | The `.beads/hooks/*` mode change (100644 to 100755) is required and sufficient for git to run them on POSIX when `core.hooksPath=.beads/hooks`. | `git diff --cached` (mode-only), `githooks(5)` | Git on POSIX ignores non-executable hooks, with a warning under `advice.ignoredHook`. Confirm the contents are unchanged and each has a valid shebang that works on macOS/Linux/Git-for-Windows. | Shebang lines plus `githooks(5)` |
| C8 | Changing CI to `master` makes CI run, and the new matrix job needs no `npm install` for its four test files. | `ci.yml`; `git branch -a` / default branch | Does any of the four test files `require` a non-builtin module? Do they depend on `git` config, a Supabase CLI, or Docker that is absent on runners? Do the Windows-only skip conditions (and Windows-specific tests) pass or skip correctly on `windows-latest`? `actions/checkout` on Windows with `.gitattributes eol=lf`. | `require` graph of the test files; skip guards |
| C9 | `.gitattributes` `* text=auto eol=lf` prevents CRLF drift that would change `scope_hash`, and does not corrupt any tracked binary or lockfile. | `.gitattributes`; `os-portability.test.js:92`/`:99` | A tracked binary type not in the `binary` list (for example `.mp3`, `.jar`, `.keystore`, `.p12`, `.sqlite`, `.mbtiles`, fonts) that `text=auto` might misclassify. Existing index entries with CRLF that would renormalize and silently widen a future diff. | `git ls-files --eol` output |
| C10 | `os-portability.test.js` catches OS-specific commands and absolute machine paths in active docs without flagging historical records. | test file (lines 76, 104) | Evasions the regexes miss (for example `npm.cmd` in other casing, `C:/` with forward slashes, `/Users/<name>/`). Which files are "active" versus excluded, and whether the exclusion list hides an active doc. | Read the pattern and scope lists |
| C11 | The docs and command changes are wording or syntax only, and do not change any review-gate rule, verdict format, or blind-review requirement. | Diffs of `antigravity-review.md`, `codex-prompt.md`, `review_packet_generator.md`, `ANTIGRAVITY.md`, `CODEX.md` | Any removed or reworded normative sentence. The new `stage-queue` instruction still means "stage exactly the queue, including deletions" before hashing. | Diff reading |
| C12 | `.metaswarm/project-profile.json` `root: "."` is interpreted relative to the repo root by every consumer. | profile file; consumers found by grep | A consumer that resolves `root` against its own cwd or expects an absolute path. | `rg -n "project-profile|\\.root" .` |
| C13 | The `run-isolated-db-suite.test.js` change mirrors `makeRunSupabase()` in `run-isolated-db-suite.js`, so the test exercises the production spawn shape for both npm (`.js`) and native CLI installs. | `run-isolated-db-suite.js` `makeRunSupabase` / `resolveCliJsEntry` | Production and test choose between `node entry` and direct execution by different rules (for example an extension check versus a shebang check), so the test could pass while production spawns differently. | Side-by-side comparison of both files |
| C14 | A blind packet cannot direct its reviewer into the full cross-review gate, while the fingerprint-only preflight still works and the orchestrator retains post-archive validation. | `referencesUnsafeFullGateInvocation`, packet generator, reviewer commands, `review-gate.md`, harness flow | Try alternate separators/encoding, `node.exe`, a safe command chained with an unsafe one, negative prose containing the command, and an ordinary fingerprint-only command. Confirm the detector runs for both packet roles and does not inspect verdict content itself. | Real-git gate tests plus source trace from packet load through diagnostics |

## Runtime Boundary And Mock Audit

Trace each boundary end to end: caller, then resolver, then transport, then OS/process, then consumer, then resulting state.

- **Claude Code hook dispatch** (round 6): exec form. Claude Code resolves `node` on `PATH` and spawns it with `args`, with no shell on any OS, substituting `${CLAUDE_PROJECT_DIR}` as a plain string. Questions: does substitution happen for every event type (PostToolUse, SessionStart, PreCompact, Stop), or only where live-verified (PostToolUse)? What happens on a host where `node` is not on the PATH Claude Code sees, and is that failure loud? On Windows, is `node` resolved as `node.exe` without a shell? Only Stop can block, via exit 2; a failed `queue-edit` is a non-blocking notice. So a dead hook remains a gate-bypass risk, with the pre-commit Check B as the backstop for protected paths only.
- **Hook stdin payload**: `queue-edit` reads the PostToolUse JSON from fd 0. Tests pass synthetic JSON via `spawnSync(..., { input })`, and the one live probe covered only the Edit tool. Are the `Write` and `NotebookEdit` payloads (`tool_input.file_path` vs `notebook_path`) handled? Check which tools the settings `matcher` covers.
- **Filesystem path spelling**: macOS symlinked tmp/var roots and case-insensitive APFS; Linux case-sensitive ext4; Windows drive letters and backslashes. The tests use temp directories, which on macOS exercise the `/var` to `/private/var` case.
- **git subprocesses**: `resolveProjectRoot` and `stageQueue` call `git` without a shell. The tests create real temp git repos rather than mocks, so git itself is real. Confirm this for each `stage-queue` test.
- **`bd` subprocess**: the tests simulate "bd missing" through `PATH` manipulation. The "bd present" path is not exercised by any test. Is that a mock gap?
- **Pre-commit gate** (`.beads/hooks/pre-commit`, which calls the gate script): not modified apart from the mode bit, but it consumes the `scope_hash` this batch's `stage-queue` feeds. Does `stage-queue` produce the same index state as the old PowerShell `git add -A -- $files`?
- **CI runners**: none of this batch's claims about ubuntu or windows runners has executed evidence.
- **Mocks that could hide production behavior**: the `harness-hooks.test.js` settings test (line 361) statically asserts the command strings. It does not run the harness, and it does not prove that Claude Code's shell expands `$CLAUDE_PROJECT_DIR` on every OS.

## 60-Second User Advocacy

There is no end-user runtime change: no app, map, search, or submission path is touched. The relevant risk is indirect. If the review gate silently stops queuing edits, unreviewed changes to emergency-critical code could ship. Assess whether any failure mode in C2, C4, C5, or the hook-dispatch boundary produces a silent gate bypass rather than a loud failure.

## Required Verdict Format

Write the verdict to `.claude/codex-review-latest.md`, run `node .claude/hooks/archive-review-artifact.js codex`, and print the verdict:

```md
## Codex Review - OS-portability harness batch (round 12)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

scope_hash: sha256:46d7a8a574650fd77b8306b24c429709dd00edfc8d2a3ebb3410da9f2aff846a
review_id: rv-20260927T151944Z-cc859f85
risk_level: high
runtime_required: true
blind_review: true
prior_reviewer_outputs_read: false
evidence_level: 0|1|2|3|4
runtime_evidence: executed|not_applicable|unavailable

### Reviewed Queue
- (all 28 paths, each semantically inspected)
### Skills Applied
### Findings
- [CRITICAL/MAJOR/MINOR] file:line - description, impact, required fix
### Open Questions
### Verification
### Evidence Receipts
### Adversarial Disproof
- Address C1-C14 individually.
### Unverified Boundaries
### Runtime Boundary Check
### Approved
```

## Staged Diff (read from disk)

The diff is not embedded because several queued workflow files contain protected reviewer-output names and orchestrator-only commands. Inspect each queued path from the manifest directly, using one literal path at a time:

```bash
git diff --cached -- <queued-path>
```

Semantically inspect all 28 queued paths. Focus first on the three Round-12 files named above, then the earlier rounds' files, then confirm every remaining queued path against `HEAD` using literal per-path diff commands.

## Blind-Safe Reviewer Preflight

Recompute only the staged fingerprint and compare it with the manifest. Do not execute cross-review artifact validation from this reviewer process. Save and archive this verdict first; the orchestrator owns the combined validation after both initial archives exist.
