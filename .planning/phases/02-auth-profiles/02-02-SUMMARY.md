# Phase 2 — Plan 02-02 Summary (IN PROGRESS)
<!-- save point: 2026-07-01 -->
<!-- status: T1 COMPLETE, T2 partial (package done; dashboard pending), T3–T6 not started -->

---

## Commits

| SHA | Description | WU |
|-----|-------------|-----|
| `ac66fc4` | feat(02-02-T1): nullable FK migration + update_profile/delete_account RPCs | T1 |
| `fa63838` | chore(02-02-T2): install expo-auth-session@55.0.17 | T2 partial |

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

## T2 — expo-auth-session Verify + Dashboard Config (PARTIAL)

### Package (DONE)
- `expo-auth-session@55.0.17` installed via `npx expo install` (Expo-resolved pin)
- Publisher verified: `github.com/expo/expo`, MIT, no postinstall script
- `jest@29.7.0` unchanged

### Dashboard Tasks (PENDING — user must complete)
- [ ] Supabase Dashboard → Authentication → Providers → Google: enable with client id + secret
- [ ] Authentication → URL Configuration → Redirect URLs: add `gotta-go://auth/callback` and `gotta-go://**`
- [ ] Authentication → Providers → Email: confirm "Confirm email" is DISABLED
- [ ] EAS secrets: `GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` exist (never in repo)

**Resume signal:** User types `"approved — provider configured"`

---

## T3–T6 (NOT STARTED)

| Task | BD ID | Scope | Blocked By |
|------|-------|-------|------------|
| T3 — TDD modules | gotta-go-3ov | oauth.ts, updateProfile.ts, deleteAccount.ts, profileStats.ts + tests | T2 dashboard ✓ |
| T4 — OAuth UI + callback + sign-up wiring | gotta-go-wct | sign-in.tsx, auth/callback.tsx, sign-up.tsx | T3 |
| T5 — Profile + Settings + Delete/AuthRequired modals | gotta-go-g1u | (tabs)/profile.tsx, (components)/*.tsx | T3 |
| T6 — Profile-trigger provisioning test | gotta-go-ntn | features/profile/__tests__/profileTrigger.test.ts | T1 + T5 |

---

## Test Suite State (as of fa63838)
- **109 tests, 15 suites, 0 failures, 100% coverage** (unchanged from 02-01b)
- No new src/features/** added yet in 02-02 (T1/T2 are DB + package changes only)

---

## Migrations Applied (live — project ebmzhjmmtmldhrojkdqw)

| Migration | Name | Status |
|-----------|------|--------|
| 20260627000000 | handle_new_user_trigger | ✓ Applied (02-01a) |
| 20260627000001 | display_name_unique_index | ✓ Applied (02-01a) |
| 20260627000002 | auth_rpcs | ✓ Applied (02-01a) |
| 20260627000003 | nullable_user_fks | ✓ Applied (02-02 T1) |
| 20260627000004 | profile_rpcs | ✓ Applied (02-02 T1) |
