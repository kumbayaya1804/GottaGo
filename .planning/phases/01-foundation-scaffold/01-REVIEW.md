---
phase: 01-foundation-scaffold
reviewed: 2026-06-24T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - app/app.config.ts
  - app/eas.json
  - app/eslint.config.js
  - app/jest.config.js
  - app/jest.setup.ts
  - app/package.json
  - app/tsconfig.json
  - app/.coverage-thresholds.json
  - app/src/app/_layout.tsx
  - app/src/app/+not-found.tsx
  - app/src/app/(auth)/_layout.tsx
  - app/src/app/(auth)/sign-in.tsx
  - app/src/app/(auth)/sign-up.tsx
  - app/src/app/(tabs)/_layout.tsx
  - app/src/app/(tabs)/index.tsx
  - app/src/app/(tabs)/profile.tsx
  - app/src/app/location/[id].tsx
  - app/src/lib/supabase.ts
  - app/src/lib/database.types.ts
  - app/src/lib/appConfigSmoke.ts
  - app/src/lib/__tests__/appConfigSmoke.test.ts
  - app/src/lib/__tests__/supabase.test.ts
  - supabase/migrations/20260519020000_fix_schema.sql
  - supabase/migrations/20260519030000_fix_rls.sql
  - supabase/migrations/20260624000000_block_fixes.sql
  - supabase/seed.sql
findings:
  critical: 5
  warning: 4
  info: 1
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This is a foundation and scaffold phase. The Expo/TypeScript/Jest wiring is mostly sound, and the
Supabase client configuration correctly sets `detectSessionInUrl: false` and uses AsyncStorage.
However, five critical issues were found that must be resolved before any Phase 2 work ships:
three are security defects in the migrations that leave the shadowban filter and the ratings view
broken at the database level, and two are correctness bugs — a native SDK version mismatch that
will fail every native build, and a broken test that silently passes while not actually verifying
the error-throw behavior it claims to test.

---

## Critical Issues

### CR-01: `availability_flags_public` view shadowban filter is a no-op for anon callers

**File:** `supabase/migrations/20260519030000_fix_rls.sql:58-66`

**Issue:** The view comment says it is a "security-definer view" so the `not exists (select 1 from users ...)` shadowban subquery will run with full users visibility. This claim is incorrect. In PostgreSQL, views do NOT have a `SECURITY DEFINER` attribute like functions do. A regular `CREATE VIEW` always evaluates RLS policies using the **caller's** identity, not the view owner's. There is no `security_invoker = false` or any equivalent that makes views run as the owner for RLS evaluation in standard PostgreSQL (PG15+ added `security_invoker = true` to make invoker mode explicit, but the default was already invoker).

Consequence: when an `anon` caller queries `availability_flags_public`, the `users` table subquery runs under the `anon` role. The `users_select_own` policy (`auth.uid() = id`) evaluates with `auth.uid() = null` for anon, so zero user rows are visible. `NOT EXISTS (...)` is therefore always `true` — every shadowbanned reporter's flags pass through without suppression. The BLOCK fix that was supposed to close this hole is itself broken in the same way as the original policy it replaced.

This is the identical flaw documented in the migration comment at line 21-25 ("anon role sees zero users rows... so not exists(...) was always true") — the fix applied the diagnosis correctly to the old `availability_flags_select_public` policy but failed to recognize that the replacement view has the same RLS evaluation context problem.

**Fix:** Use a `SECURITY DEFINER` function instead of a view, or use a function that queries `users` via the service role. The view approach cannot work for shadowban filtering when the caller is `anon`. Example replacement:

```sql
-- Drop the view
drop view if exists availability_flags_public;

-- Security-definer function returns the filtered rows without caller RLS
create or replace function get_availability_flags_public(p_location_id uuid default null)
returns table(id uuid, location_id uuid, type text, created_at timestamptz, expires_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select f.id, f.location_id, f.type, f.created_at, f.expires_at
  from availability_flags f
  where f.expires_at > now()
    and not exists (
      select 1 from users u
      where u.id = f.reporter_id
        and u.shadowban_status = true
    )
    and (p_location_id is null or f.location_id = p_location_id);
$$;

grant execute on function get_availability_flags_public(uuid) to anon;
grant execute on function get_availability_flags_public(uuid) to authenticated;
```

---

### CR-02: `ratings_public` view exposes all ratings to anon via no-RLS view, but intent is aggregate-safe public read — the view itself is not security-definer and RLS blocks it

**File:** `supabase/migrations/20260624000000_block_fixes.sql:42-52`

**Issue:** `ratings_public` is a standard `CREATE VIEW` (no `security_invoker` annotation). When `anon` queries it, PostgreSQL evaluates RLS on the underlying `ratings` table in the anon caller's context. The only remaining SELECT policy on `ratings` is `ratings_select_own` (`auth.uid() = user_id`), which returns false for anon (null uid). Result: `anon` querying `ratings_public` gets zero rows — the public display view the comment promises does not work.

Separately, the view also grants SELECT on `ratings_public` to `authenticated`, but authenticated users querying through the view are also subject to `ratings_select_own`, so they can only see their own rows through the view. The view provides no benefit over querying the base table directly.

The fix to drop `ratings_select_public` was correct — but the replacement public view is non-functional without also being a security-definer function.

**Fix:** Replace the view with a `SECURITY DEFINER` function:

```sql
drop view if exists ratings_public;

create or replace function get_ratings_public(p_location_id uuid)
returns table(
  id uuid, location_id uuid, cleanliness int4, accessibility int4,
  convenience int4, review_text text, created_at timestamptz, updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select id, location_id, cleanliness, accessibility, convenience,
         review_text, created_at, updated_at
  from ratings
  where location_id = p_location_id;
$$;

grant execute on function get_ratings_public(uuid) to anon;
grant execute on function get_ratings_public(uuid) to authenticated;
```

---

### CR-03: `get_locations_in_radius` and `count_locations_within` silently exclude locations with NULL `shadowban_status`

**File:** `supabase/migrations/20260624000000_block_fixes.sql:98,153`

**Issue:** Both functions filter with `shadowban_status = false`. In SQL, `NULL = false` evaluates to `NULL` (unknown), which is falsy in a WHERE clause. Any location row where `shadowban_status IS NULL` (permitted by the schema: `shadowban_status: boolean | null`) is silently excluded from all radius search results. This means legitimate locations that have never had their shadowban status explicitly set to `false` are invisible to every client query. The schema default for `locations.shadowban_status` needs to be verified, but the safe filter is explicit:

```sql
-- Replace:
and l.shadowban_status = false
-- With:
and (l.shadowban_status is null or l.shadowban_status = false)
-- Or better, ensure a NOT NULL DEFAULT false column constraint exists and
-- rely on = false only after verifying the schema guarantees non-null.
```

Same fix applies to `count_locations_within` at line 153.

---

### CR-04: Native SDK version mismatch — `@rnmapbox/maps` npm package v10 vs EAS config SDK v11

**File:** `app/package.json:19` and `app/app.config.ts:46`

**Issue:** `package.json` depends on `@rnmapbox/maps: "^10.3.1"` (Mapbox SDK 10.x npm wrapper) while `app.config.ts` sets `RNMapboxMapsVersion: '11.20.1'` (SDK 11 native). These are incompatible: the EAS/Expo plugin downloads the native Mapbox framework version specified in `RNMapboxMapsVersion`, but the JavaScript bridge is the npm package version. SDK 10 JS bridge + SDK 11 native will cause linker failures or runtime crashes on iOS and Android native builds. This is a guaranteed native build failure.

**Fix:**

```json
// package.json — bump to SDK 11 compatible package
"@rnmapbox/maps": "^11.20.1"
```

Verify `^11.20.1` is published on npm. If the package uses a different versioning scheme from the native SDK, consult `@rnmapbox/maps` changelog to find the npm package version that wraps native SDK 11.20.1.

---

### CR-05: `supabase.test.ts` — env-var throw tests silently pass without verifying the throw

**File:** `app/src/lib/__tests__/supabase.test.ts:39-61`

**Issue:** The two tests that verify missing env vars throw an error use this pattern:

```ts
jest.isolateModules(() => {
  expect(() => require('../supabase')).toThrow('EXPO_PUBLIC_SUPABASE_URL');
});
```

`jest.isolateModules` accepts a callback and returns `void` — it does NOT return a Promise and the callback does NOT propagate exceptions to Jest. The `expect` inside the callback runs in an isolated scope, but if the assertion fails (or if `require` doesn't throw), the error is swallowed and the test body's `try/finally` around `jest.isolateModules` sees no exception. The test reports passing regardless of whether the assertion holds.

Additionally, inside the `isolateModules` callback, the mocks (`jest.mock('@supabase/supabase-js', ...)`) registered in the outer module scope are not automatically available. The isolated module registry starts fresh, so `require('../supabase')` inside the callback will attempt to load the real `@supabase/supabase-js` if it is not re-mocked inside the callback — which could cause a different failure path unrelated to the env var check.

These tests give a false green signal for a security-relevant invariant (crash on missing config).

**Fix:**

```ts
it('throws a clear error when EXPO_PUBLIC_SUPABASE_URL is missing', () => {
  const savedUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  try {
    let threw = false;
    let thrownMessage = '';
    jest.isolateModules(() => {
      jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
      jest.mock('react-native-url-polyfill/auto', () => ({}));
      jest.mock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {},
      }));
      try {
        require('../supabase');
      } catch (e: unknown) {
        threw = true;
        thrownMessage = e instanceof Error ? e.message : String(e);
      }
    });
    expect(threw).toBe(true);
    expect(thrownMessage).toContain('EXPO_PUBLIC_SUPABASE_URL');
  } finally {
    process.env.EXPO_PUBLIC_SUPABASE_URL = savedUrl;
  }
});
```

---

## Warnings

### WR-01: `20260519020000_fix_schema.sql` backfill uses `ST_MakePoint` without explicit SRID — geometry cast to geography with SRID 0

**File:** `supabase/migrations/20260519020000_fix_schema.sql:40`

**Issue:** The backfill line:
```sql
set gps_location = st_makepoint(gps_lon, gps_lat)::geography
```
`ST_MakePoint` creates a geometry with SRID 0 (unknown). Casting `geometry(SRID=0)` to `geography` does not silently assign SRID 4326 — it either errors (PostGIS 3.x strict mode) or stores a geography with wrong SRID. The column was added as `geography(Point, 4326)` which implies 4326 coordinates. The correct form is:
```sql
set gps_location = st_setsrid(st_makepoint(gps_lon, gps_lat), 4326)::geography
```
The migration comment notes the table is currently empty so this is a no-op, but the code is wrong and represents a latent data corruption bug if the migration is ever applied to a non-empty table or reused as a template.

---

### WR-02: `jest.config.js` coverage exclusion and `.coverage-thresholds.json` exclusion list are inconsistent

**File:** `app/jest.config.js:11` and `app/.coverage-thresholds.json:11-13`

**Issue:** `jest.config.js` excludes `src/app/**` (all screens) from coverage collection. `.coverage-thresholds.json` lists `src/app/**/_layout.tsx` as the only screen exclusion, implying other screen files are in scope. These two sources of truth disagree. `jest.config.js` is authoritative for actual test runs; `.coverage-thresholds.json` appears to be a documentation artifact. Any future agent reading `.coverage-thresholds.json` to understand coverage scope will get incorrect information and may incorrectly flag screens as uncovered or assume they are tested.

**Fix:** Align `.coverage-thresholds.json` exclusions to match `jest.config.js`:
```json
"exclusions": [
  "src/**/*.d.ts",
  "src/app/**"
]
```

---

### WR-03: `tsconfig.json` includes `jest` in global types — contaminates non-test code type environment

**File:** `app/tsconfig.json:6`

**Issue:** `"types": ["jest"]` injects Jest globals (`describe`, `it`, `expect`, `jest`, etc.) into every TypeScript file in the project, including production source files. This means production code can accidentally reference `jest.fn()` or `expect()` without a type error. Standard practice is to put jest types only in a test-specific tsconfig (e.g., `tsconfig.test.json`) or rely on `@types/jest` being auto-included in test files through the `setupFilesAfterFramework` / jest transform chain.

**Fix:** Remove `"types": ["jest"]` from the root `tsconfig.json` and create `app/tsconfig.test.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest"]
  },
  "include": ["src/**/__tests__/**", "src/**/*.test.ts", "src/**/*.test.tsx", "jest.setup.ts"]
}
```
Point `jest.config.js` at this tsconfig: add `"globals": { "ts-jest": { "tsconfig": "tsconfig.test.json" } }` if using ts-jest, or rely on jest-expo's default handling.

---

### WR-04: `index.tsx` smoke check runs unconditionally against the production Supabase project in dev mode, logging query error details

**File:** `app/src/app/(tabs)/index.tsx:8-19`

**Issue:** The `useEffect` fires on every mount when `__DEV__` is true, sending a live network query to the production Supabase project. Two problems:

1. `console.error('[smoke] supabase error:', error.message)` can log Supabase error messages, which may contain table names, auth context headers, or RLS-derived diagnostics — constituting a possible PII/schema leak in development logs per the project's "No PII in logs" constraint.
2. The smoke check queries production data on every dev app start. If this screen ever lives in a production build (e.g., if `__DEV__` is stripped but left to evaluate to `false`), the effect returns early safely, but the code path remains and could be accidentally activated.

The smoke check should be replaced with a dedicated test (`appConfigSmoke.test.ts` already covers the key list statically). If a live connectivity check is needed, it belongs in a `__tests__` file using `msw` to intercept, not in a render side-effect.

**Fix:** Remove the `useEffect` smoke block from `index.tsx` entirely. The static shape of `APP_CONFIG_SMOKE_KEYS` is already verified by `appConfigSmoke.test.ts`. Live DB connectivity is an integration concern for Phase 3.

---

## Info

### IN-01: `respect_signal_90d` view in `20260624000000_block_fixes.sql` returns `bigint` for `event_count` but `database.types.ts` declares it as `number | null`

**File:** `supabase/migrations/20260624000000_block_fixes.sql:63` and `app/src/lib/database.types.ts:643-644`

**Issue:** The view uses `count(*)::bigint as event_count`. The generated TypeScript type for the view's `event_count` column is `number | null`. JavaScript's `number` type cannot represent all `bigint` values (safe integer limit is 2^53-1). If this view ever returns event counts above ~9 quadrillion it would silently lose precision. This is a theoretical concern for now (bathroom locations will not get that many events), but the type annotation is technically wrong. It should be `string | null` (Supabase returns bigint as string) or the SQL cast should be `::int` instead.

Minor: the `total_weight` column also uses `sum(weight)::numeric` which Supabase returns as `string` but the type declares `number | null` — same class of issue.

This is informational because the app will not hit the overflow threshold, but it will produce type errors if strict numeric operations are applied to these columns.

---

_Reviewed: 2026-06-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
