<context>
Project: Gotta Go — crowdsourced bathroom finder
Stack: Expo SDK 55 / React Native 0.83.6 / React 19 / Expo Router v4 / Supabase + PostGIS / Mapbox
Review type: Pre-execution PLAN review (Phase 2: Auth & Profiles). No application code has been written yet.
Round: 1 (first Codex review of Phase 2 plans)
</context>

<role>
You are Codex, the implementation quality and security auditor for Gotta Go. Your counterpart Antigravity reviews architecture and data integrity. You focus on implementation correctness, TypeScript safety, test quality, security/privacy, and user-visible failure states.

Read your standing instructions from CODEX.md before reviewing.
</role>

<instructions>

## Step 1 — Read all files in scope from disk

Do not rely solely on this prompt. Read each file directly:

```
.planning/phases/02-auth-profiles/02-01a-PLAN.md
.planning/phases/02-auth-profiles/02-01b-PLAN.md
.planning/phases/02-auth-profiles/02-02-PLAN.md
.planning/phases/02-auth-profiles/02-CONTEXT.md
.planning/phases/02-auth-profiles/02-RESEARCH.md
.planning/phases/02-auth-profiles/02-VALIDATION.md
docs/review-severity.md
CODEX.md
CLAUDE.md (TDD Guard section, scope table)
```

## Step 2 — Verify each item in the checklist below

Work through the list item by item. For each item, state PASS, FAIL, or NOT APPLICABLE with evidence.

### 2.1 TDD Guard Compliance

The project uses TDD Guard (enforced via pre-commit hook). Rules from CLAUDE.md:

- Every new `src/features/**` file must have a paired test file BEFORE implementation begins (TDD order: test → fail → implement → pass).
- Coverage threshold: 100% lines/branches/functions/statements for `src/features/**` and `src/lib/**`.
- `src/app/**` screen files are TDD-tested but EXCLUDED from coverage collection (thin wrappers).
- jest@29.7.0 is PINNED — do not upgrade.
- `supabase/migrations/**` is OFF for TDD Guard (raw SQL, reviewed by architecture).

Check in 02-01b-PLAN.md:
- [ ] All 6 `src/features/auth/` source files have corresponding `__tests__/` files in `files_modified`
- [ ] Task 5 is marked `tdd="true"` and specifies test-first RED->GREEN->REFACTOR

Check in 02-02-PLAN.md:
- [ ] All `src/features/auth/` and `src/features/profile/` source files have corresponding test files
- [ ] Tasks 3 and 6 are marked `tdd="true"`

Check 02-01a-PLAN.md:
- [ ] Token files (constants) are correctly excluded from TDD requirement (non-behavioral)
- [ ] Migrations correctly excluded from TDD requirement

### 2.2 jest@29.7.0 Pin Protection

Check 02-01a Task 2 (package install):
- [ ] Task explicitly says "do not let jest be upgraded from the PINNED 29.7.0"
- [ ] Acceptance criteria includes a step that verifies jest version after the install

### 2.3 Security: No PII in Logs

Check all three plans for any task that handles email, display_name, or GPS coordinates:
- [ ] No task instructs logging `email` or `display_name` to `console.log`
- [ ] No task instructs logging GPS coordinates
- [ ] The section 20 Component Acceptance Checklist Security section (cited in 02-01b and 02-02) includes "No PII ... written to console.log" — verify it is present and covers email/display_name

### 2.4 Security: Generic Auth Error Copy

Check 02-01b Task 7 (sign-in screen):
- [ ] Error copy on bad credentials is exactly "Invalid email or password." — no "user not found" or "incorrect password"
- [ ] A test asserts this exact string appears for ALL credential failures
- [ ] Network failure copy is separate ("Couldn't sign in. Check your connection and try again.")

### 2.5 Security: No User Enumeration via Display Name Check

Check 02-01b Task 7 (sign-up screen):
- [ ] `checkDisplayNameAvailable` is called before `supabase.auth.signUp` (pre-check)
- [ ] The error message "That display name is already taken." does not reveal whether the EMAIL is taken
- [ ] A 23505 unique-violation backstop is also handled (server-side race safety)

### 2.6 Security: Account Deletion Type-DELETE Gate

Check 02-02 Task 5 (Delete Account modal):
- [ ] The "Delete Account" button is DISABLED until input field contains exactly "DELETE" (case-sensitive)
- [ ] A test asserts the button is disabled when input is "delete" or "Delete" (not just when empty)
- [ ] `swipe-to-dismiss` is explicitly forbidden for this modal (accidental deletion risk)

### 2.7 Security: OAuth Redirect Allow-List

Check 02-02 Task 2 (human-verify checkpoint):
- [ ] The checkpoint requires adding `gotta-go://auth/callback` to the Supabase redirect allow-list
- [ ] The checkpoint does NOT allow proceeding until this is confirmed
- [ ] The plan uses `gotta-go://auth/callback` (not `gottago://`) throughout

### 2.8 Security: Platform.OS Gate for Google OAuth

Check 02-02 Task 4 (sign-in screen OAuth buttons):
- [ ] Google button is behind `Platform.OS === 'android'` check
- [ ] iOS renders disabled Apple stub ONLY — no Google button
- [ ] A test asserts: on Android, Google button renders + no Apple stub; on iOS, Apple stub renders + no Google button

### 2.9 Security: PKCE OAuth Flow

Check 02-02 Task 3 (oauth.ts module):
- [ ] The OAuth flow uses `skipBrowserRedirect: true` + `WebBrowser.openAuthSessionAsync`
- [ ] The callback parses `?code=` (PKCE) not implicit tokens
- [ ] `supabase.auth.exchangeCodeForSession(code)` is called with the extracted code
- [ ] A test asserts the `cancel`/`dismiss` result returns `null` without throwing

### 2.10 GPS Consent Test Assertion

Check 02-01b Task 5 (gpsConsent.ts):
- [ ] A test explicitly asserts NO `rpc('set_gps_consent')` call when the OS status is `denied`
- [ ] A test explicitly asserts NO rpc call when the user taps "Skip for now"

### 2.11 No Raw Hex in Screen StyleSheets

Check 02-01b Tasks 6 and 7 and 02-02 Tasks 4 and 5:
- [ ] Each task's acceptance_criteria includes a grep command checking for no raw hex (`#[0-9A-Fa-f]{6}`) in the screen files
- [ ] Token files (Colors.ts) ARE expected to contain hex values — make sure the grep excludes them

### 2.12 LEGAL_URLS Placeholder Handling

Check 02-01a Task 3 (legal.ts constant file):
- [ ] The plan explicitly handles the case where Termly URLs are not yet known (placeholder constants)
- [ ] The SUMMARY is required to note the placeholder status so it is not forgotten before the review gate

### 2.13 Password Length Alignment

Check 02-01a Task 2 and 02-01b Task 5:
- [ ] `supabase/config.toml` minimum_password_length is changed from 6 to 8 (02-01a Task 2)
- [ ] Zod `password` schema in validation.ts enforces minimum 8 characters (02-01b Task 5)
- [ ] These two values are aligned

### 2.14 Validation Timing

Check 02-01b Task 7 (all auth forms):
- [ ] Forms validate on submit only — no inline/blur validation
- [ ] This is confirmed in the CONTEXT.md and the plan does not contradict it

## Step 3 — Assess overall plan quality

1. Are all acceptance_criteria runnable automated commands (no manual-only checks listed as automated)?
2. Is the dependency chain between plans correct (02-01a → 02-01b → 02-02)?
3. Does 02-02 correctly reference `02-01-SUMMARY.md` (produced at end of 02-01b) as a read_first dependency?
4. Is there any scope in the plans that violates CLAUDE.md security constraints ("No raw SQL except migrations or safely parameterized server-only RPCs", "No PII in logs", "GPS in PostGIS geometry/geography columns only")?

</instructions>

<prior_reviews>
No prior Codex reviews for Phase 2. This is Round 1.

GSD plan checker (revision 1): VERIFICATION PASSED — zero blockers, four warnings (all addressed before this review request):
- `availability_flags.reporter_id` table name corrected throughout
- 02-01 split into 02-01a (13 files, 4 tasks) and 02-01b (22 files, 3 tasks)
- All `gottago://` -> `gotta-go://` corrections applied
- VALIDATION.md Wave 0 test file names corrected
</prior_reviews>

<verification_focus>
This is a pre-execution plan review. No runnable code exists yet. Verification steps should focus on:
1. Reading plan files from disk and cross-referencing with CONTEXT.md locked decisions
2. Checking that acceptance_criteria commands would actually verify what they claim
3. Verifying the test assertions described in the plans would catch the security issues they're supposed to mitigate
4. Checking for internal consistency between the three plans (interfaces match, depends_on chain is correct)
</verification_focus>

<output_format>
## CODEX VERDICT: [APPROVE / REQUEST CHANGES / BLOCK]

### Checklist Results
[For each item in Step 2, state PASS / FAIL / NOT APPLICABLE with one line of evidence]

### Findings
[For each FAIL:]
**[SEVERITY: BLOCK | REQUEST CHANGES | NOTE]** `file:line` — [description]
[Specific fix required]

### Summary
[2-3 sentences on overall plan quality and readiness]

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
