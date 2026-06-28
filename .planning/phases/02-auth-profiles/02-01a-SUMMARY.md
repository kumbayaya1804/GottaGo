# Phase 2 — Plan 02-01a Summary

**Completed:** 2026-06-28
**Plan:** Wave 0 foundation (packages, babel, Supabase config, design tokens, DB migrations)
**Status:** ALL TASKS COMPLETE — 02-01b may begin

---

## Migrations Applied (live — Supabase project ebmzhjmmtmldhrojkdqw)

Applied via Supabase MCP `apply_migration` (supabase CLI required `SUPABASE_DB_PASSWORD` which is not set in this environment):

| Migration | Name | Status |
|-----------|------|--------|
| 20260627000000 | handle_new_user_trigger | ✓ Applied |
| 20260627000001 | display_name_unique_index | ✓ Applied |
| 20260627000002 | auth_rpcs | ✓ Applied |

**Live verification (Supabase MCP):**
- `users_display_name_lower_uniq` index: EXISTS on public.users(lower(display_name))
- `check_display_name_available(text)`: callable by anon + authenticated ✓
- `set_gps_consent()`: callable by authenticated only; anon explicitly revoked ✓
  - Note: Supabase auto-grants EXECUTE to anon on all public-schema functions via ALTER DEFAULT PRIVILEGES. Both `revoke from public` AND `revoke from anon` are required. Documented in migration comment.
- `handle_new_user` trigger: live, inserts id+email ONLY (no display_name — CONTEXT §10 LOCKED)

---

## Packages

- `react-native-gesture-handler ~2.30.0` added to dependencies (Expo SDK-55 pin via `npx expo install`)
- `jest@29.7.0` CONFIRMED PINNED — not upgraded

---

## Babel

- `app/babel.config.js` created with `babel-preset-expo` preset and `react-native-worklets/plugin`
- `react-native-worklets/plugin` resolves via `react-native-reanimated@4.2.1` ✓

---

## Supabase Config

- `minimum_password_length = 8` (aligned to Zod 8-char rule)
- `[auth.external.google]` block added with `env(GOOGLE_CLIENT_ID)` / `env(GOOGLE_SECRET)` references

---

## Jest Harness

New mocks added to `app/jest.setup.ts`:
- `expo-web-browser` → `maybeCompleteAuthSession`, `openAuthSessionAsync`
- `expo-router` → `useSegments`, `useRouter` (with `replace` mock)

Existing mocks untouched: `@rnmapbox/maps`, `expo-location`, `react-native-mmkv`

Test results after changes: **7 passed, 0 failed** (`cd app && npm test`)

---

## Design Token Files

| File | Status | Notes |
|------|--------|-------|
| `app/constants/Colors.ts` | ✓ Created | 35-token light+dark table from design-system.md §1; default + named export |
| `app/src/constants/typography.ts` | ✓ Created | 9 scale entries (display→label) |
| `app/src/constants/spacing.ts` | ✓ Created | xs(4)→giant(64) |
| `app/src/constants/radius.ts` | ✓ Created | xs→pill(9999) |
| `app/src/constants/legal.ts` | ✓ Created | LEGAL_URLS — **PLACEHOLDER** |

---

## ⚠️ LEGAL_URLS Status: PLACEHOLDER

`app/src/constants/legal.ts` exports:
```ts
export const LEGAL_URLS = {
  termsOfService: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=PLACEHOLDER_TOS',
  privacyPolicy: 'https://app.termly.io/policy-viewer/policy.html?policyUUID=PLACEHOLDER_PRIVACY',
}
```

**User action required before any user-facing build:** Replace `PLACEHOLDER_TOS` and `PLACEHOLDER_PRIVACY` with real Termly policy UUIDs from the Termly dashboard (Share/Preview button → URL contains the UUID).

---

## Commits

| SHA | Description |
|-----|-------------|
| `15a8dc4` | feat(02-01a): Wave 0 packages, babel, Supabase config, jest mocks |
| `502105c` | feat(02-01a): Design token files — Colors, typography, spacing, radius, legal |
| `6c60a1d` | feat(02-01a): Wave 0 migrations — handle_new_user trigger, display_name index, auth RPCs |
