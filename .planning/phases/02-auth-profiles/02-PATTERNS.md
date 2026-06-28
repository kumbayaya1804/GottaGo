# Phase 2: Auth & Profiles - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 27 (new + modified)
**Analogs found:** 14 / 27 (13 have NO in-repo analog — greenfield auth; use RESEARCH.md patterns)

> Phase 2 is largely greenfield: there is **no existing auth code, no `features/` dir, no `constants/` dir, no babel.config**. The repo offers strong analogs for only four things: (1) the thin stub-screen shape, (2) the Supabase client import convention, (3) the jest mock/test structure, and (4) the SECURITY DEFINER SQL migration style. Everything else (SessionProvider, redirect guard, zod validation, OAuth, RPCs) has no analog and must follow RESEARCH.md §Architecture Patterns. This map tells the planner exactly which existing file each new file should imitate, and quotes the load-bearing excerpts.

---

## Environment Facts the Planner Must Know (verified by direct read)

| Fact | Evidence | Planner impact |
|------|----------|----------------|
| **No `babel.config.js` / `babel.config.ts` exists** | `app/` dir listing — only `jest.config.js`, `jest.setup.ts`, `tsconfig.json`, `tsconfig.test.json` | gesture-handler/reanimated may need a babel config; treat as a Wave 0 checkpoint. `react-native-reanimated@4.2.1` + `react-native-worklets` are already deps, so the worklets babel plugin is likely already resolved by `babel-preset-expo` — verify before adding. |
| **No `app/src/features/` directory** | `ls src/` → only `app`, `lib` | All covered auth logic modules are brand-new dirs. |
| **No `app/src/constants/` directory** | `ls src/` → only `app`, `lib` | UI-SPEC token files (`Colors.ts` etc.) are brand-new. |
| **`jest.config.js` excludes `src/app/**` from coverage** | `jest.config.js:11` `'!src/app/**'` | Logic must live in `src/features/**`; screens stay thin. Decision pending (Open Q6) whether to keep the exclusion. |
| **Path alias `@/*` → `./src/*`** | `tsconfig.json:5-9` | Use `@/features/...`, `@/lib/supabase` imports (but Phase 1 files used **relative** imports — see Import Conventions below). |
| **`tsconfig` excludes `__tests__` + `src/**/__tests__`** from app compile | `tsconfig.json:17-23` | Tests compiled via `tsconfig.test.json`. Keep tests in `__tests__/` subdirs. |
| **Scheme is `gotta-go`** (NOT `gottago`) | `app.config.ts:10` `scheme: 'gotta-go'` | Deep link is `gotta-go://auth/callback`. CONTEXT/UI-SPEC `gottago` is wrong — Pitfall 1. |
| **`config.toml`: `minimum_password_length = 6`, `enable_confirmations = false`** | `config.toml:177,221` | UI validates 8; align config to 8 (Wave 0). Confirmation-disabled matches decision #6. |
| **No `[auth.external.google]` block; `[auth.external.apple]` at line 317** | `config.toml:317` | Google provider must be added (config + remote dashboard). |

---

## File Classification

### Covered logic — `src/features/**` (TDD-100%, test-first)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/features/auth/SessionProvider.tsx` | provider | event-driven | *(none — first provider)* | no-analog |
| `src/features/auth/useSession.ts` | hook | request-response | *(none)* | no-analog |
| `src/features/auth/redirect.ts` | utility (pure) | transform | *(none)* | no-analog |
| `src/features/auth/validation.ts` | utility (zod) | transform | `src/lib/appConfigSmoke.ts` | role-match (pure const/logic module) |
| `src/features/auth/oauth.ts` | service | request-response | `src/lib/supabase.ts` (import shape) | partial |
| `src/features/auth/gpsConsent.ts` | service | request-response | *(none)* | no-analog |
| `src/features/auth/displayName.ts` | service | request-response | *(none)* | no-analog |
| `src/features/profile/deleteAccount.ts` | service | request-response | *(none)* | no-analog |

### Thin screens — `src/app/**` (excluded from coverage; still TDD-tested per TDD Guard)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/_layout.tsx` (MODIFY) | layout | event-driven | self (current stub) + `(tabs)/_layout.tsx` | exact (shape) |
| `src/app/index.tsx` (NEW — Welcome) | screen | request-response | `(auth)/sign-in.tsx` stub | exact |
| `src/app/gps-consent.tsx` (NEW) | screen | request-response | `(auth)/sign-in.tsx` stub | role-match |
| `src/app/reset-password.tsx` (NEW) | screen | request-response | `(auth)/sign-in.tsx` stub | role-match |
| `src/app/(auth)/sign-in.tsx` (MODIFY) | screen | request-response | self (stub) | exact |
| `src/app/(auth)/sign-up.tsx` (MODIFY) | screen | request-response | self (stub) | exact |
| `src/app/(auth)/forgot-password.tsx` (NEW) | screen | request-response | `(auth)/sign-in.tsx` stub | exact |
| `src/app/(auth)/_layout.tsx` (maybe MODIFY) | layout | — | self | exact |
| `src/app/(tabs)/_layout.tsx` (MODIFY) | layout | — | self | exact |
| `src/app/(tabs)/index.tsx` (KEEP public) | screen | request-response | self (stub) | exact |
| `src/app/(tabs)/profile.tsx` (MODIFY — protected) | screen | request-response | `(tabs)/profile.tsx` stub | exact |
| `src/app/settings.tsx` or `(tabs)/settings.tsx` (NEW stub) | screen | request-response | `(tabs)/profile.tsx` stub | exact |
| `src/app/(tabs)/nearby.tsx`, `submit.tsx` (NEW stubs) | screen | request-response | `(tabs)/index.tsx` stub | exact |

### Constants — `src/constants/**` (TDD-excluded per UI-SPEC; not behavioral)

| New File | Role | Analog | Match |
|----------|------|--------|-------|
| `src/constants/Colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts` | config | *(none — old Expo template `constants/` is tsconfig-excluded)* | no-analog |

### Migrations — `supabase/migrations/**` (TDD-OFF; Antigravity-reviewed)

| New Migration | Role | Data Flow | Closest Analog | Match |
|---------------|------|-----------|----------------|-------|
| `*_handle_new_user_trigger.sql` | migration | event-driven | `20260519010000_remote_schema.sql` (DDL) | role-match |
| `*_display_name_unique_index.sql` | migration | transform | `20260519010000` (index DDL) | role-match |
| `*_nullable_user_fks.sql` | migration | transform | `20260519010000` (FK DDL) | role-match |
| `*_set_gps_consent_rpc.sql` | migration (RPC) | request-response | `20260624000002_ratings_privacy_fix.sql` | exact (SECURITY DEFINER) |
| `*_check_display_name_available_rpc.sql` | migration (RPC) | request-response | `20260624000002` | exact |
| `*_delete_account_rpc.sql` | migration (RPC) | request-response | `20260624000002` | exact |

### Test files — `src/**/__tests__/*.test.ts(x)`

| New Test | Analog | Match |
|----------|--------|-------|
| `features/auth/__tests__/*.test.ts(x)` | `src/lib/__tests__/supabase.test.ts` | exact (mock + assert structure) |

---

## Pattern Assignments

### `src/app/_layout.tsx` (MODIFY — layout, event-driven)

**Analog:** itself (current stub) + `src/app/(tabs)/_layout.tsx`. The planner is **replacing** this file.

**Current full content** (`src/app/_layout.tsx:1-10`) — what gets replaced:
```typescript
import { View } from 'react-native';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack />
    </View>
  );
}
```

**Target shape** (per RESEARCH §Pattern 1/2 + Code Example "GestureHandlerRootView"): wrap with `GestureHandlerRootView` → `SessionProvider` → guard effect (`useSegments` + `router.replace`, gated on `loading`) → `<Stack/>`/`<Slot/>`. The guard *decision* lives in `features/auth/redirect.ts` (pure, covered); the layout only wires it. Keep `style={{ flex: 1 }}` convention from the current stub.

---

### `src/app/(auth)/sign-in.tsx` & `sign-up.tsx` (MODIFY — screen, request-response)

**Analog:** themselves (stubs). Planner **replaces** the body.

**Current full content** (`(auth)/sign-in.tsx:1-9`, `sign-up.tsx` identical except label):
```typescript
import { View, Text } from 'react-native';

export default function SignInScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Sign In (Phase 2)</Text>
    </View>
  );
}
```

**Target:** thin screen — react-hook-form + zod resolver (schemas imported from `@/features/auth/validation`), calls `supabase.auth.signInWithPassword` / `signUp` (sign-up passes `options: { data: { display_name } }` per RESEARCH Code Example). On-submit validation only (decision #16). Generic error copy "Invalid email or password." No logic inline — push it to `features/auth`.

---

### `src/app/(tabs)/profile.tsx` (MODIFY — screen, request-response, PROTECTED)

**Analog:** itself (stub, identical shape to sign-in stub above).

**Current** (`(tabs)/profile.tsx:1-9`): same `View`+`Text` stub, label `Profile (Phase 2)`.

**Target:** reads `useSession()`; if no session, the root guard already redirected — but per RESEARCH Pattern 2 gotcha (d), `(tabs)/profile` is intentionally **public navigation** with an Auth-Required modal on protected actions, NOT a hard redirect. Lazy-fetch the `users` row via TanStack Query (decision #3) — never in SessionProvider.

---

### `src/app/(tabs)/index.tsx` (KEEP public — screen)

**Analog:** itself. **No auth gate.** `redirect.ts` must treat `(tabs)/index` as public (RESEARCH Pattern 2 gotcha d). Current stub stays until Phase 3; only confirm it is not redirected.

---

### New stub screens (`index.tsx` Welcome, `gps-consent.tsx`, `reset-password.tsx`, `forgot-password.tsx`, `settings`, `nearby`, `submit`)

**Analog:** the `(auth)/sign-in.tsx` stub shape above. **Creation method matters:** per Phase 1 convention (project CLAUDE.md "Conventions"), *placeholder* screens were created **via Bash, not Write** (TDD Guard blocks Write on non-behavioral files). But Phase 2 screens that contain behavior (forms, consent logic wiring) are behavioral and follow TDD: test-first, then implement. Pure visual stubs (`nearby`, `submit`) may use the Bash route. Planner must decide per file and cite which.

---

### `src/features/auth/validation.ts` (NEW — utility, transform)

**Analog:** `src/lib/appConfigSmoke.ts` (closest existing pure exported-constant/logic module).

**Analog imports + export convention** (`src/lib/appConfigSmoke.ts` — read it for the `export const X = [...] as const` shape; it is a small typed constant module with a colocated test). Mirror that: a covered module exporting named zod schemas.

**Target** (RESEARCH Code Example "Zod validation schema"):
```typescript
export const displayName = z.string()
  .min(3, 'Display name must be at least 3 characters.')
  .max(20, 'Display name must be 20 characters or fewer.')
  .regex(/^[A-Za-z0-9 _-]+$/, 'Display name can only contain letters, numbers, spaces, hyphens, and underscores.');
export const password = z.string().min(8, 'Password must be at least 8 characters.');
```
Display-name uniqueness is case-insensitive (CONTEXT §10) — the regex above governs format; uniqueness is DB + RPC.

---

### `src/features/auth/oauth.ts`, `gpsConsent.ts`, `deleteAccount.ts`, `displayName.ts` (NEW — service, request-response)

**Analog:** `src/lib/supabase.ts` for the **import + singleton-client** convention only; no behavioral analog exists.

**Import convention to copy** (`src/lib/supabase.ts:1-4`):
```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
```
New service modules import the shared client: `import { supabase } from '@/lib/supabase'` (or relative `../../lib/supabase` to match Phase 1's relative style — see Import Conventions). Behaviors come from RESEARCH Patterns 3/4 + Code Examples (OAuth via `expo-web-browser`, `supabase.rpc('set_gps_consent')`, `supabase.rpc('delete_account')`).

---

### `src/features/auth/__tests__/*.test.ts(x)` (NEW — tests)

**Analog:** `src/lib/__tests__/supabase.test.ts` (exact structural analog for mocking Supabase + asserting call args).

**Mock + assert pattern to copy** (`src/lib/__tests__/supabase.test.ts:4-16`):
```typescript
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
import '../supabase';
```
Note the `jest.isolateModules` + save/restore-env pattern (lines 39-61) for testing module-load-time branches — reuse it for SessionProvider env/getSession branches.

**Global mocks already present** in `jest.setup.ts` (do NOT re-declare): `@rnmapbox/maps` (7-13), `expo-location` (15-19, incl. `requestForegroundPermissionsAsync` — used by gpsConsent), `react-native-mmkv` (21-30), and env vars `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` (4-5). Per RESEARCH Wave 0 gap, ADD mocks for `expo-web-browser` and `expo-router` (`useSegments`/`useRouter`) here.

---

### SQL RPC migrations: `set_gps_consent`, `check_display_name_available`, `delete_account`

**Analog:** `supabase/migrations/20260624000002_ratings_privacy_fix.sql` (EXACT — existing SECURITY DEFINER RPC pattern).

**SECURITY DEFINER + grant pattern to copy** (`20260624000002_ratings_privacy_fix.sql:17-34, 70-75`):
```sql
create or replace function get_locations_in_radius( ... )
returns setof locations
language sql           -- or plpgsql for delete_account
security definer
stable                 -- delete_account is volatile (omit stable)
set search_path = public
as $$
  ...
$$;

grant execute on function <name>(<arg types>) to authenticated;
-- grant to anon only for pre-auth checks (e.g. check_display_name_available)
```

**Migration header-comment convention** (`20260624000002:1-11`): every migration opens with a `--` comment block citing the phase + the review finding/reason. New Phase 2 migrations must follow this (cite CONTEXT decision + the live-schema gap they fix). Section dividers use `-- ─── N. Title ──────`.

**`delete_account` body** per RESEARCH Pattern 4 — `language plpgsql security definer set search_path = public, auth`; guard `if auth.uid() is null then raise exception`; UPDATE-to-null on anonymized cols; then `delete from auth.users where id = uid`.

---

### DDL migrations: `handle_new_user` trigger, unique index, nullable FKs

**Analog:** `supabase/migrations/20260519010000_remote_schema.sql` (table/index/policy DDL).

**`users` table — exact current columns** (`20260519010000_remote_schema.sql:12-28`), authoritative for new migrations:
```sql
create table users (
  id                             uuid primary key references auth.users(id) on delete cascade,
  email                          text,
  display_name                   text,            -- nullable today; trigger sets id+email only
  created_at                     timestamptz default now(),
  updated_at                     timestamptz default now(),
  gps_consent                    boolean,         -- nullable; set_gps_consent RPC writes true
  gps_consent_at                 timestamptz,     -- written only on granted
  gamification_points            integer default 0,
  trust_score                    integer default 9,
  trust_multiplier               numeric default 0.5,
  gps_verified_contribution_count integer default 0,
  leaderboard_position           integer,
  shadowban_status               boolean default false,
  admin_override                 boolean default false,
  family_mode                    boolean default false
);
```

**Existing `users` RLS (no INSERT policy — why trigger is required)** (`20260519010000:37-47`):
```sql
create policy "service_role_all" on users for all using ((auth.jwt() ->> 'role') = 'service_role');
create policy "users_select_own" on users for select using (auth.uid() = id);
create policy "users_update_own" on users for update using (auth.uid() = id);
-- NO insert policy → client cannot self-provision → handle_new_user trigger (SECURITY DEFINER) required
```

**Display-name unique index** (RESEARCH Pattern 5, case-insensitive per CONTEXT §10):
```sql
create unique index users_display_name_lower_uniq on public.users (lower(display_name));
```

**FK columns needing `ON DELETE SET NULL` + nullable** (verified line numbers in `20260519010000`):
| Table.column | Line | Current state |
|--------------|------|---------------|
| `submissions.submitter_id` | :190 | `uuid not null references users(id)` |
| `ratings.user_id` | :374 | `uuid not null references users(id)`, `unique(user_id, location_id)` :381 |
| `trust_events.user_id` | :106 | `uuid not null references users(id)` |
| `verification_events.user_id` | :155 | `uuid not null references users(id)` |
| `reports.user_id` | :226 | `uuid not null references users(id)` |
| `failure_events.user_id` | :262 | `uuid not null references users(id)` |
| `availability_flags.reporter_id` | :294 | `uuid not null references users(id)` (also references users — confirm deletion handling) |

CONTEXT §6 names all seven; `availability_flags.reporter_id` (:294) is the 7th `users(id)` ref included in the SET NULL migration (RESEARCH Open Q2 / Assumption A6). NULLs are distinct in Postgres unique indexes, so `ratings.unique(user_id, location_id)` stays valid after nulling.

**`handle_new_user` trigger** (CONTEXT §10 — function body confirmed against live DB): `INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email)` — does **not** set `display_name`. Therefore `display_name` must be set by a post-signup RPC/update (the trigger reading `raw_user_meta_data->>'display_name'` is the RESEARCH *alternative*, but CONTEXT §10 locks the id+email-only body). Capture the existing live trigger in a migration for reproducibility.

---

## Shared Patterns

### Supabase singleton client (already built — import, never recreate)
**Source:** `src/lib/supabase.ts:16-23`
**Apply to:** every `features/**` service + screen that touches auth/db.
```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
```
CONTEXT §1 / decision #18: **no changes to this file.** Import `{ supabase }` everywhere.

### Thin-screen shape
**Source:** `src/app/(auth)/sign-in.tsx:1-9`
**Apply to:** all `src/app/**` screens — default-export a single component, `View` with `style={{ flex: 1, ... }}`, logic delegated to `features/**`.

### SECURITY DEFINER RPC + grant
**Source:** `supabase/migrations/20260624000002_ratings_privacy_fix.sql:17-34, 70-75`
**Apply to:** `set_gps_consent`, `check_display_name_available`, `delete_account`. Always `set search_path = public`; explicit grants to `authenticated` (and `anon` only for the pre-signup display-name check).

### Migration header + section-divider comments
**Source:** `20260624000002_ratings_privacy_fix.sql:1-13`
**Apply to:** all six Phase 2 migrations. Open with phase/reason comment block; use `-- ─── N. Title ──────` dividers.

### Test mock + isolateModules
**Source:** `src/lib/__tests__/supabase.test.ts:4-16, 39-61`
**Apply to:** all `features/auth` unit tests. Reuse `jest.isolateModules` + env save/restore for module-load branches.

---

## Import Conventions (Phase 1 observed)

| Convention | Evidence | Note |
|------------|----------|------|
| **Relative imports within `src/lib`** | `supabase.ts:4` `import type { Database } from './database.types'`; tests `import '../supabase'` | Phase 1 used **relative**, not `@/` alias, for intra-dir imports. |
| `@/*` alias **available** but unused so far | `tsconfig.json:5-9` | Planner may adopt `@/features/...` for cross-feature imports; be consistent within a plan. |
| **Named export** for libs/utils | `export const supabase`, `export const APP_CONFIG_SMOKE_KEYS` | features modules → named exports. |
| **Default export** for screens/layouts | every `src/app/**` file `export default function XScreen()` | Expo Router requires default export. |
| Polyfill side-effect import first | `supabase.ts:1` `import 'react-native-url-polyfill/auto'` | Order matters; keep side-effect imports at top. |
| RN imports before lib imports | `import { View, Text } from 'react-native'` first | Consistent ordering. |

---

## No Analog Found

Planner should use **RESEARCH.md §Architecture Patterns** (cited section in brackets) for these — the repo has nothing to copy:

| File | Role | Data Flow | Use instead |
|------|------|-----------|-------------|
| `features/auth/SessionProvider.tsx` | provider | event-driven | RESEARCH §Pattern 1 |
| `features/auth/useSession.ts` | hook | request-response | RESEARCH §Pattern 1 |
| `features/auth/redirect.ts` | utility (pure) | transform | RESEARCH §Pattern 2 (`nextRoute`) |
| `features/auth/oauth.ts` | service | request-response | RESEARCH §Pattern 3 |
| `features/auth/gpsConsent.ts` | service | request-response | RESEARCH §Code Example "GPS consent write" + Pattern 6 events |
| `features/auth/displayName.ts` | service | request-response | RESEARCH §Pattern 5 |
| `features/profile/deleteAccount.ts` | service | request-response | RESEARCH §Pattern 4 |
| `app/auth/callback.tsx` | screen | event-driven | RESEARCH §Pattern 3/6 (deep-link parse) |
| `app/gps-consent.tsx` | screen | request-response | RESEARCH §Code Example "GPS consent" + UI-SPEC |
| `constants/Colors.ts` (+typography/spacing/radius) | config | — | `02-UI-SPEC.md` (39 color tokens) |
| `handle_new_user` trigger | migration | event-driven | CONTEXT §10 (live body) + RESEARCH Pitfall 4 |
| `delete_account` RPC | migration | request-response | RESEARCH §Pattern 4 (FK migration first) |
| `babel.config.js` (if needed) | config | — | RESEARCH §Environment Availability (verify, likely unneeded) |

---

## Metadata

**Analog search scope:** `app/src/app/**`, `app/src/lib/**`, `app/src/lib/__tests__/**`, `supabase/migrations/**`, `app/` root config files.
**Files scanned:** 24 (6 stub screens, 2 layouts, supabase client + appConfigSmoke + their 2 tests, jest.config, jest.setup, package.json, tsconfig×2, app.config.ts scheme, config.toml, 3 migrations read in full/grep).
**Pattern extraction date:** 2026-06-27
