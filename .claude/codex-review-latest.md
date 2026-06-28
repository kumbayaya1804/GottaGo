## CODEX VERDICT: REQUEST CHANGES

### Checklist Results

- 2.1 TDD Guard Compliance: FAIL - `02-01b` lists six `src/features/auth/` source files but omits a paired `useSession` test from `files_modified`; `02-02` lists `profileStats.ts` but omits `profileStats.test.ts` from `files_modified`. Task 5, Task 3, and Task 6 are marked TDD where required, and constants/migrations are correctly excluded.
- 2.2 jest@29.7.0 Pin Protection: PASS - `02-01a` explicitly says not to upgrade pinned Jest and requires a post-install Jest 29.x check.
- 2.3 Security: No PII in Logs: PASS - `02-01b` and `02-02` include the Section 20 security checklist forbidding email, display name, and precise GPS coordinates in `console.log`, analytics, or crash/error reports; no task instructs PII/GPS logging.
- 2.4 Security: Generic Auth Error Copy: FAIL - `02-01b` requires the correct copy and separate network copy, but acceptance criteria only grep for the string and do not require a test proving all credential-failure branches render exactly "Invalid email or password."
- 2.5 Security: No User Enumeration via Display Name Check: PASS - `02-01b` requires `checkDisplayNameAvailable` before `signUp`, uses only "That display name is already taken.", and maps the 23505 unique-violation backstop.
- 2.6 Security: Account Deletion Type-DELETE Gate: FAIL - `02-02` requires exact `DELETE` and forbids swipe-to-dismiss, but the test requirement does not explicitly assert `"delete"` and `"Delete"` stay disabled.
- 2.7 Security: OAuth Redirect Allow-List: PASS - `02-02` blocks on dashboard confirmation for `gotta-go://auth/callback`; current plan text uses `gotta-go://` and no `gottago://` string was found in the scoped plans.
- 2.8 Security: Platform.OS Gate for Google OAuth: PASS - `02-02` requires `Platform.OS === 'android'`, iOS disabled Apple stub only, and a render test for Android Google/no-Apple plus iOS Apple/no-Google.
- 2.9 Security: PKCE OAuth Flow: FAIL - `02-02` requires `skipBrowserRedirect: true`, `WebBrowser.openAuthSessionAsync`, `?code=`/`exchangeCodeForSession`, and behavior for `cancel`/`dismiss`, but acceptance criteria only require a `cancel` test.
- 2.10 GPS Consent Test Assertion: PASS - `02-01b` requires no RPC on denied status and a gps-consent screen test covering denied/skip with no consent write.
- 2.11 No Raw Hex in Screen StyleSheets: FAIL - raw-hex grep checks omit modified screen files in both `02-01b` and `02-02`.
- 2.12 LEGAL_URLS Placeholder Handling: PASS - `02-01a` allows placeholder constants when Termly URLs are unknown and requires placeholder status in the summary.
- 2.13 Password Length Alignment: PASS - `02-01a` aligns `minimum_password_length` to 8, and `02-01b` requires the Zod password schema to enforce 8 characters with the locked copy.
- 2.14 Validation Timing: PASS - `02-CONTEXT.md` locks submit-only validation, and `02-01b` requires on-submit validation only with no blur validation.

### Findings

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-01b-PLAN.md:10` - `files_modified` lists `app/src/features/auth/useSession.ts` at line 13, but the paired test list at lines 16-20 omits `app/src/features/auth/__tests__/useSession.test.ts`.

Specific fix required: add `app/src/features/auth/__tests__/useSession.test.ts` to `files_modified` and include it in the Task 5 targeted test command, or fold the hook into `SessionProvider.test.tsx` and remove `useSession.ts` as a separate new source file.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-02-PLAN.md:13` - `files_modified` lists `app/src/features/profile/profileStats.ts` at line 16, but the paired test list at lines 17-20 omits `app/src/features/profile/__tests__/profileStats.test.ts`. Task 3 already expects `features/profile/profileStats.test.ts` in its command, so the frontmatter and task disagree.

Specific fix required: add `app/src/features/profile/__tests__/profileStats.test.ts` to `files_modified`.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-01b-PLAN.md:241` - The acceptance criteria grep for `"Invalid email or password."` and forbid more-specific branches, but the prompt requires a test asserting that exact string appears for all credential failures. A grep can pass even if only one error path is generic while another path still leaks a distinct user-enumerating state.

Specific fix required: add an explicit sign-in test requirement covering every credential-failure branch planned for `signInWithPassword`, asserting the rendered copy is exactly `"Invalid email or password."` and that the network copy remains separate.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-02-PLAN.md:305` - The DeleteAccountModal test requirement says the destructive button is disabled until input equals `"DELETE"`, but it does not require the case-sensitivity regressions named in the prompt: `"delete"` and `"Delete"` must remain disabled.

Specific fix required: update the acceptance criteria to require tests for empty input, `"delete"`, `"Delete"`, and only exact `"DELETE"` enabling the destructive action.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-02-PLAN.md:245` - The OAuth behavior block covers both `'cancel'` and `'dismiss'`, but acceptance only requires a `'cancel'` test. On mobile OAuth, dismiss paths are common and should not crash or surface as auth failures.

Specific fix required: require tests asserting both `cancel` and `dismiss` results return `null` without throwing.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-01b-PLAN.md:245` - Task 7 modifies `forgot-password.tsx` and `reset-password.tsx`, but the raw-hex grep covers only `sign-in.tsx`, `sign-up.tsx`, and `gps-consent.tsx`.

Specific fix required: include `app/src/app/(auth)/forgot-password.tsx` and `app/src/app/reset-password.tsx` in the no-raw-hex acceptance grep.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-02-PLAN.md:275` - Task 4 modifies `sign-up.tsx`, but the raw-hex grep covers only `sign-in.tsx` and `auth/callback.tsx`.

Specific fix required: include `app/src/app/(auth)/sign-up.tsx` in the Task 4 no-raw-hex acceptance grep.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-02-PLAN.md:308` - Task 5 modifies modal/screen files and has a raw-hex grep, but the overall `02-02` screen-surface check still depends on Task 4's incomplete grep, so not every modified screen file in the plan is covered.

Specific fix required: after fixing Task 4, confirm `02-02` raw-hex acceptance covers every modified screen/component file: `sign-in.tsx`, `sign-up.tsx`, `auth/callback.tsx`, `profile.tsx`, `DeleteAccountModal.tsx`, and `AuthRequiredModal.tsx`.

**[SEVERITY: REQUEST CHANGES]** `.planning/phases/02-auth-profiles/02-02-PLAN.md:125` - `02-01-SUMMARY.md` is referenced in the plan-level context block, but Step 3 asks whether `02-02` correctly references the summary as a `read_first` dependency. It is not present in any task-level `read_first` list at lines 160-167, 199-202, 226-232, 252-258, 282-287, or 319-324.

Specific fix required: add `.planning/phases/02-auth-profiles/02-01-SUMMARY.md` to the relevant task-level `read_first` list, or add a top-level `read_first` section that the executor is required to load before any `02-02` task.

### Summary

The Phase 2 plan set is directionally sound and covers the major security boundaries: server-side RPCs for privileged writes, PKCE OAuth, Android-only Google OAuth, generic auth errors, GPS consent written only on OS grant, and no PII/GPS logging. I cannot approve execution yet because several acceptance criteria do not prove the specific safeguards requested by the review prompt, and two new `src/features/**` source files are missing explicit paired tests in `files_modified`.

No BLOCK findings were identified in this pre-execution plan review. Fixing the REQUEST CHANGES items above should be a narrow planning-doc update, not a redesign.

### Verification

- Read `.claude/codex-prompt-latest.md` after the update; it now explicitly requires writing the full verdict to `.claude/codex-review-latest.md`.
- Read `CODEX.md`, `CLAUDE.md`, and `docs/review-severity.md`.
- Read `docs/agent-harness.md`, `docs/stale-info-scan.md`, `.planning/stale-info-scan-latest.md`, `.planning/phases/02-auth-profiles/02-CONTEXT.md`, `02-RESEARCH.md`, and `02-VALIDATION.md`.
- Read `.planning/phases/02-auth-profiles/02-01a-PLAN.md`, `02-01b-PLAN.md`, and `02-02-PLAN.md` from disk.
- Ran targeted `rg` checks for paired tests, TDD markers, raw-hex greps, OAuth redirect strings, generic auth copy, DELETE gating, PKCE calls, GPS consent assertions, LEGAL_URLS handling, and PII logging constraints.
- Ran `git status --short`; it returned no changed files, only warnings that Git could not access `C:\Users\mrsai/.config/git/ignore`.
- No code tests, lint, typecheck, Supabase live checks, or emulator smoke tests were run because this is a pre-execution planning review and no application code exists yet for this scope.

### Sign-off

Codex - June 28, 2026

---
Severity definitions (from docs/review-severity.md):
- BLOCK: security hole, data loss, or production-breaking flaw - must fix before any execution.
- REQUEST CHANGES: correctness issue or missing guard - fix before execution.
- NOTE: improvement suggestion, does not block execution.

APPROVE requires zero BLOCKs and zero REQUEST CHANGES.
