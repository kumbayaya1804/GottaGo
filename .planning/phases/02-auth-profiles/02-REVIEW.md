---
phase: 02-auth-profiles
reviewed: 2026-07-02T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/src/app/(tabs)/profile.tsx
  - app/src/app/(components)/AuthRequiredModal.tsx
  - app/src/app/(components)/DeleteAccountModal.tsx
  - app/src/features/profile/getMyProfile.ts
  - app/src/app/_layout.tsx
  - app/jest.setup.ts
  - app/src/app/__tests__/(tabs)/profile.test.tsx
  - app/src/app/__tests__/(components)/AuthRequiredModal.test.tsx
  - app/src/app/__tests__/(components)/DeleteAccountModal.test.tsx
  - app/src/features/profile/__tests__/getMyProfile.test.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: fixed
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** fixed — all Critical/Warning/Info findings addressed (see Resolution below)

## Resolution (2026-07-02)

All 7 findings fixed via TDD (failing test first, then fix), all pre-existing + new tests green,
100% coverage maintained, 0 typecheck/lint errors:

- **CR-01** — added a `useEffect` keyed on `visible` in `DeleteAccountModal.tsx` that resets
  `confirmText`/`error`/`submitting` whenever the modal reopens.
- **WR-01** — added a `submittingRef` (not just state — two synchronous presses in the same
  render would both read the same stale `submitting` state value) as a true synchronous
  re-entrancy guard in `handleDelete`.
- **WR-02** / **IN-03** — `profile.tsx`'s display-name `<Text>` now falls back to `'Profile'` on
  `profileQuery.isError` or a null `displayName`, instead of rendering blank forever.
- **WR-03** — added `accessibilityLiveRegion="assertive"` to the delete-failure error `<Text>`.
- **IN-02** — `AuthRequiredModal.tsx`'s `isReduceMotionEnabled()` call now has `.catch(() => {})`
  and an unmount guard.
- **IN-01** — no code change (tracked as a follow-up; `AuthRequiredModal` has no caller until
  Phase 3 wires it into Submit/Verify/Rate/Report).

## Summary

Reviewed WU-02-T5 (Profile / DeleteAccountModal / AuthRequiredModal) plus the two out-of-plan
deviations (`getMyProfile.ts`, the `_layout.tsx` `QueryClientProvider` addition) and the
`jest.setup.ts` scheduler override.

The two flagged deviations both check out:

- `getMyProfile.ts` querying `public.users` directly is safe. `supabase/migrations/20260519010000_remote_schema.sql:41-43`
  defines `users_select_own` as `using (auth.uid() = id)` with **no** table-level `revoke select`
  anywhere in `supabase/migrations/` (unlike `ratings`, which is revoked from both `anon` and
  `authenticated` in `20260624000002_ratings_privacy_fix.sql:14`). The client-supplied `userId`
  passed into `.eq('id', userId)` is not a trust boundary — RLS enforces `auth.uid() = id`
  server-side regardless of what the client sends, exactly as the module's docstring claims.
- `_layout.tsx`'s new `QueryClientProvider` wraps `SessionProvider`/`GuardComponent` without
  altering the existing guard/redirect effects; it is purely additive and does not change
  `nextRoute`/`suppressGuardRedirect` behavior.
- `jest.setup.ts`'s `notifyManager` scheduler override is test-only infrastructure (this file is
  never bundled into the app) and does not affect production behavior.

However, one critical defect undermines the T-02-03 destructive-action gate this exact task was
supposed to harden, plus several warnings and info-level gaps around error handling and
accessibility completeness.

## Critical Issues

### CR-01: DeleteAccountModal does not reset its confirmation state when reopened, defeating the "type DELETE to confirm" friction gate

**File:** `app/src/app/(components)/DeleteAccountModal.tsx:25-44`
**Issue:**
`DeleteAccountModal` is always mounted inside `profile.tsx` — only its internal `<Modal visible={visible}>`
prop toggles (see `app/src/app/(tabs)/profile.tsx:178-181`, no `key` prop, no unmount/remount).
`confirmText`, `error`, and `submitting` are local component state (`DeleteAccountModal.tsx:28-30`)
and are **never reset** when `visible` transitions back to `true` — there is no `useEffect` keyed
on `visible`, and `onCancel` only flips the parent's `deleteModalVisible` boolean
(`profile.tsx:180`).

Consequence: if a user opens the modal, types `DELETE` (even accidentally, or to test the flow),
then taps Cancel, the next time they open "Delete Account" the input still contains `DELETE` and
the Destructive button is **already enabled** — a single tap now deletes the account with no
fresh confirmation. Likewise, if a previous attempt failed
(`deleteAccount()` rejected), the stale `"Couldn't delete your account..."` error text is shown
immediately on reopen, before any new attempt has been made, misleading the user about the
current state.

This directly defeats the explicit threat-model mitigation for T-02-03
("Type-`DELETE` (case-sensitive) gate disables the button until exact match" —
`.planning/phases/02-auth-profiles/02-02-PLAN.md:362`), which is meant to require a **fresh**
deliberate confirmation each time the modal is opened, not a one-time confirmation that persists
across cancel/reopen cycles. No test in `DeleteAccountModal.test.tsx` exercises the
close-then-reopen path, so this regression is untested.

**Fix:**
```tsx
import React, { useEffect, useState } from 'react';
// ...

export default function DeleteAccountModal({ visible, onCancel }: DeleteAccountModalProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  // Reset confirmation state every time the modal is (re)opened so a prior
  // "DELETE" entry or error never carries over to the next attempt.
  useEffect(() => {
    if (visible) {
      setConfirmText('');
      setError(false);
      setSubmitting(false);
    }
  }, [visible]);

  const canDelete = confirmText === CONFIRM_TOKEN;
  // ...
}
```

## Warnings

### WR-01: `handleDelete` has no synchronous re-entrancy guard against rapid double-tap

**File:** `app/src/app/(components)/DeleteAccountModal.tsx:34-44`
**Issue:** The Destructive button's `disabled` prop (`!canDelete || submitting`) only reflects
`submitting` after React re-renders. `handleDelete` itself does not check `if (submitting) return;`
synchronously on entry, so two `onPress` events firing before the re-render commits (e.g. a very
fast double-tap) can both call `deleteAccount()` concurrently.
**Fix:**
```tsx
async function handleDelete() {
  if (submitting) return;
  setSubmitting(true);
  setError(false);
  try {
    await deleteAccount();
  } catch {
    setError(true);
  } finally {
    setSubmitting(false);
  }
}
```

### WR-02: No error/fallback handling for a failed `getMyProfile` fetch

**File:** `app/src/app/(tabs)/profile.tsx:40-44, 108-110`
**Issue:** `profileQuery` (backed by `getMyProfile`) has no `isError` handling at all — unlike
`statsQuery`, which explicitly renders `"—"` on error (`renderStatValue`, `profile.tsx:84-97`).
If the `display_name` fetch fails (network error, RLS misconfiguration, etc.), the display-name
`<Text>` silently renders an empty string forever with no retry affordance and no visual
indication anything went wrong — violating the Component Acceptance Checklist's Error States
requirement that "no screen state is a dead end — every error has a recovery action."
**Fix:** Mirror the stats pattern — e.g. render a subtle fallback (`"Profile"` or the masked
email) when `profileQuery.isError`, or add a lightweight retry affordance.

### WR-03: Delete-failure error text lacks `accessibilityLiveRegion`

**File:** `app/src/app/(components)/DeleteAccountModal.tsx:71-75`
**Issue:** `.planning/phases/02-auth-profiles/02-UI-SPEC.md`'s "Accessibility Requirements (Phase 2)"
section states this rule applies to *all* Phase 2 screens: "Error containers:
`accessibilityLiveRegion=\"assertive\"` — screen reader announces errors without user navigation."
The inline `DELETE_FAILURE_COPY` text has no such prop, so a screen-reader user who triggers a
failed deletion will not be automatically notified of the error.
**Fix:**
```tsx
{error && (
  <Text
    accessibilityLiveRegion="assertive"
    style={[styles.errorText, { color: colors.errorRed }]}
  >
    {DELETE_FAILURE_COPY}
  </Text>
)}
```

## Info

### IN-01: `AuthRequiredModal` has no current call site in the codebase

**File:** `app/src/app/(components)/AuthRequiredModal.tsx`
**Issue:** A repo-wide search finds `AuthRequiredModal` imported only by its own test file — no
screen currently renders it. This is expected given `submit.tsx` is still a Phase 3 stub
(`"Submit (Phase 3)"`), but it means the component is presently dead code from the app's
perspective. Worth tracking (e.g. a follow-up task/issue) so the ERR-10 wiring into
Submit/Verify/Rate/Report isn't dropped.
**Fix:** No code change required now; file a follow-up issue to wire `AuthRequiredModal` into the
protected actions once they exist.

### IN-02: `isReduceMotionEnabled()` promise has no `.catch()` or unmount guard

**File:** `app/src/app/(components)/AuthRequiredModal.tsx:40-42`
**Issue:**
```tsx
useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
}, []);
```
If the promise rejects, this is an unhandled rejection; if the component unmounts before it
resolves, `setReduceMotion` still fires on an unmounted component. Low risk in practice (the
native API essentially never rejects, and React 19 no longer warns on this), but worth
hardening.
**Fix:**
```tsx
useEffect(() => {
  let mounted = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => { if (mounted) setReduceMotion(value); })
    .catch(() => {});
  return () => { mounted = false; };
}, []);
```

### IN-03: No fallback copy when `display_name` is `null`

**File:** `app/src/app/(tabs)/profile.tsx:108-110`
**Issue:** `profileQuery.data?.displayName ?? ''` renders a blank `<Text>` if `display_name` is
`null` (e.g. a user who signed up but whose `update_profile` call never completed). The UI-SPEC
doesn't define placeholder copy for this state, so it silently renders empty space instead of
something like the masked email or a generic label.
**Fix:** Consider falling back to the masked email or a generic label (e.g. `'Profile'`) when
`displayName` is null/empty, rather than an empty string.

---

_Reviewed: 2026-07-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
