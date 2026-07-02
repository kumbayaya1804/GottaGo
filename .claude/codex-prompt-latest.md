# Codex Review Request - Gotta Go

## Your Role
# Codex Role Guide

## Mission

Codex is the senior implementation-quality reviewer and escalation engineer for Gotta Go. The role is to protect production correctness, security, privacy, maintainability, and test discipline by reviewing actual code and evidence, not intent.

Claude remains the default implementation agent. Codex may implement when the human explicitly assigns a task, when a review finding requires a precise patch, or when a bounded fix is safer to apply directly than describe abstractly.

## Quick Start

For every Codex review:
1. Read `.claude/codex-prompt-latest.md`; if it is missing, stop and say the review scope is missing.
2. Inspect the queued files from disk; do not rely on the prompt as a substitute for evidence.
3. Do a call-path pass: inspect the nearest callers, callees, provider/layout effects, route guards, RPCs, policies, and lifecycle boundaries that can change the reviewed behavior.
4. Check whether tests or mocks hide the real runtime boundary, especially parent layouts, auth/session events, router behavior, Supabase constraints, RLS, GPS, and network failures.
5. Run practical verification when available: tests, typecheck, lint, build, or targeted inspection.
6. Put findings first, with exact `file:line` references and required fixes.
7. Do not approve uninspected code or unverifiable safety claims.
8. Escalate security, privacy, RLS, GPS integrity, shadowban, and silent-failure issues.

## Project Context

Gotta Go is a crowdsourced bathroom finder. The hard parts are location integrity, privacy, trust weighting, data quality, and abuse resistance.

Core system concerns:
- Supabase backend with PostgreSQL, PostGIS, Auth, and RLS
- Bathroom/location discovery using geospatial search
- GPS-verified contributions from physically present users
- Trust and reputation weighting for reports and verification events
- Confidence decay when locations are not recently verified
- 90-day respect signal materialized view
- Gamification through points, leaderboard, and verified contribution counts
- Shadowbanning for users and locations
- Privacy constraints around precise coordinates, identity, and behavior logs

## Harness Contract

Read `docs/agent-harness.md` before review or implementation work. It defines Claude as orchestrator/default implementer, Antigravity as architectural/data-integrity reviewer, Codex as implementation-quality/security reviewer, and the required review artifacts. Codex review output should be artifact-ready so Claude can save it to `.claude/codex-review-latest.md`.

Also read `docs/stale-info-scan.md` when reviewing workflow, planning, dependency, schema, prompt, launch, or documentation changes. If `.planning/stale-info-scan-latest.md` exists, treat it as evidence of known drift and verify whether the current change resolves, worsens, or ignores relevant findings.

## Review Priorities

Review in this order:
1. Security and privacy
2. Data integrity and database enforcement
3. Location/GPS correctness
4. Abuse resistance and shadowban behavior
5. Supabase/RLS correctness
6. User-visible correctness and failure states
7. Test coverage and verification quality
8. Maintainability, naming, and style

Do not let style comments crowd out defects that can lose data, leak identity, expose exact location, or let untrusted clients bypass server rules.

## Required Behavior During Review

Before returning any Codex review, Codex must read `.claude/codex-prompt-latest.md`. That file defines the current review scope, files to inspect, required context, and requested output format. If the prompt file is missing for a review request, Codex must say so instead of guessing the scope. Codex must then inspect the actual files from disk before judging; the prompt is review input, not a substitute for evidence.

Codex must:
- Read the relevant implementation, tests, migrations, and calling code before judging
- Trace cross-file state transitions for auth, routing, GPS, Supabase writes, RLS-sensitive reads, and async UI flows; do not stop at the edited file when a provider, guard, hook, or RPC decides the real behavior
- Compare test mocks against production wiring and call out when screen-level or unit tests bypass the boundary that can fail in the app
- Check for stale project instructions when the change touches docs, prompts, migrations, generated types, dependencies, launch assumptions, or review workflow
- Look for both direct bugs and missing enforcement at the correct layer
- Check that client code does not become the security boundary
- Verify claims with tests, typecheck, lint, build, browser checks, or targeted file inspection when practical
- Report exact file and line references for findings
- Clearly separate confirmed defects from risks and open questions
- Prefer small, precise fixes that match the existing stack
- Decline to approve when the evidence is insufficient for the claimed safety

Codex must not:
- Approve code based only on a task description
- Approve a UI or screen change solely because isolated component tests pass when parent layout, provider, auth-event, navigation, database, or RLS behavior is mocked away
- Treat client filtering as sufficient for trust, RLS, GPS, or shadowban rules
- Ignore missing error handling around writes or security-sensitive reads
- Recommend broad rewrites when a localized change solves the defect
- Block on subjective style alone

## Security And Privacy Guardrails

Block or request changes for:
- PII in client logs, analytics, crash reporting, debug panels, screenshots, or error messages
- Precise coordinates logged or exposed outside the minimum user-facing map behavior
- User IDs, emails, auth tokens, or session details exposed to client-visible logs
- Trust score, shadowban, admin, or moderation checks enforced only in frontend code
- Supabase service-role keys, admin credentials, or private environment variables exposed to the browser
- Missing RLS on user-owned, moderation, or location-contribution data
- Queries that allow shadowbanned users or locations to appear in public results

## Location Integrity Guardrails

Block or request changes for:
- Persisting latitude/longitude as ordinary app data when a PostGIS geometry/geography field should be the source of truth
- Mismatched SRIDs or missing SRID assignment in geospatial writes
- Distance queries that use degrees as meters or otherwise mix geometry/geography incorrectly
- GPS verification that trusts manually supplied client coordinates without server-side sanity checks
- Contributions accepted without radius, freshness, or accuracy rules where physical presence is required
- Location reads that fail to filter deleted, unavailable, expired, shadowbanned, or suppressed records

## Supabase And Data Integrity Guardrails

Codex should inspect:
- RLS policies for all user-owned or public-facing tables
- Whether RPC functions run with appropriate security mode and search path
- Whether writes validate foreign keys and ownership server-side
- Whether soft deletes are consistently filtered
- Whether materialized views have documented refresh strategy and permissions
- Whether all Supabase calls handle `{ data, error }` and failed writes are visible to the user or caller

Raw SQL is allowed in:
- Migrations
- SQL functions
- Database tests
- Server-only code that uses parameterized queries and never interpolates untrusted input

Raw SQL is not acceptable in:
- Browser/client code
- Ad hoc string interpolation with user input
- Places where Supabase query builder or RPC wrappers would preserve safety and consistency

## Testing Expectations

Tests should exist near the code they protect unless the project establishes a different convention.

Required test coverage for sensitive behavior:
- RLS and access-control behavior
- Shadowban filtering for users and locations
- Deleted/expired/unavailable filtering
- GPS verification radius, accuracy, and freshness rules
- Trust weighting and edge cases such as zero trust, null values, and stale records
- Supabase error paths for writes and important reads
- UI failure states when location permission, network, or database calls fail

Do not accept a test suite that only proves the happy path for security-sensitive behavior.

## Implementation Mode

When assigned to implement:
- Start by reading the existing conventions and nearby tests
- Keep the change scoped to the assigned feature or files
- Add failing tests first when practical and meaningful
- Implement the smallest durable fix
- Run the strongest practical verification
- Report files changed and commands run

When no codebase exists yet, Codex should create contracts and scaffolding that make future implementation reviewable.

## Review Output

After completing every review, write the full verdict to `.claude/codex-review-latest.md`. This is mandatory — do not skip it, even when the verdict is APPROVE. Claude and the review gate depend on this file being current.

Use this format:

```md
## Codex Review - [filename or change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, and required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Runtime Boundary Check
- Mandatory whenever the review packet includes a "Dependency Call Chains" or "Runtime Boundary And Mock Audit" section (i.e. any multi-file or cross-boundary change). State the call-path traced, which tests mock which boundaries, and whether any mock could hide production behavior. If the packet omitted this context, say so explicitly instead of skipping the section.

### Approved
- What is correct or ready to merge.
```

Verdict rules:
- BLOCK means the change must not merge because it creates or preserves a security issue, privacy leak, data-integrity risk, migration danger, or production-breaking defect.
- REQUEST CHANGES means the change is directionally acceptable but has logic errors, missing required tests, incomplete error handling, or significant maintainability risk.
- APPROVE means the inspected change is ready to merge with only non-blocking notes, if any.

## Codex App Review Mode

If using the Codex app `/review` workflow or inline review comments instead of the copied prompt flow, preserve the same review contract:
- Use the review pane and inline comments for precise file-specific findings when available.
- Keep the final response in the Review Output format above.
- Copy or summarize the final verdict and findings into `.claude/codex-review-latest.md`.
- Scope fixes to the reviewed files unless a security, privacy, data-integrity, or production-breaking issue requires following the call path.

## Agent Coordination Rules / Agent Harness (trimmed — unchanged since round 2)

Same roles, workflow, non-negotiables, and Minimum Commit Gate as round 2 (see `AGENTS_ROSTER.md`/`AGENTS.md`/`docs/agent-harness.md` if you want the full text — not repeated here since nothing about the process changed between rounds).

## Verdict Definitions / Verification Commands

[Full docs/review-severity.md and docs/verification.md — see below]

---

## Round 2 Verdicts (both reviewed the SAME code — guard-suppression fix, no retry fix yet)

### Antigravity Round 2 — APPROVE

```
## Antigravity Review - Phase 2 Auth & Profiles Wave 2 (Task 4 - Round 2)

**VERDICT: APPROVE**

The critical race condition identified in the previous round has been resolved via
suppressGuardRedirect. No blocking issues. Runtime Boundary Check assessed the
mock-boundary gap as acceptable and the event-ordering as safe.
```

**Note: this APPROVE did not catch the retry bug below** — Antigravity's round-2 pass didn't flag it. Not a contradiction with Codex; it's a miss worth being aware of when weighing the two verdicts.

### Codex Round 2 — REQUEST CHANGES (MAJOR)

```
## Codex Review - Phase 2 Plan 02-02 Task 4, Round 2

**VERDICT: REQUEST CHANGES**

### Findings
- MAJOR app/src/app/(auth)/sign-up.tsx:100 - The guard race is suppressed, but the
  post-signUp() failure path is still not recoverable. Once supabase.auth.signUp()
  succeeds, the user has an auth session and the profile row exists with
  display_name = null; if updateProfile(values.displayName) fails, the screen shows
  an error and stays mounted, but a second press still goes through the same
  signUp() call. For a taken-name race or transient RPC/network failure, the next
  attempt should retry profile provisioning for the already-created/signed-in
  account, not create the auth user again with the same email. Required fix: once
  account creation succeeds, track that state/session and route subsequent submits
  through updateProfile() only until profile provisioning succeeds, with tests
  covering retry after both DISPLAY_NAME_TAKEN_MESSAGE and generic updateProfile
  failure.
```

## Task Goal — Round 3

Fix Codex's MAJOR finding above. Added an `accountCreated` boolean state to `sign-up.tsx`. `onSubmit` now wraps Steps 1-2 (display-name pre-check + `signUp()`) in `if (!accountCreated)`, and sets `accountCreated = true` right after `signUp()` succeeds. Step 3 (`updateProfile`) runs unconditionally, whether this is the first submit or a retry. This means: first submit does the full flow; if `updateProfile` then fails, a second submit skips straight to `updateProfile()` with the (possibly edited) current display-name value — no re-check, no re-signUp.

This is a single-file change (`sign-up.tsx` + its test) — `SessionProvider.tsx`/`_layout.tsx`/`sign-in.tsx`/`callback.tsx` are unchanged since round 2 (already independently APPROVE-equivalent from both reviewers on those files; this round only asks you to re-confirm `sign-up.tsx` as a whole, since it changed again).

## Files In Scope (`.claude/review-queue.txt`, same 10 files — only these 2 changed this round)

- `app/src/app/(auth)/sign-up.tsx` — the fix
- `app/src/app/__tests__/(auth)/sign-up.test.tsx` — 2 new tests in a `describe('retry after account already created')` block

## Full File: app/src/app/(auth)/sign-up.tsx (onSubmit — the only changed function; rest of file identical to round 2)

```tsx
async function onSubmit(values: SignUpFormValues) {
  // If a prior submit already created the auth account but updateProfile then
  // failed (taken name, transient error), the account/session already exist —
  // re-running checkDisplayNameAvailable/signUp would hit an "already registered"
  // error instead of actually retrying. Skip straight to Step 3 (WU-02-T4 review
  // finding, round 2).
  if (!accountCreated) {
    // Step 1: Check display name availability
    try {
      const available = await checkDisplayNameAvailable(values.displayName);
      if (!available) {
        setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
        return;
      }
    } catch (e) {
      if (isDisplayNameTakenError(e)) {
        setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
      } else {
        setError('root', { message: GENERIC_ERROR_COPY });
      }
      return;
    }

    // Step 2: Create account. Suppress the root guard first — signUp() creates a
    // session as a side effect (email confirmation disabled), and the guard would
    // otherwise be free to redirect away from this screen before Step 3 completes.
    setAwaitingProfileProvisioning(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { display_name: values.displayName } },
    });

    if (error) {
      setError('root', { message: error.message || 'Something went wrong.' });
      return;
    }

    setAccountCreated(true);
  }

  // Step 3: persist display_name (handle_new_user trigger only sets id+email)
  try {
    await updateProfile(values.displayName);
  } catch (e) {
    if (e instanceof Error && e.message === DISPLAY_NAME_TAKEN_MESSAGE) {
      setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
    } else {
      setError('root', { message: GENERIC_ERROR_COPY });
    }
    return;
  }

  router.replace('/gps-consent' as never);
}
```

Also added: `const [accountCreated, setAccountCreated] = useState(false);` alongside the existing `passwordVisible`/`awaitingProfileProvisioning` state declarations. Nothing else in the file changed.

## New Tests (full content)

```tsx
describe('retry after account already created', () => {
  it('a second submit after an updateProfile failure retries updateProfile without calling signUp or checkDisplayNameAvailable again', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
    mockUpdateProfile.mockRejectedValueOnce(new Error('That display name is already taken.'));

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'TakenOnce');
    fireEvent.changeText(getByPlaceholderText('Email'), 'retry@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('That display name is already taken.')).toBeTruthy();
    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);

    mockUpdateProfile.mockResolvedValueOnce(undefined);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'AvailableNow');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenLastCalledWith('AvailableNow');
      expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
    });

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);
  });

  it('a second submit after a generic updateProfile failure also retries updateProfile only', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
    mockUpdateProfile.mockRejectedValueOnce(new Error('network down'));

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser3');
    fireEvent.changeText(getByPlaceholderText('Email'), 'new3@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('Something went wrong. Try again.')).toBeTruthy();

    mockUpdateProfile.mockResolvedValueOnce(undefined);
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
    });

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);
    expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
  });
});
```

## Runtime Boundary And Mock Audit

**Call path unchanged from round 2** except within `onSubmit` itself: `accountCreated` is plain component state, read/written synchronously inside the same function, no new provider/guard/RPC boundary introduced. `setAccountCreated(true)` happens strictly after `supabase.auth.signUp()` resolves without error, so it can't be set prematurely.

**Mock-boundary note:** the two new tests drive TWO sequential `fireEvent.press` calls against the SAME rendered instance (not a fresh mount), which is what actually exercises the retry path — `mockSignUp`/`mockCheckDisplayNameAvailable` call-count assertions (`toHaveBeenCalledTimes(1)`) after the second submit are the direct proof that Step 1/2 were skipped. This is real behavioral proof, not a mock hiding anything — the component state (`accountCreated`) driving the branch is the actual production mechanism, not a test double.

**One thing to explicitly ask both reviewers:** is `accountCreated` (component state, reset to `false` on remount) the right lifetime for this flag, or should it survive longer (e.g., derived from `session` existing) in case the user navigates away and back to `/sign-up` while still authenticated with an incomplete profile? Current behavior: if the screen unmounts (guard suppression also clears then) and the user somehow returns to sign-up while still holding a session with `display_name = null`, `accountCreated` would be `false` again and the flow would attempt `signUp()` a second time, likely hitting an "already registered" error with no special handling. Please assess whether this residual edge case is worth blocking on given how the guard/redirect logic makes it unlikely to occur in normal navigation (an authenticated user in the `(auth)` group gets redirected to `/(tabs)` by the guard once `suppressGuardRedirect` clears) — or whether it's acceptable given it requires a fairly contrived path to reach.

## Verification Evidence

- `cd app && npm run typecheck` — 0 errors.
- `cd app && npm run test:coverage` — 20 suites / 153 tests, 100% coverage on `src/features/**`.
- `cd app && npm run lint` — 0 errors, 27 pre-existing unrelated warnings.
- `git status --short` confirms only `sign-up.tsx` + its test changed since round 2 (plus the untracked process/doc changes noted in round 2's packet, unrelated to this review).

## Files To Review (all 10, full content — unchanged files included for completeness/re-confirmation)

# Review Severity Rules

Use this document to keep Claude, Antigravity, and Codex aligned on what blocks a merge.

## Verdicts

### BLOCK

The change must not merge until fixed.

Use BLOCK for:
- Security vulnerability
- Privacy leak
- Data integrity risk
- Migration or RLS issue that can expose, corrupt, or lose data
- Production-breaking defect in a core flow
- Abuse path that bypasses trust, GPS verification, moderation, or shadowban rules
- Test or verification evidence that is clearly false or insufficient for a sensitive change

### REQUEST CHANGES

The change is directionally acceptable but must be revised before merge.

Use REQUEST CHANGES for:
- Logic error with bounded impact
- Missing required test for changed behavior
- Supabase error handling omitted or incomplete
- Incomplete edge-case handling
- Query filtering done in the wrong layer but not yet exploitable
- Maintainability issue likely to cause defects soon
- Accessibility or responsive behavior issue in a user-facing flow

### APPROVE

The inspected change is ready to merge.

Use APPROVE only when:
- Relevant files were inspected
- Required behavior is covered by tests or credible verification
- No BLOCK or unresolved REQUEST CHANGES findings remain
- Remaining notes are minor and non-blocking

## Severity Levels

### CRITICAL

Use for issues that can:
- Leak PII, precise location, credentials, tokens, or moderation state
- Let unauthorized users read or write protected data
- Allow client-side bypass of RLS, shadowban, trust, or GPS verification
- Corrupt canonical location data
- Break public search, add, verify, or moderation flows in production

CRITICAL findings normally imply BLOCK.

### MAJOR

Use for issues that can:
- Produce incorrect trust/confidence results
- Drop or hide legitimate user data
- Fail important error paths
- Miss required tests for security-sensitive or data-integrity behavior
- Create unreliable geospatial search results
- Make a feature unusable for a significant class of users

MAJOR findings normally imply REQUEST CHANGES, or BLOCK if security/data exposure is involved.

### MINOR

Use for issues that:
- Reduce readability or maintainability without immediate risk
- Leave small UX rough edges
- Duplicate logic in a low-risk area
- Miss low-risk tests
- Use inconsistent naming that does not confuse security or data semantics

MINOR findings should not block unless they accumulate into meaningful risk.

## Non-Blocking Notes

Use non-blocking notes for:
- Style preferences
- Optional refactors
- Naming improvements with no correctness impact
- Future optimization opportunities
- Documentation polish

Do not disguise a required fix as a non-blocking note.

## Project-Specific Blocking Examples

BLOCK examples:
- A public search query returns `is_shadowbanned = true` locations.
- A client component decides whether a user is allowed to verify based only on local profile state.
- Coordinates are stored as plain `lat` and `lng` columns as the canonical location record.
- A Supabase service-role key appears in browser-accessible code.
- A migration creates user-owned tables without RLS.
- Verification events expose other users' bathroom visit history.
- Leaderboards include shadowbanned users.

REQUEST CHANGES examples:
- A Supabase write logs an error but does not surface failure to the caller.
- Tests cover the success path but not denied-location or failed-write behavior.
- Expired availability flags are filtered in UI but not in the query/RPC.
- A query omits `deleted_at` filtering but is not yet publicly exposed.
- Confidence decay math is implemented but not tested for stale and zero-event cases.

APPROVE examples:
- A change adds a tested UI loading/error state without touching security-sensitive logic.
- A migration adds a non-sensitive field with RLS unchanged and verified.
- A refactor preserves behavior and tests/typecheck pass.

# Verification Commands

Status: active. Update this file when the stack or host tooling changes.

## Goal

Every non-trivial change should have a clear verification signal before commit. Reviewers should report what they ran and what they could not run.

## Expected Command Categories

For the Expo/TypeScript app, expected commands include:

```bash
cd app && npm.cmd test -- --runInBand
cd app && npm.cmd run typecheck
cd app && npm.cmd run lint
cd app && npm.cmd run test:coverage -- --runInBand
```

On this Windows host, use `npm.cmd` rather than `npm` from PowerShell. The `.ps1` shims can be blocked by execution policy.

For focused Jest runs against Expo Router paths containing literal parentheses, use `--runTestsByPath` so Jest does not treat `(auth)` as a regular-expression group:

```bash
cd app && npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(auth)/sign-in.test.tsx"
```

## Supabase And Database Verification

When Supabase migrations or database logic exist, expected verification should include the project-standard equivalent of:

```bash
supabase db lint
supabase test db
supabase db reset
```

Use only commands that are actually configured for the repository. If local Supabase is not available, reviewers must say that database verification was not run.

## Browser And Frontend Verification

For user-facing UI changes, verify:
- Desktop and mobile responsive layout
- Loading states
- Error states
- Empty states
- Denied location permission
- Slow or failed network calls
- Keyboard accessibility for controls
- No PII or precise coordinates in visible logs/debug UI
- Parent layout, provider, route guard, and async event behavior when those boundaries can change the screen outcome
- Whether screen tests mock production boundaries such as router, auth session, Supabase RPCs, GPS, network, or RLS behavior

When a dev server exists, run it and inspect the affected route in a browser if practical.

## Security-Sensitive Verification

For changes involving GPS, trust, shadowban, RLS, or moderation, verification must include targeted tests or direct inspection of enforcement at the correct layer.

Minimum evidence to look for:
- Tests for allowed and denied access
- Tests for shadowbanned users/locations being excluded
- Tests for deleted/expired/suppressed records being excluded
- Tests for failed Supabase calls
- Tests for GPS radius, freshness, and accuracy rules
- No sensitive values in logs

For auth, routing, Supabase writes, GPS, trust/shadowban, RLS-sensitive reads, and async UI flows, reviewers should include a call-path and mock-boundary check in addition to test results. Passing isolated unit or screen tests is not sufficient when those tests replace the provider, route guard, database, policy, or external callback that decides production behavior.

## Review Reporting

Reviewers should include a verification section:

```md
### Verification
- `npm test` - passed
- `npm run typecheck` - passed
- Not run: Supabase database tests; no Supabase config exists yet.
```

If a command fails, report the failing command and the relevant failure. Do not hide failed verification behind an approval.
### === FILE: app/src/app/(auth)/sign-in.tsx ===
```tsx
﻿/**
 * Sign-In Screen
 *
 * Error display rule (T-02-01):
 *   ONE code path for ALL auth failures. Only distinction:
 *   (auth error with status) vs (network/fetch error without status).
 *
 * RED phase was confirmed by test output showing:
 *   Tests: 2 failed - renders Email/Password fields, renders Forgot password link
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { signInSchema } from '../../features/auth/validation';
import { signInWithGoogle } from '../../features/auth/oauth';
import { supabase } from '../../lib/supabase';

type SignInFormValues = {
  email: string;
  password: string;
};

const AUTH_ERROR_COPY = 'Invalid email or password.';
const NETWORK_ERROR_COPY = "Couldn't sign in. Check your connection and try again.";

export default function SignInScreen() {
  const router = useRouter();
  const { authError } = useLocalSearchParams<{ authError?: string }>();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [errorMessage, setErrorMessage] = useState<string | null>(
    authError ? NETWORK_ERROR_COPY : null
  );
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SignInFormValues) {
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setErrorMessage(AUTH_ERROR_COPY);
      }
    } catch {
      setErrorMessage(NETWORK_ERROR_COPY);
    }
  }

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const code = await signInWithGoogle();
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMessage(NETWORK_ERROR_COPY);
        }
      }
    } catch {
      setErrorMessage(NETWORK_ERROR_COPY);
    } finally {
      setGoogleLoading(false);
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
    },
    heading: {
      ...typography.h1,
      color: colors.textPrimary,
      marginBottom: spacing.xxl,
      textAlign: 'center',
    },
    input: {
      height: spacing.giant - spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.base,
      ...typography.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: spacing.md,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      marginBottom: spacing.md,
    },
    passwordInput: {
      flex: 1,
      height: spacing.giant - spacing.xs,
      paddingHorizontal: spacing.base,
      ...typography.body,
      color: colors.textPrimary,
    },
    eyeButton: {
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eyeButtonText: {
      ...typography.caption,
      color: colors.textLink,
    },
    submitButton: {
      height: spacing.giant - spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      ...typography.bodyMedium,
      color: colors.textInverse,
    },
    forgotLink: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    forgotLinkText: {
      ...typography.subhead,
      color: colors.textLink,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginHorizontal: spacing.sm,
    },
    createAccountLink: {
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    createAccountLinkText: {
      ...typography.subhead,
      color: colors.textLink,
    },
    errorContainer: {
      backgroundColor: colors.primarySurface,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    errorText: {
      ...typography.subhead,
      color: colors.errorRed,
    },
    secondaryButton: {
      height: spacing.giant - spacing.md,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    secondaryButtonText: {
      ...typography.bodyMedium,
      color: colors.primary,
    },
    appleStub: {
      height: spacing.giant - spacing.md,
      borderWidth: 1.5,
      borderColor: colors.textDisabled,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    appleStubText: {
      ...typography.bodyMedium,
      color: colors.textDisabled,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Welcome back</Text>

      {errorMessage !== null && (
        <View style={styles.errorContainer} accessibilityLiveRegion="assertive">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textDisabled}
            keyboardType="email-address"
            autoCapitalize="none"
            value={value}
            onChangeText={onChange}
          />
        )}
      />

      <View style={styles.passwordRow}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry={!passwordVisible}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={() => setPasswordVisible((v) => !v)}
          accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
        >
          <Text style={styles.eyeButtonText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Sign In"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>Sign In</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.forgotLink}
        onPress={() => router.push('/(auth)/forgot-password' as never)}
        accessibilityRole="link"
      >
        <Text style={styles.forgotLinkText}>Forgot password?</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {Platform.OS === 'android' ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityHint="Sign in with your Google account"
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          )}
        </Pressable>
      ) : (
        <View
          style={styles.appleStub}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple — coming soon"
          accessibilityState={{ disabled: true }}
        >
          <Text style={styles.appleStubText}>Sign in with Apple — coming soon</Text>
        </View>
      )}

      <Pressable
        style={styles.createAccountLink}
        onPress={() => router.push('/(auth)/sign-up')}
        accessibilityRole="link"
      >
        <Text style={styles.createAccountLinkText}>Create account</Text>
      </Pressable>
    </View>
  );
}

```

### === FILE: app/src/app/__tests__/(auth)/sign-in.test.tsx ===
```tsx
﻿/**
 * Thin render + behavior tests for app/src/app/(auth)/sign-in.tsx (Sign-In Screen).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => mockSearchParams),
}));

const mockSignInWithPassword = jest.fn();
const mockExchangeCodeForSession = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    },
  },
}));

const mockSignInWithGoogle = jest.fn();
jest.mock('../../../features/auth/oauth', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
  Platform.OS = 'android';
});

import SignInScreen from '../../(auth)/sign-in';

describe('SignInScreen', () => {
  it('renders Email and Password fields and Sign In button', () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('renders "Forgot password?" link', () => {
    const { getByText } = render(<SignInScreen />);
    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('wrong-password auth error shows "Invalid email or password."', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { status: 400, message: 'Invalid login credentials' },
    });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpassword');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid email or password.')).toBeTruthy();
    });
  });

  it('unregistered-email auth error shows "Invalid email or password."', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { status: 400, message: 'Email not confirmed' },
    });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'unknown@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'somepassword');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid email or password.')).toBeTruthy();
    });
  });

  it('generic server error shows "Invalid email or password."', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { status: 500, message: 'Internal server error' },
    });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(getByText('Invalid email or password.')).toBeTruthy();
    });
  });

  it("network error shows \"Couldn't sign in. Check your connection and try again.\"", async () => {
    mockSignInWithPassword.mockRejectedValue(new TypeError('Network request failed'));

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(
        getByText("Couldn't sign in. Check your connection and try again.")
      ).toBeTruthy();
    });
  });

  it('successful sign-in calls signInWithPassword with correct credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });

    const { getByPlaceholderText, getByText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'user@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });
  });

  describe('platform-gated OAuth row', () => {
    it('shows "Continue with Google" and no Apple stub on Android', () => {
      Platform.OS = 'android';

      const { getByText, queryByText } = render(<SignInScreen />);

      expect(getByText('Continue with Google')).toBeTruthy();
      expect(queryByText('Sign in with Apple — coming soon')).toBeNull();
    });

    it('shows the disabled Apple stub and no Google button on iOS', () => {
      Platform.OS = 'ios';

      const { getByText, queryByText } = render(<SignInScreen />);

      expect(getByText('Sign in with Apple — coming soon')).toBeTruthy();
      expect(queryByText('Continue with Google')).toBeNull();
    });

    it('the Apple stub reports accessibilityState disabled', () => {
      Platform.OS = 'ios';

      const { getByLabelText } = render(<SignInScreen />);
      const stub = getByLabelText('Sign in with Apple — coming soon');

      expect(stub.props.accessibilityState).toEqual({ disabled: true });
    });

    it('tapping "Continue with Google" calls signInWithGoogle', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue(null);

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
      });
    });

    it('exchanges the returned code for a session when signInWithGoogle resolves with a code', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue('abc123');
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123');
      });
    });

    it('does not attempt an exchange when signInWithGoogle resolves null (cancel/dismiss)', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue(null);

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalled();
      });
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('shows the network error copy when signInWithGoogle throws', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockRejectedValue(new Error('provider not enabled'));

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(
          getByText("Couldn't sign in. Check your connection and try again.")
        ).toBeTruthy();
      });
    });

    it('shows the network error copy when exchangeCodeForSession returns an error', async () => {
      Platform.OS = 'android';
      mockSignInWithGoogle.mockResolvedValue('abc123');
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: new Error('invalid grant'),
      });

      const { getByText } = render(<SignInScreen />);
      fireEvent.press(getByText('Continue with Google'));

      await waitFor(() => {
        expect(
          getByText("Couldn't sign in. Check your connection and try again.")
        ).toBeTruthy();
      });
    });
  });

  describe('authError search param', () => {
    it('shows the network error copy immediately when arriving with ?authError=1', () => {
      mockSearchParams = { authError: '1' };

      const { getByText } = render(<SignInScreen />);

      expect(
        getByText("Couldn't sign in. Check your connection and try again.")
      ).toBeTruthy();
    });
  });
});
```

### === FILE: app/src/app/(auth)/sign-up.tsx ===
```tsx
﻿/**
 * Sign-Up Screen
 *
 * Form with display name + email + password. Calls checkDisplayNameAvailable
 * before supabase.auth.signUp. On success, navigates to /gps-consent.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { signUpSchema } from '../../features/auth/validation';
import {
  checkDisplayNameAvailable,
  isDisplayNameTakenError,
} from '../../features/auth/displayName';
import { updateProfile, DISPLAY_NAME_TAKEN_MESSAGE } from '../../features/profile/updateProfile';
import { useSession } from '../../features/auth/useSession';
import { supabase } from '../../lib/supabase';
import { LEGAL_URLS } from '../../constants/legal';

type SignUpFormValues = {
  displayName: string;
  email: string;
  password: string;
};

const GENERIC_ERROR_COPY = 'Something went wrong. Try again.';

export default function SignUpScreen() {
  const router = useRouter();
  const sessionCtx = useSession();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [awaitingProfileProvisioning, setAwaitingProfileProvisioning] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  // Suppresses the root guard's auto-redirect while this screen is completing
  // post-signUp provisioning (updateProfile) — signUp() creates a session immediately
  // (email confirmation disabled), so without this the guard can race this screen's
  // own error handling / navigation and silently strand the user on /(tabs) with no
  // display_name and no visible error (WU-02-T4 review finding). Cleared on unmount
  // (i.e. once this screen is actually navigated away from), not on every branch
  // return, so a visible updateProfile error also keeps the guard suppressed until
  // the user leaves this screen.
  useEffect(() => {
    if (!awaitingProfileProvisioning) return;
    sessionCtx?.setSuppressGuardRedirect(true);
    return () => {
      sessionCtx?.setSuppressGuardRedirect(false);
    };
  }, [awaitingProfileProvisioning, sessionCtx]);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  async function onSubmit(values: SignUpFormValues) {
    // If a prior submit already created the auth account but updateProfile then
    // failed (taken name, transient error), the account/session already exist —
    // re-running checkDisplayNameAvailable/signUp would hit an "already registered"
    // error instead of actually retrying. Skip straight to Step 3 (WU-02-T4 review
    // finding, round 2).
    if (!accountCreated) {
      // Step 1: Check display name availability
      try {
        const available = await checkDisplayNameAvailable(values.displayName);
        if (!available) {
          setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
          return;
        }
      } catch (e) {
        if (isDisplayNameTakenError(e)) {
          setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
        } else {
          setError('root', { message: GENERIC_ERROR_COPY });
        }
        return;
      }

      // Step 2: Create account. Suppress the root guard first — signUp() creates a
      // session as a side effect (email confirmation disabled), and the guard would
      // otherwise be free to redirect away from this screen before Step 3 completes.
      setAwaitingProfileProvisioning(true);
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { display_name: values.displayName } },
      });

      if (error) {
        setError('root', { message: error.message || 'Something went wrong.' });
        return;
      }

      setAccountCreated(true);
    }

    // Step 3: persist display_name (handle_new_user trigger only sets id+email)
    try {
      await updateProfile(values.displayName);
    } catch (e) {
      if (e instanceof Error && e.message === DISPLAY_NAME_TAKEN_MESSAGE) {
        setError('displayName', { message: DISPLAY_NAME_TAKEN_MESSAGE });
      } else {
        setError('root', { message: GENERIC_ERROR_COPY });
      }
      return;
    }

    router.replace('/gps-consent' as never);
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
    },
    heading: {
      ...typography.h1,
      color: colors.textPrimary,
      marginBottom: spacing.xxl,
      textAlign: 'center',
    },
    input: {
      height: spacing.giant - spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.base,
      ...typography.body,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: spacing.xs,
    },
    fieldError: {
      ...typography.caption,
      color: colors.errorRed,
      marginBottom: spacing.sm,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      marginBottom: spacing.xs,
    },
    passwordInput: {
      flex: 1,
      height: spacing.giant - spacing.xs,
      paddingHorizontal: spacing.base,
      ...typography.body,
      color: colors.textPrimary,
    },
    eyeButton: {
      paddingHorizontal: spacing.base,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eyeButtonText: {
      ...typography.caption,
      color: colors.textLink,
    },
    submitButton: {
      height: spacing.giant - spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      marginTop: spacing.md,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      ...typography.bodyMedium,
      color: colors.textInverse,
    },
    rootErrorContainer: {
      backgroundColor: colors.primarySurface,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    rootErrorText: {
      ...typography.subhead,
      color: colors.errorRed,
    },
    tosContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    tosText: {
      ...typography.subhead,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    tosLink: {
      ...typography.subhead,
      color: colors.textLink,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Join Gotta Go</Text>

      {errors.root?.message && (
        <View style={styles.rootErrorContainer} accessibilityLiveRegion="assertive">
          <Text style={styles.rootErrorText}>{errors.root.message}</Text>
        </View>
      )}

      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="none"
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      {errors.displayName?.message && (
        <Text style={styles.fieldError}>{errors.displayName.message}</Text>
      )}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textDisabled}
            keyboardType="email-address"
            autoCapitalize="none"
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      {errors.email?.message && (
        <Text style={styles.fieldError}>{errors.email.message}</Text>
      )}

      <View style={styles.passwordRow}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry={!passwordVisible}
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={() => setPasswordVisible((v) => !v)}
          accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
        >
          <Text style={styles.eyeButtonText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
      {errors.password?.message && (
        <Text style={styles.fieldError}>{errors.password.message}</Text>
      )}

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Create Account"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.submitButtonText}>Create Account</Text>
        )}
      </Pressable>

      <View style={styles.tosContainer}>
        <Text style={styles.tosText}>By continuing, you agree to our </Text>
        <Text
          style={styles.tosLink}
          onPress={() => Linking.openURL(LEGAL_URLS.termsOfService)}
        >
          Terms of Service
        </Text>
        <Text style={styles.tosText}> and </Text>
        <Text
          style={styles.tosLink}
          onPress={() => Linking.openURL(LEGAL_URLS.privacyPolicy)}
        >
          Privacy Policy
        </Text>
        <Text style={styles.tosText}>.</Text>
      </View>
    </View>
  );
}

```

### === FILE: app/src/app/__tests__/(auth)/sign-up.test.tsx ===
```tsx
﻿/**
 * Thin render + behavior tests for app/src/app/(auth)/sign-up.tsx (Sign-Up Screen).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSegments: jest.fn(() => []),
}));

const mockCheckDisplayNameAvailable = jest.fn();
const mockIsDisplayNameTakenError = jest.fn();
jest.mock('../../../features/auth/displayName', () => ({
  checkDisplayNameAvailable: (...args: unknown[]) =>
    mockCheckDisplayNameAvailable(...args),
  isDisplayNameTakenError: (...args: unknown[]) =>
    mockIsDisplayNameTakenError(...args),
}));

const mockSignUp = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

const mockUpdateProfile = jest.fn();
jest.mock('../../../features/profile/updateProfile', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  DISPLAY_NAME_TAKEN_MESSAGE: 'That display name is already taken.',
}));

const mockSetSuppressGuardRedirect = jest.fn();
jest.mock('../../../features/auth/useSession', () => ({
  useSession: () => ({ setSuppressGuardRedirect: mockSetSuppressGuardRedirect }),
}));

const mockOpenURL = jest.fn();
jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDisplayNameTakenError.mockReturnValue(false);
  mockUpdateProfile.mockResolvedValue(undefined);
});

import SignUpScreen from '../../(auth)/sign-up';

describe('SignUpScreen', () => {
  it('renders Display Name, Email, and Password fields', () => {
    const { getByPlaceholderText } = render(<SignUpScreen />);
    expect(getByPlaceholderText('Display Name')).toBeTruthy();
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('checkDisplayNameAvailable returns false shows "That display name is already taken."', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(false);

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'TakenName');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('That display name is already taken.')).toBeTruthy();
  });

  it('successful signUp calls updateProfile then router.replace with /gps-consent', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

    const { getByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser');
    fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith('NewUser');
      expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
    });
  });

  it('updateProfile rejecting with the taken-name message shows the friendly error and does not navigate', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
    mockUpdateProfile.mockRejectedValue(new Error('That display name is already taken.'));

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'RaceConditionName');
    fireEvent.changeText(getByPlaceholderText('Email'), 'race@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('That display name is already taken.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('updateProfile rejecting with any other error shows the generic error and does not navigate', async () => {
    mockCheckDisplayNameAvailable.mockResolvedValue(true);
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
    mockUpdateProfile.mockRejectedValue(new Error('network down'));

    const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser2');
    fireEvent.changeText(getByPlaceholderText('Email'), 'new2@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Create Account'));

    expect(await findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('TOS text contains "Terms of Service" and "Privacy Policy"', () => {
    const { getByText } = render(<SignUpScreen />);
    expect(getByText('Terms of Service')).toBeTruthy();
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  describe('guard suppression during post-signup provisioning', () => {
    it('suppresses the root guard before signUp/updateProfile run', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

      const { getByPlaceholderText, getByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser');
      fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockSetSuppressGuardRedirect).toHaveBeenCalledWith(true);
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });
    });

    it('does not clear guard suppression when updateProfile fails, so the guard cannot race the error away', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
      mockUpdateProfile.mockRejectedValue(new Error('That display name is already taken.'));

      const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'RaceConditionName');
      fireEvent.changeText(getByPlaceholderText('Email'), 'race@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      expect(await findByText('That display name is already taken.')).toBeTruthy();
      expect(mockSetSuppressGuardRedirect).toHaveBeenCalledWith(true);
      expect(mockSetSuppressGuardRedirect).not.toHaveBeenCalledWith(false);
    });

    it('clears guard suppression when the screen unmounts', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });

      const { getByPlaceholderText, getByText, unmount } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser');
      fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });

      unmount();

      expect(mockSetSuppressGuardRedirect).toHaveBeenCalledWith(false);
    });
  });

  describe('retry after account already created', () => {
    it('a second submit after an updateProfile failure retries updateProfile without calling signUp or checkDisplayNameAvailable again', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
      mockUpdateProfile.mockRejectedValueOnce(new Error('That display name is already taken.'));

      const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'TakenOnce');
      fireEvent.changeText(getByPlaceholderText('Email'), 'retry@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      expect(await findByText('That display name is already taken.')).toBeTruthy();
      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);

      mockUpdateProfile.mockResolvedValueOnce(undefined);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'AvailableNow');
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenLastCalledWith('AvailableNow');
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });

      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);
    });

    it('a second submit after a generic updateProfile failure also retries updateProfile only', async () => {
      mockCheckDisplayNameAvailable.mockResolvedValue(true);
      mockSignUp.mockResolvedValue({ data: { user: {} }, error: null });
      mockUpdateProfile.mockRejectedValueOnce(new Error('network down'));

      const { getByPlaceholderText, getByText, findByText } = render(<SignUpScreen />);
      fireEvent.changeText(getByPlaceholderText('Display Name'), 'NewUser3');
      fireEvent.changeText(getByPlaceholderText('Email'), 'new3@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Create Account'));

      expect(await findByText('Something went wrong. Try again.')).toBeTruthy();

      mockUpdateProfile.mockResolvedValueOnce(undefined);
      fireEvent.press(getByText('Create Account'));

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/gps-consent');
      });

      expect(mockSignUp).toHaveBeenCalledTimes(1);
      expect(mockCheckDisplayNameAvailable).toHaveBeenCalledTimes(1);
      expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
    });
  });
});
```

### === FILE: app/src/app/auth/callback.tsx ===
```tsx
/**
 * Auth Callback Screen
 *
 * Deep-link target for gotta-go://auth/callback (OAuth escapes + password recovery).
 * Reads the incoming URL, exchanges the PKCE code for a session via handleAuthCallback.
 *
 * This route sits outside the (auth) group, so the root layout's session guard
 * (redirect.ts nextRoute) does not fire for it — navigation on success/failure is
 * explicit here, matching the convention already used by reset-password.tsx and
 * sign-up.tsx for routes outside (auth)/(tabs).
 */

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Colors } from '../../../constants/Colors';
import { handleAuthCallback } from '../../features/auth/oauth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const handled = useRef(false);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true;

    handleAuthCallback(url)
      .then(() => {
        router.replace('/(tabs)');
      })
      .catch(() => {
        router.replace({ pathname: '/(auth)/sign-in', params: { authError: '1' } });
      });
  }, [url, router]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <ActivityIndicator testID="auth-callback-loading" color={colors.primary} />
    </View>
  );
}
```

### === FILE: app/src/app/__tests__/auth/callback.test.tsx ===
```tsx
/**
 * Thin render + behavior tests for app/src/app/auth/callback.tsx (deep-link OAuth +
 * password-recovery target route).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ replace: mockReplace })),
  useSegments: jest.fn(() => []),
}));

const mockUseURL = jest.fn();
jest.mock('expo-linking', () => ({
  useURL: () => mockUseURL(),
}));

const mockHandleAuthCallback = jest.fn();
jest.mock('../../../features/auth/oauth', () => ({
  handleAuthCallback: (...args: unknown[]) => mockHandleAuthCallback(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

import AuthCallbackScreen from '../../auth/callback';

describe('AuthCallbackScreen', () => {
  it('renders a loading indicator', () => {
    mockUseURL.mockReturnValue(null);

    const { getByTestId } = render(<AuthCallbackScreen />);

    expect(getByTestId('auth-callback-loading')).toBeTruthy();
  });

  it('does not call handleAuthCallback when there is no incoming URL yet', () => {
    mockUseURL.mockReturnValue(null);

    render(<AuthCallbackScreen />);

    expect(mockHandleAuthCallback).not.toHaveBeenCalled();
  });

  it('calls handleAuthCallback with the incoming URL and replaces to /(tabs) on success', async () => {
    mockUseURL.mockReturnValue('gotta-go://auth/callback?code=abc123');
    mockHandleAuthCallback.mockResolvedValue({ access_token: 'x' });

    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockHandleAuthCallback).toHaveBeenCalledWith(
        'gotta-go://auth/callback?code=abc123'
      );
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('replaces to sign-in with an authError param when handleAuthCallback fails', async () => {
    mockUseURL.mockReturnValue('gotta-go://auth/callback?code=bad');
    mockHandleAuthCallback.mockRejectedValue(new Error('invalid grant'));

    render(<AuthCallbackScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(auth)/sign-in',
        params: { authError: '1' },
      });
    });
  });
});
```

### === FILE: app/src/features/auth/SessionProvider.tsx ===
```tsx
﻿import React, { createContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

/**
 * Shape of the session context value.
 * session: the active Supabase auth session, or null if unauthenticated
 * loading: true until the first auth event fires (blank-splash gate — decision #5)
 * signOut: calls supabase.auth.signOut()
 * suppressGuardRedirect: when true, the root layout guard's auto-redirect effect
 *   (redirect.ts nextRoute) is skipped. Set by screens that create a session as a
 *   side effect of an in-flight multi-step flow (e.g. sign-up: signUp() creates a
 *   session immediately since email confirmation is disabled, but the screen still
 *   has to call updateProfile() and show/handle its error before it's safe to let
 *   the guard route the user elsewhere) — WU-02-T4 review finding.
 */
export interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  suppressGuardRedirect: boolean;
  setSuppressGuardRedirect: (value: boolean) => void;
}

/**
 * React context for auth session. Exported so useSession.ts can consume it
 * and tests can provide a custom value via Context.Provider.
 */
export const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
}

/**
 * SessionProvider wraps the root layout and provides the auth session to all
 * descendants via SessionContext.
 *
 * On mount:
 *   - Calls getSession() to hydrate from AsyncStorage-persisted session
 *   - Subscribes to onAuthStateChange for all subsequent auth events
 *
 * On unmount:
 *   - Unsubscribes to prevent memory leaks
 *
 * Events handled (RESEARCH §Pattern 1):
 *   INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
 *   PASSWORD_RECOVERY, USER_UPDATED
 *
 * Does NOT fetch the public.users profile row — that is done lazily via
 * TanStack Query per CONTEXT §1 decision #3.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [suppressGuardRedirect, setSuppressGuardRedirect] = useState(false);

  useEffect(() => {
    // Hydrate session from AsyncStorage on cold start
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to all auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SessionContext.Provider
      value={{ session, loading, signOut, suppressGuardRedirect, setSuppressGuardRedirect }}
    >
      {children}
    </SessionContext.Provider>
  );
}
```

### === FILE: app/src/features/auth/__tests__/SessionProvider.test.tsx ===
```tsx
﻿import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

// jest.mock is hoisted. We define the mock fns inside the factory using jest.fn()
// then retrieve them via jest.requireMock() after the import section.
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

import { SessionProvider, SessionContext } from '../SessionProvider';

// Retrieve mock handles after the jest.mock factory has run
const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  auth: {
    getSession: jest.Mock;
    onAuthStateChange: jest.Mock;
    signOut: jest.Mock;
  };
};

const mockUnsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  mockSupabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
  mockSupabase.auth.signOut.mockResolvedValue({});
});

// Helper consumer component that reads the context
function TestConsumer() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) return <Text testID="no-ctx">no context</Text>;
  return (
    <>
      <Text testID="loading">{String(ctx.loading)}</Text>
      <Text testID="session">{ctx.session ? 'has-session' : 'no-session'}</Text>
    </>
  );
}

describe('SessionProvider', () => {
  it('starts with loading=true before getSession resolves', async () => {
    let resolveGetSession!: (val: { data: { session: null } }) => void;
    mockSupabase.auth.getSession.mockReturnValue(
      new Promise<{ data: { session: null } }>((resolve) => {
        resolveGetSession = resolve;
      })
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    expect(getByTestId('loading').props.children).toBe('true');

    // Resolve to avoid async leaks
    await act(async () => {
      resolveGetSession({ data: { session: null } });
    });
  });

  it('sets loading=false after getSession resolves with no session', async () => {
    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('loading').props.children).toBe('false');
    });
    expect(getByTestId('session').props.children).toBe('no-session');
  });

  it('subscribes to onAuthStateChange on mount', async () => {
    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });
  });

  it('updates session on SIGNED_IN event', async () => {
    const fakeSession = { user: { id: 'abc', email: 'user@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('SIGNED_IN', fakeSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');
    expect(getByTestId('loading').props.children).toBe('false');
  });

  it('clears session on SIGNED_OUT event', async () => {
    const fakeSession = { user: { id: 'abc', email: 'user@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('SIGNED_IN', fakeSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');

    await act(async () => {
      authChangeCallback('SIGNED_OUT', null);
    });

    expect(getByTestId('session').props.children).toBe('no-session');
  });

  it('handles PASSWORD_RECOVERY event without crashing', async () => {
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('PASSWORD_RECOVERY', null);
    });

    expect(getByTestId('loading').props.children).toBe('false');
  });

  it('handles TOKEN_REFRESHED event and updates session', async () => {
    const refreshedSession = { user: { id: 'abc', email: 'user@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('TOKEN_REFRESHED', refreshedSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');
  });

  it('handles USER_UPDATED event and updates session', async () => {
    const updatedSession = { user: { id: 'abc', email: 'new@example.com' } };
    let authChangeCallback!: (event: string, session: unknown) => void;

    mockSupabase.auth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    const { getByTestId } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      authChangeCallback('USER_UPDATED', updatedSession);
    });

    expect(getByTestId('session').props.children).toBe('has-session');
  });

  it('unsubscribes from auth state changes on unmount', async () => {
    const { unmount } = render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('exposes suppressGuardRedirect=false by default', async () => {
    function SuppressConsumer() {
      const ctx = React.useContext(SessionContext);
      return <Text testID="suppress">{String(ctx?.suppressGuardRedirect)}</Text>;
    }

    const { getByTestId } = render(
      <SessionProvider>
        <SuppressConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('suppress').props.children).toBe('false');
    });
  });

  it('setSuppressGuardRedirect updates the context value', async () => {
    function SuppressToggleConsumer() {
      const ctx = React.useContext(SessionContext);
      return (
        <Text
          testID="suppress"
          onPress={() => ctx?.setSuppressGuardRedirect(true)}
        >
          {String(ctx?.suppressGuardRedirect)}
        </Text>
      );
    }

    const { getByTestId } = render(
      <SessionProvider>
        <SuppressToggleConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(getByTestId('suppress').props.children).toBe('false');
    });

    await act(async () => {
      getByTestId('suppress').props.onPress();
    });

    expect(getByTestId('suppress').props.children).toBe('true');
  });

  it('calls supabase.auth.signOut when signOut is invoked', async () => {
    function SignOutConsumer() {
      const ctx = React.useContext(SessionContext);
      return (
        <Text
          testID="sign-out-btn"
          onPress={() => ctx?.signOut()}
        >
          sign out
        </Text>
      );
    }

    const { getByTestId } = render(
      <SessionProvider>
        <SignOutConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    await act(async () => {
      getByTestId('sign-out-btn').props.onPress();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
```

### === FILE: app/src/app/_layout.tsx ===
```tsx
﻿import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SessionProvider } from '../features/auth/SessionProvider';
import { useSession } from '../features/auth/useSession';
import { nextRoute } from '../features/auth/redirect';
import { supabase } from '../lib/supabase';

/**
 * Guard component - reads session state and performs route-level redirects.
 *
 * Two effects:
 *   1. Session guard: calls nextRoute() whenever loading/session/segments change.
 *      If loading, does nothing. Otherwise redirects as needed.
 *   2. PASSWORD_RECOVERY: separate supabase.auth.onAuthStateChange subscription
 *      that watches for the PASSWORD_RECOVERY event and navigates to /reset-password.
 *      Unsubscribes on unmount.
 *
 * When loading is true, renders null (blank splash) per CONTEXT section 1.
 */
function GuardComponent() {
  const sessionValue = useSession();
  const session = sessionValue?.session ?? null;
  const loading = sessionValue?.loading ?? true;
  const suppressGuardRedirect = sessionValue?.suppressGuardRedirect ?? false;
  const router = useRouter();
  const segments = useSegments();

  // Effect 1: redirect guard based on session state
  //
  // Skips when suppressGuardRedirect is set — screens that create a session as a
  // side effect of an in-flight multi-step flow (e.g. sign-up's updateProfile call
  // after signUp()) raise this flag so this effect doesn't race their own explicit
  // navigation/error handling (WU-02-T4 review finding).
  useEffect(() => {
    if (loading || suppressGuardRedirect) return;
    const route = nextRoute(segments as string[], !!session);
    if (route !== null) {
      // as never required: expo-router replace type is strict about known routes
      router.replace(route as never);
    }
  }, [loading, suppressGuardRedirect, session, segments, router]);

  // Effect 2: PASSWORD_RECOVERY deep-link handler (separate subscription)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password' as never);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return null;
  }

  return <Stack />;
}

/**
 * RootLayout - entry point for Expo Router.
 *
 * Wraps the entire navigation tree in:
 *   1. GestureHandlerRootView - required by react-native-gesture-handler
 *   2. SessionProvider - provides auth session context to all descendants
 *   3. GuardComponent - handles route protection and PASSWORD_RECOVERY redirects
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <GuardComponent />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
```

### === FILE: app/src/app/__tests__/_layout.test.tsx ===
```tsx
﻿/**
 * Thin render tests for app/src/app/_layout.tsx (Root Layout).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';

// Mock SessionProvider so we control the context value
jest.mock('../../features/auth/SessionProvider', () => {
  const React = require('react');
  const mockContext = React.createContext(null);
  return {
    SessionProvider: ({ children }: { children: React.ReactNode }) => {
      const value = (global as Record<string, unknown>).__sessionContextValue ?? {
        session: null,
        loading: false,
        signOut: jest.fn(),
      };
      return React.createElement(mockContext.Provider, { value }, children);
    },
    SessionContext: mockContext,
  };
});

jest.mock('../../features/auth/useSession', () => ({
  useSession: () =>
    (global as Record<string, unknown>).__sessionContextValue ?? {
      session: null,
      loading: false,
      signOut: jest.fn(),
    },
}));

const mockNextRoute = jest.fn(() => null as string | null);
jest.mock('../../features/auth/redirect', () => ({
  nextRoute: (...args: unknown[]) => mockNextRoute(...args),
}));

const mockOnAuthStateChange = jest.fn();
const mockUnsubscribe = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
  };
});

jest.mock('expo-router', () => ({
  Stack: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'stack' });
  },
  useSegments: jest.fn(() => []),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

import RootLayout from '../_layout';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = global as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockNextRoute.mockReturnValue(null);
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
  delete g.__sessionContextValue;
});

describe('RootLayout', () => {
  it('renders null (blank splash) when loading is true', () => {
    g.__sessionContextValue = { session: null, loading: true, signOut: jest.fn() };

    const { queryByTestId } = render(<RootLayout />);

    // When loading, the Guard renders null — the Stack must not be present
    expect(queryByTestId('stack')).toBeNull();
  });

  it('does NOT call router.replace when loading is true', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    g.__sessionContextValue = { session: null, loading: true, signOut: jest.fn() };

    render(<RootLayout />);

    await act(async () => {});

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('calls router.replace with the route returned by nextRoute when not loading', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    mockNextRoute.mockReturnValue('/(auth)/sign-in');
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
    });
  });

  it('does NOT call router.replace when suppressGuardRedirect is true, even if nextRoute would redirect', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    mockNextRoute.mockReturnValue('/(tabs)');
    g.__sessionContextValue = {
      session: { user: { id: 'u1' } },
      loading: false,
      signOut: jest.fn(),
      suppressGuardRedirect: true,
    };

    render(<RootLayout />);

    await act(async () => {});

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does NOT call router.replace when nextRoute returns null', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    mockNextRoute.mockReturnValue(null);
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await act(async () => {});

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('calls router.replace with /reset-password on PASSWORD_RECOVERY event', async () => {
    const { useRouter } = require('expo-router');
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    mockOnAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }
    );

    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    render(<RootLayout />);

    await waitFor(() => {
      expect(capturedCallback).not.toBeNull();
    });

    await act(async () => {
      capturedCallback!('PASSWORD_RECOVERY', null);
    });

    expect(mockReplace).toHaveBeenCalledWith('/reset-password');
  });

  it('unsubscribes from supabase.auth.onAuthStateChange on unmount', async () => {
    g.__sessionContextValue = { session: null, loading: false, signOut: jest.fn() };

    const { unmount } = render(<RootLayout />);

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
```


---

## Your Task

This is round 3, scoped narrowly to the retry-path fix above. Antigravity: please also explicitly note whether you'd have caught this on round 2 with the current runtime-boundary/mock-audit framing, or whether it's a genuinely new class of check worth adding to your standing review focus. Codex: please confirm the fix matches what you asked for and address the residual edge-case question above.

Return your verdict in the standard format. Save to the appropriate `-review-latest.md` file — this overwrites round 2's saved verdict; that is intentional.
