# Antigravity Review Request — Phase 2 Plans (Auth & Profiles)

## Context

Project: Gotta Go — crowdsourced bathroom finder (React Native / Expo SDK 55 / Supabase + PostGIS / Mapbox)
Review scope: Phase 2 PLAN files — pre-execution plan review. No application code has been written yet.
Model: You are Antigravity, senior architect and lead auditor.
Round: 1 (first review of Phase 2 plans)

This review gate precedes execution. If you APPROVE, the executor proceeds with 02-01a → 02-01b → 02-02.
If you BLOCK or REQUEST CHANGES, list exact findings and the executor will fix before re-requesting review.

---

## Files in Scope

Read each file from disk before reviewing. Do not rely solely on this prompt.

```
.planning/phases/02-auth-profiles/02-01a-PLAN.md   (Wave 0 infrastructure: packages, babel, migrations)
.planning/phases/02-auth-profiles/02-01b-PLAN.md   (Auth modules + screens, depends_on: 02-01a)
.planning/phases/02-auth-profiles/02-02-PLAN.md    (OAuth, RPCs, Profile/Settings, depends_on: 02-01b)
.planning/phases/02-auth-profiles/02-CONTEXT.md    (locked user decisions)
.planning/phases/02-auth-profiles/02-RESEARCH.md   (domain research + open questions, all resolved)
.planning/phases/02-auth-profiles/02-PATTERNS.md   (codebase pattern mapping)
.planning/phases/02-auth-profiles/02-VALIDATION.md (Nyquist validation strategy)
.planning/ROADMAP.md                               (phase 2 entry, success criteria)
```

Also read for project baseline:
```
docs/schema-contract.md
docs/review-severity.md
SPEC.md (relevant sections: auth, GPS consent, account deletion, privacy)
supabase/migrations/20260519010000_remote_schema.sql (live schema reference)
```

---

## Phase 2 Summary

Phase 2 delivers email/password auth, Google OAuth (Android-only), protected routes, GPS consent, and account deletion. Three plans execute in sequence:

- **02-01a**: react-native-gesture-handler install, babel config, Supabase config alignment (password length, Google provider), jest harness mocks, design token files, and three Wave 0 DB migrations (handle_new_user trigger capture, case-insensitive display_name unique index, check_display_name_available + set_gps_consent RPCs). Ends with `supabase db push`.
- **02-01b**: Six covered auth-logic modules in `src/features/auth/` (validation, redirect, SessionProvider, useSession, displayName, gpsConsent), root layout with SessionProvider + protected-route guard, Welcome screen, navigation shell, and five auth screens (Sign-In/Sign-Up/Forgot-Password/Reset-Password/GPS-Consent).
- **02-02**: Nullable-FK migration (7 FK columns → ON DELETE SET NULL) + update_profile + delete_account SECURITY DEFINER RPCs, Google OAuth (Android Platform.OS gate), Apple stub (iOS), deep-link callback route, Profile + Settings stub, Delete/Auth-Required modals.

---

## Priority 1: Data Integrity & Schema Safety

Verify the following before anything else.

### 1.1 Wave 0 Migrations (02-01a Task 4)

The three migrations must be architecturally sound before execution.

**Migration 1 — handle_new_user trigger:**
- The trigger inserts `(id, email)` into `public.users` — does NOT set `display_name`. This is locked (CONTEXT §10).
- The `AFTER INSERT ON auth.users` trigger must use `SECURITY DEFINER` so it can write to `public.users` across schema boundaries.
- Verify the plan correctly uses `create or replace function` + `drop trigger if exists` for idempotency — a duplicate trigger would fire twice on every signup.
- The live trigger exists (confirmed via Supabase MCP in research) — the migration must reproduce it exactly without breaking existing signups.

**Migration 2 — display_name unique index:**
- `create unique index if not exists users_display_name_lower_uniq on public.users (lower(display_name))` — case-insensitive.
- NULLs must be distinct (Postgres default: NULLs do NOT violate unique indexes). Verify this doesn't block the initial `handle_new_user` insert where `display_name` IS NULL.
- `ratings.unique(user_id, location_id)` is a separate constraint — verify the plan doesn't accidentally affect it.

**Migration 3 — auth RPCs:**
- `check_display_name_available`: callable by `anon` (pre-signup) AND `authenticated`. Verify the plan grants to both roles.
- `set_gps_consent`: callable by `authenticated` only (never `anon`). Verify the plan does NOT grant to `anon`.
- Both must use `security definer set search_path = public` to prevent search_path hijack (Supabase SECURITY DEFINER requirement).

### 1.2 Nullable-FK Migration (02-02 Task 1)

This is the blocking migration for account deletion. Verify:

**All 7 FK columns must be named correctly:**
- `submissions.submitter_id`
- `ratings.user_id`
- `trust_events.user_id`
- `verification_events.user_id`
- `reports.user_id`
- `failure_events.user_id`
- `availability_flags.reporter_id`  ← verify the plan uses `availability_flags`, NOT `flags`

**The migration must:**
1. `alter table ... alter column ... drop not null` for each column
2. Drop and re-add the FK constraint with `on delete set null`
3. Not use `on delete cascade` (which would delete child rows, destroying community data)

**Verify in the live schema** (`supabase/migrations/20260519010000_remote_schema.sql`):
- Is `availability_flags.reporter_id` actually `NOT NULL` today? If it's already nullable, the `drop not null` is a no-op (safe). If it has a unique constraint that includes the FK column, dropping and re-adding the FK must preserve or handle it.

### 1.3 delete_account RPC (02-02 Task 1)

The RPC body in the plan anonymizes 7 tables then calls `delete from auth.users where id = uid`. Verify:

- The `ON DELETE CASCADE` on `public.users.id` (references `auth.users(id)`) means deleting from `auth.users` will cascade to `public.users`. The plan's SET NULL step must run BEFORE the auth delete or the cascade will delete the row before anonymization completes.
- The RPC runs `update submissions set submitter_id = null ... update availability_flags set reporter_id = null ... delete from auth.users` — verify the ordering is correct (all SET NULLs before the auth delete).
- `search_path = public, auth` must be set for the RPC to access `auth.users`. Verify the plan includes `set search_path = public, auth`.
- The RPC uses `auth.uid()` as the caller identity — verify there is no way for one user to delete another user's account via this RPC.

### 1.4 GPS Consent Write Path (02-01b Task 5 + 02-01a Task 4)

- `set_gps_consent()` must write `gps_consent = true` AND `gps_consent_at = now()` to `public.users` WHERE `id = auth.uid()`.
- Verify the plan's `gpsConsent.ts` module calls the RPC on `granted` only. The plan must explicitly assert in tests that no RPC call fires on `denied` or `skip`.
- `gps_consent_at` must ONLY be written on OS dialog → `granted`. Never on skip or denial.

---

## Priority 2: Auth Architecture & Session Management

### 2.1 SessionProvider (02-01b Task 5)

- The plan calls `supabase.auth.getSession()` at mount, then subscribes to `onAuthStateChange`. This is the correct Supabase pattern.
- Verify the plan handles the `INITIAL_SESSION` event (fires on cold start with an existing session) correctly — not treating it as a new sign-in event that would re-navigate.
- Verify the plan unsubscribes on unmount (memory leak risk if not).
- The `public.users` profile row must NOT be fetched inside SessionProvider (CONTEXT §1/#3). The plan should use TanStack Query lazy fetch elsewhere.

### 2.2 Protected Route Guard (02-01b Task 5/6)

- The plan uses `nextRoute(segments, hasSession)` + `router.replace`. This is the correct Expo Router v4 pattern.
- Verify the Map tab (`(tabs)/index`) is public — no redirect for unauthenticated users.
- Verify the guard is gated on `!loading` — no navigation before the initial `getSession()` resolves (avoids a premature redirect to sign-in on cold start with a live session).

### 2.3 No Client INSERT on public.users

- The `users` table has NO INSERT RLS policy (per PATTERNS.md — verified in live schema).
- Verify no plan task attempts a client-side `from('users').insert(...)`. Profile row creation is trigger-only.

### 2.4 Google OAuth Platform Gate (02-02 Task 3/4)

- Google OAuth is Android-only (CONTEXT §2). The plan must use `Platform.OS === 'android'` gate.
- On iOS: disabled Apple stub button, NO Google button (Apple App Review guideline 4.8 — a Google sign-in button on iOS risks rejection).
- Deep-link scheme: `gotta-go://auth/callback` (NOT `gottago://`). Verify throughout 02-02.
- PKCE flow: supabase-js v2 defaults to PKCE. The plan must parse `?code=` from the callback, not implicit tokens.

---

## Priority 3: Plan Structural Correctness

### 3.1 Dependency Chain

Expected: `02-01a` → `02-01b` (depends_on: ["02-01a"]) → `02-02` (depends_on: ["02-01b"])
- Verify no plan attempts to use 02-01a artifacts before they exist.
- 02-02's `interfaces` block references `02-01-SUMMARY.md` — verify this is accessible (it's created when 02-01b completes).

### 3.2 BLOCKING Gates

- 02-01a Task 4: [BLOCKING] supabase db push. 02-01b must not start until this succeeds (screens call the RPCs).
- 02-02 Task 1: [BLOCKING] supabase db push. Tasks 3–6 in 02-02 must not start until this succeeds.

### 3.3 User Advocacy Premortem (The 60-Second Test)

A user urgently needs a bathroom. They open Gotta Go for the first time:
1. Cold start shows blank splash → Welcome screen (no premature redirect). Is this guaranteed?
2. They create an account. What if their display name is already taken? Does the plan handle this gracefully ("That display name is already taken.")?
3. After signup → GPS Consent screen. What if they tap "Skip for now"? Does the app enter the map without crashing, and without recording consent?
4. They try to delete their account. The plan requires typing `DELETE` exactly. What if the account deletion RPC fails? Is there a recovery path?
5. On iOS, a user tries to sign in with Google. The plan shows a disabled Apple stub — does this communicate clearly that there's no Google sign-in option available right now?

Flag any flow that ends in a dead end, loss of data, or silent failure.

---

## Verification Already Run

- GSD plan checker (revision 1): VERIFICATION PASSED — zero blockers, four warnings (all addressed).
- All `gottago://` references corrected to `gotta-go://` across CONTEXT, RESEARCH, UI-SPEC, both new plan files.
- VALIDATION.md Wave 0 test file names aligned to actual plan file paths.
- PATTERNS.md `flags.reporter_id` corrected to `availability_flags.reporter_id`.

---

## Required Output Format

```
## ANTIGRAVITY VERDICT: [APPROVE / REQUEST CHANGES / BLOCK]

### Summary
[one paragraph]

### Findings
[For each finding:]
**[SEVERITY: BLOCK | REQUEST CHANGES | NOTE]** `file:line` — [description]
[Specific fix required, if applicable]

### Verification Steps Taken
[Commands run and results, or explicit note that this is a plan review (no runnable code yet)]

### Sign-off
Antigravity — [date]
```

Severity definitions (from `docs/review-severity.md`):
- **BLOCK**: architectural flaw, data loss risk, security hole, or GDPR violation that must be fixed before ANY execution begins.
- **REQUEST CHANGES**: correctness issue, missing guard, or insufficient test coverage — fix before execution.
- **NOTE**: improvement suggestion that does not block execution.

**APPROVE** requires zero BLOCKs and zero REQUEST CHANGES.
