---
phase: 04-gps-service-submission
reviewed: 2026-07-08T02:01:08Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - app/src/app/(components)/LocationDetailSheet.tsx
  - app/src/app/(components)/PendingStatusSheet.tsx
  - app/src/app/(components)/SensitivityConfirmModal.tsx
  - app/src/app/(components)/WithdrawConfirmModal.tsx
  - app/src/app/(tabs)/index.tsx
  - app/src/app/(tabs)/submit.tsx
  - app/src/app/__tests__/(components)/LocationDetailSheet.updateCode.test.tsx
  - app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx
  - app/src/app/__tests__/(tabs)/submit.test.tsx
  - app/src/features/submit/__tests__/submitLocation.test.ts
  - app/src/features/submit/__tests__/submitSchema.test.ts
  - app/src/features/submit/__tests__/updateAccessCode.test.ts
  - app/src/features/submit/__tests__/useGpsSample.test.ts
  - app/src/features/submit/__tests__/useMyPendingSubmissions.test.ts
  - app/src/features/submit/__tests__/withdrawSubmission.test.ts
  - app/src/features/submit/submitLocation.ts
  - app/src/features/submit/submitSchema.ts
  - app/src/features/submit/types.ts
  - app/src/features/submit/updateAccessCode.ts
  - app/src/features/submit/useGpsSample.ts
  - app/src/features/submit/useMyPendingSubmissions.ts
  - app/src/features/submit/withdrawSubmission.ts
  - app/src/lib/database.types.ts
  - supabase/migrations/20260707020000_phase4_submission_staging.sql
  - supabase/migrations/20260707030000_phase4_access_code_update.sql
  - supabase/tests/phase4_access_code.test.sql
  - supabase/tests/phase4_submit.test.sql
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-08T02:01:08Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the submission write-path (`submit_location` / `get_my_pending_submissions` / `withdraw_submission`), the access-code stage-then-confirm gate (`update_access_code` / `confirm_access_code` / `get_access_code`), their client wrappers, the SubmitFlow wizard, and the pending-pin map/sheet UI. The auth gates (`auth.uid() is null` checks) are present and correct on every new RPC, the generic `'gps rejected'` error is genuinely uniform across all three rejection branches (no info leak), and the pgTAP suites exercise the ownership/different-user boundaries well.

Two issues stood out on close reading. First, the SubmitFlow's "Hours" field (Step 2) is a bare `TextInput` with no `Controller`/`value`/`onChangeText` wiring at all — anything the user types there is silently discarded and never reaches `submit_location`, unlike the accessibility checkboxes a few lines below it, which are deliberately un-forwarded *with an explanatory comment*. Second, and more relevant to the requested abuse-resistance focus: `update_access_code` unconditionally overwrites `pending_access_code`/`pending_code_proposed_by` with no check for an existing pending proposal from a different user, so any authenticated caller can silently clobber someone else's in-flight code proposal before it is confirmed — undermining the migration's own stated goal that "a single malicious update cannot silently break a working door code for everyone."

## Critical Issues

### CR-01: SubmitFlow "Hours" field is not wired to form state — user input is silently discarded

**File:** `app/src/app/(tabs)/submit.tsx:409-415`
**Issue:** Every other Step-2/Step-1 field (`accessCode`, `timingTip`, `name`, `address`, `policyTag`, `accessSensitivity`) is wrapped in a react-hook-form `<Controller>` bound to `control`. The "Hours" input is a bare, uncontrolled `TextInput` with no `Controller`, no `value`, and no `onChangeText`:
```tsx
<Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Hours:</Text>
<TextInput
  accessibilityLabel="Hours"
  style={[...]}
  placeholder="e.g. Open 7am–10pm"
  placeholderTextColor={colors.textDisabled}
/>
```
Whatever the user types here never reaches `SubmitSchema`, so `buildInput()` (line 69-84) always evaluates `hours: values.hours ?? null` to `null` — `p_hours` is always sent as `null` regardless of what the user entered. Unlike the accessibility checkboxes (lines 100-103, explicitly commented as "captured... but NOT yet forwarded... tracked as a deferred item"), there is no comment here indicating this is an intentional deferral — it reads as an incomplete wire-up. The existing test at `app/src/app/__tests__/(tabs)/submit.test.tsx:148` only asserts the label exists, not that a typed value is retained or submitted, so this gap isn't caught by any test in the suite.
**Fix:** Either wrap the field in a `Controller` bound to a schema-appropriate representation (the current `submitSchema.hours` is `z.record(z.string(), z.string())`, which a single free-text input can't directly populate — this needs either a parsing step or a schema/UI redesign), or explicitly defer it with the same kind of comment used for the accessibility toggles so it's clear this is intentional and not lost work:
```tsx
<Controller
  control={control}
  name="hours"
  render={({ field: { onChange, value } }) => (
    <TextInput
      accessibilityLabel="Hours"
      ...
      value={/* derive a display string from the Record, or change schema to string */}
      onChangeText={onChange}
    />
  )}
/>
```

### CR-02: `update_access_code` has no guard against overwriting another user's pending proposal

**File:** `supabase/migrations/20260707030000_phase4_access_code_update.sql:59-74`
**Issue:** The migration's own header states the goal is that "a single malicious update cannot silently break a working door code for everyone" (lines 5-7). But `update_access_code` stages unconditionally, with no check on whether a *different* user's proposal is already pending:
```sql
-- Stage only. access_instructions + access_code_confirmed_at are left untouched.
update public.locations
   set pending_access_code      = p_code,
       pending_code_proposed_by = v_uid
 where id = p_location_id;
```
Any authenticated caller — including a second account controlled by the same attacker — can call this at any time to silently replace whatever code is currently staged (even a legitimate one from a different, unrelated user), with no ownership check and no rate limit. `confirm_access_code` only checks that the *confirmer* differs from whoever is *currently* recorded in `pending_code_proposed_by` (04-02 migration, Section 3) — it has no way to know or verify that the pending code hasn't been silently swapped out from under the original proposer. Combined, a single attacker with two accounts can: (1) call `update_access_code` with a malicious code (silently overwriting anyone else's pending proposal), then (2) confirm from the second account — fully promoting the attacker's code to `access_instructions`, with the confirming step giving no visibility into what code is actually being confirmed (`confirm_access_code` takes no code value to corroborate against, only `p_location_id`). This defeats the stated two-party abuse-resistance goal; the "single malicious update" the design tries to prevent is exactly what the overwrite allows.
**Fix:** Reject (or require an explicit override) when a *different* user's proposal is already pending, e.g.:
```sql
if exists (
  select 1 from public.locations
   where id = p_location_id
     and pending_access_code is not null
     and pending_code_proposed_by <> v_uid
) then
  raise exception 'code update already pending';
end if;
```
Consider also having `confirm_access_code` accept the code value being confirmed (or return it to the client for display before confirming) so a confirming user is attesting to a specific code rather than blindly promoting whatever is currently staged.

## Warnings

### WR-01: `getAccessCode()` / `get_access_code` return type is falsely non-nullable

**File:** `app/src/features/submit/updateAccessCode.ts:41-47`, `app/src/lib/database.types.ts:746`, `supabase/migrations/20260707030000_phase4_access_code_update.sql:145-171`
**Issue:** `get_access_code` does `select access_instructions into v_code ... return v_code;` with no existence check — if `p_location_id` doesn't resolve to a visible location, or the location has no code set, `v_code` stays `NULL` and the function returns `NULL` (Postgres allows this even though `Returns: text` isn't declared `not null`). The generated type still says `Returns: string`, and the wrapper compounds this:
```ts
export async function getAccessCode(locationId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_access_code', { p_location_id: locationId });
  if (error) throw error;
  return data as string;
}
```
A future caller trusting the `Promise<string>` signature (e.g. calling `.trim()` on the result) will crash on `null`. This is a different situation from the documented "Args optional, no `| null`" caveat in `submitLocation.ts` — this is the RPC's *Returns* type, not a SQL-defaulted Arg.
**Fix:** Have `get_access_code` raise the same `'location not available'` error `update_access_code`/`confirm_access_code` use when the location isn't visible, and change the wrapper's return type to `Promise<string | null>` (or throw when the value is legitimately absent) so callers can't silently propagate a `null` typed as `string`.

### WR-02: `submit_location` freshness check doesn't reject a future-dated `p_captured_at`

**File:** `supabase/migrations/20260707020000_phase4_submission_staging.sql:89-91`
**Issue:**
```sql
if p_captured_at is null or (now() - p_captured_at) > make_interval(secs => v_max_age_s) then
  raise exception 'gps rejected';                      -- freshness
end if;
```
This only bounds staleness in one direction. A `p_captured_at` set arbitrarily in the future makes `now() - p_captured_at` negative, which is always `< v_max_age_s`, so the freshness check can never reject it. A client (or a direct RPC caller bypassing the app) can pin an artificially "fresh" timestamp indefinitely.
**Fix:** Also reject when the timestamp is ahead of the server clock beyond a small allowance, e.g. `or p_captured_at > now() + interval '5 seconds'`.

### WR-03: `confirm_access_code`'s promoting UPDATE omits the visibility filters used by the initial SELECT

**File:** `supabase/migrations/20260707030000_phase4_access_code_update.sql:105-131`
**Issue:** The initial read is scoped to visible locations only:
```sql
select pending_access_code, pending_code_proposed_by
  into v_pending, v_proposed_by
  from public.locations
 where id = p_location_id
   and deleted_at is null
   and shadowban_status is not true
   and suppressed_at is null;
```
but the promoting UPDATE that follows has no such filter:
```sql
update public.locations
   set access_instructions      = v_pending, ...
 where id = p_location_id
   and pending_code_proposed_by <> auth.uid();
```
If a location is soft-deleted/shadowbanned/suppressed in the window between the SELECT and the UPDATE (or under concurrent access), the promotion can still land on a location that should no longer be treated as live. `update_access_code` (Section 2 of the same migration) re-applies the filter directly in its `UPDATE`'s preceding `not exists` check, so this is also an internal inconsistency between the two write RPCs.
**Fix:** Re-apply the same three predicates on the final `UPDATE`'s `WHERE` clause.

### WR-04: `withdraw_submission` silently no-ops instead of signaling failure

**File:** `supabase/migrations/20260707020000_phase4_submission_staging.sql:164-182`, `app/src/app/(components)/WithdrawConfirmModal.tsx:62-76`
**Issue:** The DELETE has no existence/ownership check before running and never raises when it deletes 0 rows:
```sql
delete from public.submissions
where id = p_submission_id
  and submitter_id = uid
  and status = 'pending';
```
This is intentionally idempotent for the legitimate "already withdrawn" case, but it also means a client-side bug (wrong id, stale id after expiry, etc.) is indistinguishable from a real success — `WithdrawConfirmModal.handleWithdraw()` treats any non-throwing resolution as success and calls `onWithdrawn()`, dismissing the sheet even if nothing was actually deleted.
**Fix:** Consider `if not found then raise exception 'submission not available'; end if;` (mirroring the pattern already used in `update_access_code`), or explicitly document the no-op-on-mismatch behavior as intentional in a comment so it isn't mistaken for an oversight later.

### WR-05: Door-code "Update door code" input has no length validation, unlike the initial-submission field

**File:** `app/src/app/(components)/LocationDetailSheet.tsx:205-223`
**Issue:** `submitSchema.accessCode` bounds the initial-submission door code to `max(100, 'Door code is too long.')`. The separate "Update door code" flow in `LocationDetailSheet` (`handleSubmitCode`) only trims and checks for non-empty:
```ts
const trimmed = codeInput.trim();
if (trimmed.length === 0) return;
```
No upper bound is applied before calling `updateAccessCode(locationId, trimmed)`, and the RPC/column (`pending_access_code text`) has no server-side length constraint either. This is a minor inconsistency rather than a security hole (the value is never interpolated into SQL — it's a bind parameter), but the two door-code entry paths now enforce different rules for conceptually the same field.
**Fix:** Reuse the same bound (100 chars) client-side for parity, and/or add a `check (char_length(pending_access_code) <= 100)` constraint on the column for defense in depth.

## Info

### IN-01: No server-side enum validation on `p_policy_tag` / `p_access_sensitivity`

**File:** `supabase/migrations/20260707020000_phase4_submission_staging.sql:48-107`
**Issue:** `submit_location` accepts `p_policy_tag text` and `p_access_sensitivity text` with no `CHECK`/enum validation against the four known policy tags or the `'sensitive' | null` contract documented in the migration's own comments (line 57). Enforcement is entirely client-side (`submitSchema`'s zod enum). A caller invoking the RPC directly (not through the app) could stage arbitrary values into `submissions.policy_tag`/`access_sensitivity`.
**Fix:** Add a `check (p_policy_tag in ('chill_spot','purchase_required','code_required','public_facility'))` (or a table-level CHECK on `submissions.policy_tag`) and similarly constrain `access_sensitivity` to `('sensitive')` or null.

### IN-02: `confirmAccessCode` / `getAccessCode` wrappers have no call site yet this phase

**File:** `app/src/features/submit/updateAccessCode.ts:29-47`
**Issue:** `confirmAccessCode` and `getAccessCode` are fully implemented and tested (`updateAccessCode.test.ts`) but nothing in the reviewed UI (`LocationDetailSheet.tsx`, `PendingStatusSheet.tsx`, `submit.tsx`, `index.tsx`) calls either of them — `LocationDetailSheet.tsx:145` explicitly comments that no `getAccessCode` call exists there by design. This is very likely deliberate (infra-ahead-of-UI, matching the file's own stated pattern for other actions), but is worth flagging so it's tracked as intentionally deferred rather than assumed to be wired up somewhere else.
**Fix:** None required if this is tracked in the phase SUMMARY as deferred to the confirmation-flow UI; otherwise wire up the confirm/read UI or note the gap explicitly.

---

_Reviewed: 2026-07-08T02:01:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
