<context>
Project: Gotta Go — crowdsourced bathroom finder
Stack: Expo SDK 55 / React Native 0.83.6 / React 19 / Expo Router v4 / Supabase + PostGIS / Mapbox
Review type: Pre-execution PLAN review (Phase 2: Auth & Profiles). No application code has been written yet.
Round: 2 (re-review of the 9 RC findings from Round 1)
</context>

<role>
You are Codex, the implementation quality and security auditor for Gotta Go. Your counterpart Antigravity reviews architecture and data integrity. You focus on implementation correctness, TypeScript safety, test quality, security/privacy, and user-visible failure states.

Read your standing instructions from CODEX.md before reviewing.
</role>

<instructions>

## Step 1 — Read all files in scope from disk

Do not rely solely on this prompt. Read each file directly:

```
.planning/phases/02-auth-profiles/02-01b-PLAN.md
.planning/phases/02-auth-profiles/02-02-PLAN.md
docs/review-severity.md
CODEX.md
```

## Step 2 — Verify each RC finding from Round 1 is resolved

Round 1 returned REQUEST CHANGES with 9 findings. Verify each one against the current files on disk.
For each finding, state RESOLVED, PARTIALLY RESOLVED, or STILL FAILING with one line of evidence.

### RC-1 — 02-01b: `useSession.test.ts` missing from `files_modified`

Check `02-01b-PLAN.md` frontmatter:
- [ ] `app/src/features/auth/__tests__/useSession.test.ts` is present in `files_modified`

Check Task 5 acceptance_criteria test command:
- [ ] `features/auth/useSession.test.ts` appears in the `npm test --` command

### RC-2 — 02-02: `profileStats.test.ts` missing from `files_modified`

Check `02-02-PLAN.md` frontmatter:
- [ ] `app/src/features/profile/__tests__/profileStats.test.ts` is present in `files_modified`

Also verify the Task 3 acceptance_criteria test command already includes `features/profile/profileStats.test.ts` (it did in Round 1 — confirm it still does).

### RC-3 — 02-01b: sign-in test does not assert all credential-failure branches

Check Task 7 acceptance_criteria in `02-01b-PLAN.md`:
- [ ] There is an explicit test requirement (not just a grep) asserting every `supabase.auth.signInWithPassword` error branch renders exactly "Invalid email or password."
- [ ] The requirement calls out at least: wrong password, unregistered email, and generic server error paths
- [ ] The network-failure branch copy is specified separately

### RC-4 — 02-02: DeleteAccountModal test missing `"delete"` and `"Delete"` regressions

Check Task 5 acceptance_criteria in `02-02-PLAN.md`:
- [ ] The test requirement explicitly requires empty input, `"delete"`, and `"Delete"` to keep the button disabled
- [ ] Only exact `"DELETE"` enables the button

### RC-5 — 02-02: OAuth test only requires `cancel`, not `dismiss`

Check Task 3 acceptance_criteria in `02-02-PLAN.md`:
- [ ] The test requirement asserts both `'cancel'` AND `'dismiss'` results return null without throwing

### RC-6 — 02-01b: raw-hex grep omits `forgot-password.tsx` and `reset-password.tsx`

Check Task 7 acceptance_criteria in `02-01b-PLAN.md`:
- [ ] `app/src/app/(auth)/forgot-password.tsx` is included in the raw-hex grep
- [ ] `app/src/app/reset-password.tsx` is included in the raw-hex grep

### RC-7 — 02-02: raw-hex grep in Task 4 omits `sign-up.tsx`

Check Task 4 acceptance_criteria in `02-02-PLAN.md`:
- [ ] `app/src/app/(auth)/sign-up.tsx` is included in the Task 4 raw-hex grep

### RC-8 — 02-02: 02-02 screen coverage not complete across Tasks 4 and 5

Verify that between Task 4 and Task 5 acceptance_criteria, every modified screen/component file in `02-02-PLAN.md` is covered by at least one raw-hex grep:
- [ ] `app/src/app/(auth)/sign-in.tsx` — Task 4
- [ ] `app/src/app/(auth)/sign-up.tsx` — Task 4 (this was the missing one)
- [ ] `app/src/app/auth/callback.tsx` — Task 4
- [ ] `app/src/app/(tabs)/profile.tsx` — Task 5
- [ ] `app/src/app/(components)/DeleteAccountModal.tsx` — Task 5
- [ ] `app/src/app/(components)/AuthRequiredModal.tsx` — Task 5

### RC-9 — 02-02: `02-01-SUMMARY.md` not in any task-level `read_first`

Check `02-02-PLAN.md`:
- [ ] A top-level `<read_first>` section (or equivalent) appears before `<tasks>` requiring the executor to read `.planning/phases/02-auth-profiles/02-01-SUMMARY.md` before any task starts

## Step 3 — Confirm no regressions introduced

The fixes were narrow plan-doc edits. Confirm:
1. The `files_modified` frontmatter in both plans is internally consistent — every source file has a paired test file and vice versa (no orphans introduced by the additions)
2. The Task 3 acceptance_criteria test command in `02-02-PLAN.md` still lists all four test files (oauth, updateProfile, deleteAccount, profileStats)
3. No other acceptance_criteria lines were accidentally changed

</instructions>

<round_1_verdict>
## CODEX VERDICT: REQUEST CHANGES (Round 1)

9 findings, all REQUEST CHANGES severity. Antigravity returned APPROVE in Round 1 with 2 NOTEs (both non-blocking).

The 9 RC findings and their stated fixes (applied between rounds):

1. `02-01b files_modified` missing `useSession.test.ts` → added to frontmatter + Task 5 test command
2. `02-02 files_modified` missing `profileStats.test.ts` → added to frontmatter
3. `02-01b Task 7` sign-in grep insufficient → explicit branch-covering test requirement added
4. `02-02 Task 5` DELETE gate missing case-sensitivity regressions → added `"delete"` + `"Delete"` cases
5. `02-02 Task 3` OAuth test only required `cancel` → added `dismiss` requirement
6. `02-01b Task 7` raw-hex grep missing `forgot-password.tsx` + `reset-password.tsx` → added both
7. `02-02 Task 4` raw-hex grep missing `sign-up.tsx` → added
8. `02-02` overall screen coverage incomplete after Task 4 fix — verify all 6 screen files now covered
9. `02-02` no task-level `read_first` for `02-01-SUMMARY.md` → top-level `<read_first>` block added before `<tasks>`

Codex - June 28, 2026
</round_1_verdict>

<output_format>
## CODEX VERDICT: [APPROVE / REQUEST CHANGES / BLOCK]

### RC Finding Resolution
[For each of the 9 RC findings, state RESOLVED / PARTIALLY RESOLVED / STILL FAILING with one line of evidence]

### Regression Check
[PASS or FAIL for each of the 3 regression checks in Step 3]

### New Findings (if any)
[Any new BLOCK or REQUEST CHANGES introduced by the edits — none expected]

### Summary
[1-2 sentences]

### Sign-off
Codex — [date]

---
Severity definitions (from docs/review-severity.md):
- BLOCK: security hole, data loss, or production-breaking flaw — must fix before any execution
- REQUEST CHANGES: correctness issue or missing guard — fix before execution
- NOTE: improvement suggestion, does not block execution
APPROVE requires zero BLOCKs and zero REQUEST CHANGES.

After completing the review, write the full verdict to `.claude/codex-review-latest.md`.
</output_format>
