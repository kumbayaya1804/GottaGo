# Phase 2 — Plan 02-02 Summary (IN PROGRESS)
<!-- save point: 2026-07-01 (round 2) -->
<!-- status: T1 COMPLETE, T2 COMPLETE, T3 code-complete/uncommitted (blocked on live migration apply — see .beads/context/execution-state.md), T4–T6 not started -->

---

## Commits

| SHA | Description | WU |
|-----|-------------|-----|
| `ac66fc4` | feat(02-02-T1): nullable FK migration + update_profile/delete_account RPCs | T1 |
| `fa63838` | chore(02-02-T2): install expo-auth-session@55.0.17 | T2 partial (dashboard/EAS config has no code commit — verified live, not git-tracked) |
| — | T3 not yet committed — code complete, one review round done with fixes applied, blocked on live migration apply pending fresh user confirmation in a new session | T3 |

---

## T1 — Nullable FK Migration + Profile RPCs (COMPLETE)

### Migration 000003: nullable_user_fks
Applied live to project `ebmzhjmmtmldhrojkdqw`. All 7 FK columns now:
- `NOT NULL` dropped
- FK constraint re-added with `ON DELETE SET NULL`

| Table | Column | Old | New |
|-------|--------|-----|-----|
| submissions | submitter_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| ratings | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| trust_events | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| verification_events | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| reports | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| failure_events | user_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |
| availability_flags | reporter_id | NOT NULL RESTRICT | nullable ON DELETE SET NULL |

### Migration 000004: profile_rpcs
Applied live. Two SECURITY DEFINER functions (revoke public + anon; grant authenticated):

| RPC | Signature | Behavior |
|-----|-----------|----------|
| `update_profile` | `(new_display_name text) → void` | Checks auth.uid(); UPDATE users SET display_name, updated_at |
| `delete_account` | `() → void` | Nulls 7 FK columns atomically then DELETE auth.users |

`database.types.ts` regenerated — both RPCs typed in Functions block.

---

## T2 — expo-auth-session Verify + Dashboard Config (COMPLETE)

### Package (DONE)
- `expo-auth-session@55.0.17` installed via `npx expo install` (Expo-resolved pin)
- Publisher verified: `github.com/expo/expo`, MIT, no postinstall script
- `jest@29.7.0` unchanged

### Dashboard Tasks (DONE — verified live 2026-07-01)
- [x] Supabase Dashboard → Authentication → Providers → Google: enabled with real client id + secret (from a newly-created Google Cloud OAuth 2.0 Web client, redirect URI `https://ebmzhjmmtmldhrojkdqw.supabase.co/auth/v1/callback`)
- [x] Authentication → URL Configuration → Redirect URLs: `gotta-go://auth/callback` and `gotta-go://**` added
- [x] Authentication → Providers → Email: "Confirm email" confirmed DISABLED
- [x] EAS secrets: `GOOGLE_CLIENT_ID` (sensitive) and `GOOGLE_SECRET` (secret) confirmed present in all 3 EAS environments (production/preview/development) via `eas env:list`

---

## T3 — Covered OAuth + Profile Modules (CODE COMPLETE, NOT COMMITTED — round 3 review pending)

**Files:** `auth/oauth.ts`, `profile/{updateProfile,deleteAccount,profileStats}.ts` + 4 test files (21 tests total, 100% coverage on all four).

**Review round 1:** Both Antigravity and Codex independently returned REQUEST CHANGES:
- [CRITICAL/MAJOR, both] `profileStats.ts` queried `ratings` directly — blocked by the privacy-motivated privilege revocation in migration `20260624000002`. Fixed by adding `get_profile_stats()` SECURITY DEFINER RPC deriving the user via `auth.uid()`, and rewriting `profileStats.ts`/its test to call it instead of querying tables directly.
- [MINOR, Antigravity] `oauth.ts` unsafe `data.url` access — fixed with an explicit guard.
- [MINOR, informational] iOS Guideline 4.8 gating is T4's (`sign-in.tsx`) responsibility, not T3's — flagged forward, no T3 action needed.

**Migration applied (2026-07-01):** user confirmed directly in a live session; applied via Supabase MCP `apply_migration` to `ebmzhjmmtmldhrojkdqw`, `database.types.ts` regenerated, full DoD re-passed (0 typecheck errors, 130/130 tests, 100% coverage, 0 lint errors).

**Review round 2:**
- Antigravity: **APPROVE** — critical `ratings` fix confirmed resolved; only a MINOR carry-forward note (iOS 4.8 gating, T4's concern).
- Codex: **REQUEST CHANGES** — [MAJOR] the Supabase MCP `apply_migration` tool assigns its own timestamp-based version on apply rather than honoring the local file's version. Local file was drafted as `20260627000005_profile_stats_rpc.sql` but Supabase recorded it live as `20260701211135_profile_stats_rpc`, creating repo/live migration-history drift. Fixed by renaming the local file to `20260701211135_profile_stats_rpc.sql` to match. All of Codex's other findings from round 1 confirmed resolved (RPC correctness, `auth.uid()` scoping, cast pattern acceptable, test coverage of the error path).

**Still needs, in order:** round 3 review (Antigravity + Codex re-confirm on the renamed file — content unchanged, filename only) → commit → close `gotta-go-3ov` → re-enable TDD Guard (`tdd-guard on`, exact literal message) → proceed to T4.

---

## T4–T6 (NOT STARTED)

| Task | BD ID | Scope | Blocked By |
|------|-------|-------|------------|
| T4 — OAuth UI + callback + sign-up wiring | gotta-go-wct | sign-in.tsx, auth/callback.tsx, sign-up.tsx | T3 commit |
| T5 — Profile + Settings + Delete/AuthRequired modals | gotta-go-g1u | (tabs)/profile.tsx, (components)/*.tsx | T3 commit |
| T6 — Profile-trigger provisioning test | gotta-go-ntn | features/profile/__tests__/profileTrigger.test.ts | T1 + T5 |

---

## Test Suite State (as of last independent verification, pre-commit)
- **19 suites, 130 tests, 100% coverage** on all touched files (oauth.ts, updateProfile.ts, deleteAccount.ts, profileStats.ts all at 100%)
- `profileStats.ts` has 4 expected typecheck errors until the RPC migration above is live and types regenerated — generated-types lag, not a real bug

---

## Migrations Applied (live — project ebmzhjmmtmldhrojkdqw)

| Migration | Name | Status |
|-----------|------|--------|
| 20260627000000 | handle_new_user_trigger | ✓ Applied (02-01a) |
| 20260627000001 | display_name_unique_index | ✓ Applied (02-01a) |
| 20260627000002 | auth_rpcs | ✓ Applied (02-01a) |
| 20260627000003 | nullable_user_fks | ✓ Applied (02-02 T1) |
| 20260627000004 | profile_rpcs | ✓ Applied (02-02 T1) |
