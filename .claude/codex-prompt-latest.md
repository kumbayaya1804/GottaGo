# Codex Review Request — Gotta Go Phase 1 (Foundation & Scaffold)

**Generated:** 2026-06-24
**Scope:** Phase 1 complete — all source files, all migrations including BLOCK fix migration
**Prior reviews:** Antigravity BLOCK on Phase 1 retrospective (artifact at `.claude/antigravity-review-latest.md`) — those findings were addressed by `20260624000000_block_fixes.sql`, but the Antigravity artifact has NOT been updated post-fix. The current Antigravity artifact is outdated. A fresh Antigravity run on `20260624000000_block_fixes.sql` is pending.
**GSD Review:** A GSD code review (gsd-code-reviewer agent) completed on 2026-06-24 and found 5 critical issues, 4 warnings, 1 info. Full report at `.planning/phases/01-foundation-scaffold/01-REVIEW.md`.

---

## Your Role

You are Codex, senior implementation-quality reviewer and security auditor for Gotta Go. Your job is to protect production correctness, security, privacy, maintainability, and test discipline.

Read the `codex-prompt-latest.md` file before reviewing. Then inspect the actual source files from disk — this prompt is context, not a substitute for evidence.

Review in this priority order:
1. Security and privacy
2. Data integrity and database enforcement
3. Location/GPS correctness
4. Abuse resistance and shadowban behavior
5. Supabase/RLS correctness
6. User-visible correctness and failure states
7. Test coverage and verification quality
8. Maintainability, naming, and style

---

## Project Context

**Gotta Go** is a crowdsourced bathroom finder for people with real urgency: IBS/Crohn's/colitis sufferers, wheelchair users, parents with infants. Infrastructure for human dignity, not a casual directory.

Core system concerns:
- Supabase backend (project `ebmzhjmmtmldhrojkdqw`) with PostgreSQL, PostGIS, Auth, and RLS
- Bathroom/location discovery using geospatial search
- GPS-verified contributions from physically present users
- Trust and reputation weighting for reports and verification events
- Confidence decay when locations are not recently verified
- 90-day respect signal aggregate view
- Gamification through points, leaderboard, and verified contribution counts
- Shadowbanning for users and locations
- Privacy constraints around precise coordinates, identity, and behavior logs

**Tech stack:**
- Expo SDK 55 / React Native 0.83.6 / React 19
- Expo Router v4 — routes in `app/src/app/`
- Supabase JS v2
- `@rnmapbox/maps` npm package v10.3.1 wrapping native Mapbox SDK v11.20.1 (this is INTENTIONAL — rnmapbox/maps v10.x is the npm wrapper for native SDK v11; EAS build has already succeeded confirming compatibility)
- Jest 29.7.0 + jest-expo@55 (jest@30 incompatible with jest-expo@55 — pinned)

**Live table names:** `locations`, `users` (NOT `bathroom_locations`, `profiles`).

---

## Harness Contract

This project uses Claude as the primary coder, Antigravity as the architectural/data-integrity reviewer, and Codex as the implementation-quality/security reviewer. No commit is allowed without both reviewers returning APPROVE or all BLOCK/REQUEST CHANGES resolved.

Codex review output should be artifact-ready: save your verdict and findings to `.claude/codex-review-latest.md`.

---

## Schema Contract (summary — full detail in `docs/schema-contract.md`)

Key facts for this review:
- `shadowban_status` column is named `shadowban_status` (NOT `is_shadowbanned`) on both `users` and `locations`
- `users.trust_score` is `integer default 9` (NOT a decimal; Phase 5 must align trust calc)
- `users.trust_multiplier` is `numeric default 0.5` (NOT 1.0)
- `verification_events.gps_location` is `geography(Point,4326)` — was `gps_lat`/`gps_lon` numerics before migration 020000
- `availability_flags` public reads go through the `availability_flags_public` view (see CR-01 below)
- `ratings` public reads were supposed to go through `ratings_public` view (see CR-02 below)
- Reporter identity (`reporter_id` on `availability_flags`, `user_id` on `reports`) must NEVER be public

---

## Verdict Definitions

- **BLOCK**: Security vulnerability, privacy leak, data integrity risk, migration/RLS issue, production-breaking defect, abuse bypass. Must not merge.
- **REQUEST CHANGES**: Logic error, missing required test, incomplete error handling, significant maintainability risk. Fix before merge.
- **APPROVE**: Ready to merge with only non-blocking notes.

CRITICAL findings → BLOCK. MAJOR findings → REQUEST CHANGES (or BLOCK if security/data). MINOR → non-blocking unless accumulated.

---

## Verification Context

- `npm test` — all 4 tests pass (but CR-05 below shows two of them are false greens)
- `npm run typecheck` — passes
- No local Supabase running — `supabase db lint --local` cannot run
- EAS build succeeded (Android APK generated) — native Mapbox integration confirmed working

---

## GSD Code Review Findings (from `.planning/phases/01-foundation-scaffold/01-REVIEW.md`)

The GSD code reviewer found 10 issues. Your job is to independently validate, challenge, or extend these findings. Do not simply accept them — inspect the actual files.

### Critical (CR) — GSD Findings

**CR-01: `availability_flags_public` view shadowban filter is a no-op for anon callers**
File: `supabase/migrations/20260519030000_fix_rls.sql:58-66`
The migration comment claims this is a "security-definer view." But standard PostgreSQL `CREATE VIEW` is SECURITY INVOKER by default — RLS on underlying tables evaluates in the calling user's context (anon), not the view owner's. When anon queries the view, the `NOT EXISTS (SELECT 1 FROM users ...)` shadowban subquery runs under anon's RLS context, where `users_select_own` (`auth.uid() = id`) returns zero rows for anon (null uid). `NOT EXISTS` is therefore always TRUE — every shadowbanned reporter's flags pass through. The shadowban fix is broken.
Suggested fix: Replace the view with a SECURITY DEFINER function.

**CR-02: `ratings_public` view returns zero rows to anon**
File: `supabase/migrations/20260624000000_block_fixes.sql:42-52`
Same PostgreSQL view security issue: standard view, RLS evaluates as anon. The only SELECT policy on `ratings` is `ratings_select_own` (`auth.uid() = user_id`), which returns false for anon (null uid). The promised public aggregate read view is non-functional.
Suggested fix: Replace the view with a SECURITY DEFINER function.

**CR-03: `get_locations_in_radius` and `count_locations_within` silently exclude NULL `shadowban_status` locations**
File: `supabase/migrations/20260624000000_block_fixes.sql:98,153`
Both filter with `shadowban_status = false`. SQL: `NULL = false` → NULL → row excluded. If any location has `shadowban_status IS NULL`, it's silently invisible to all search. Schema has `DEFAULT false` but not `NOT NULL`. Safe fix: `(shadowban_status IS NULL OR shadowban_status = false)`.

**CR-04: Mapbox npm/native SDK version mismatch**
File: `app/package.json:19` and `app/app.config.ts:46`
The GSD reviewer flagged `@rnmapbox/maps: "^10.3.1"` (npm) vs `RNMapboxMapsVersion: '11.20.1'` (native SDK) as a version mismatch. **This is intentional**: `@rnmapbox/maps` npm package v10.x is the JavaScript wrapper for native Mapbox SDK v11. EAS build already succeeded and produced a working APK. Please confirm this independently and either validate the intentional versioning or challenge it with evidence.

**CR-05: `supabase.test.ts` env-var throw tests silently pass without verifying**
File: `app/src/lib/__tests__/supabase.test.ts:39-61`
`jest.isolateModules(() => { expect(() => require('../supabase')).toThrow(...) })` — `jest.isolateModules` returns `void` and swallows exceptions from the callback. If the assertion fails, the outer test still reports passing. Additionally, mocks from the outer scope are not re-applied inside the isolated registry, so `require('../supabase')` may fail for a different reason. These two tests give false-green signal for a security-relevant invariant.

### Warnings (WR) — GSD Findings

**WR-01**: `ST_MakePoint` in `fix_schema.sql:40` used without SRID — casts to geography with SRID 0. Should be `ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography`. Currently a no-op (table was empty) but latent data corruption bug.

**WR-02**: `jest.config.js` excludes `src/app/**` from coverage; `.coverage-thresholds.json` only excludes `src/app/**/_layout.tsx`. Two conflicting sources of truth.

**WR-03**: `"types": ["jest"]` in root `tsconfig.json` injects Jest globals into all production TypeScript files.

**WR-04**: `index.tsx` smoke check runs against live production Supabase on every dev mount and logs `error.message` (which may contain schema/auth diagnostics — potential PII/schema leak in dev logs).

### Info (IN) — GSD Findings

**IN-01**: `respect_signal_90d` view returns `bigint` for `event_count` but `database.types.ts` declares `number | null`. Supabase returns bigint as string, not number. Theoretical precision issue for very large counts.

---

## Antigravity Review Status

The `.claude/antigravity-review-latest.md` artifact contains the **original Phase 1 BLOCK review** (pre-fix). It is **outdated**. The BLOCK findings from that review were addressed by `20260624000000_block_fixes.sql`. A fresh Antigravity review on that migration has NOT been completed yet.

**Important context for Codex**: The previous Codex review (`codex-review-latest.md`) reviewed only `20260519030000_fix_rls.sql` v2 and returned APPROVE. That approval predates the GSD code reviewer's CR-01 finding about PostgreSQL view security semantics. Codex should re-evaluate CR-01 independently.

---

## Files to Review

Read these files from disk. Full contents are included below for the most security-critical ones.

### supabase/migrations/20260519020000_fix_schema.sql
```sql
-- Fix migration: schema corrections applied on top of remote baseline
--
-- 1. app_config: add description column, anon SELECT policy, D-01 threshold rows
-- 2. verification_events: replace gps_lat/gps_lon numeric with PostGIS geography column

-- ─── app_config fixes ─────────────────────────────────────────────────────────
alter table app_config add column description text;

create policy "app_config_select_anon"
  on app_config for select
  using (true);

insert into app_config (key, value, description) values
  ('max_accuracy_m',            '50',   'GPS accuracy threshold for submission and verification'),
  ('verify_radius_m',           '100',  'Physical presence window in meters for verification'),
  ('max_gps_age_s',             '60',   'Maximum age of GPS fix in seconds at time of submission'),
  ('decay_half_life_days',      '30',   'Confidence score half-life for exponential decay'),
  ('confidence_floor',          '0.05', 'Minimum confidence score — locations never decay to zero'),
  ('report_suppress_threshold', '4',    'Number of matching reports to auto-suppress a location');

-- ─── verification_events GPS fix ──────────────────────────────────────────────
alter table verification_events
  add column gps_location geography(Point, 4326);

update verification_events
  set gps_location = st_makepoint(gps_lon, gps_lat)::geography
  where gps_lat is not null and gps_lon is not null;

alter table verification_events
  drop column gps_lat,
  drop column gps_lon;

create index idx_verification_events_gps_location
  on verification_events using gist (gps_location);
```

### supabase/migrations/20260519030000_fix_rls.sql
```sql
-- Fix migration: RLS policy corrections
-- 1. users_update_own: drop
-- 2. locations_update_auth: drop
-- 3. reports_select_public: replace with own-row only
-- 4. availability_flags: security-definer view + revoke base table access

drop policy if exists "users_update_own" on users;
drop policy if exists "locations_update_auth" on locations;
drop policy if exists "reports_select_public" on reports;

create policy "reports_select_own"
  on reports for select
  using (auth.uid() = user_id);

drop policy if exists "availability_flags_select_public" on availability_flags;
drop policy if exists "availability_flags_select_active" on availability_flags;

create policy "availability_flags_select_active"
  on availability_flags for select
  using (expires_at > now());

drop view if exists availability_flags_public;

create view availability_flags_public as
  select f.id, f.location_id, f.type, f.created_at, f.expires_at
  from availability_flags f
  where f.expires_at > now()
    and not exists (
      select 1 from users u
      where u.id = f.reporter_id
        and u.shadowban_status = true
    );

comment on view availability_flags_public is
  'Public read path for active, non-shadowbanned availability flags. '
  'Excludes reporter_id. Security-definer so shadowban subquery has full users '
  'visibility independent of caller RLS. Client code must use this view.';

revoke select on availability_flags from anon;
revoke select on availability_flags from authenticated;

grant select on availability_flags_public to anon;
grant select on availability_flags_public to authenticated;
```

### supabase/migrations/20260624000000_block_fixes.sql
```sql
-- Block fixes: RLS security hardening + missing DB objects
-- Addresses Antigravity BLOCK verdict on Phase 1 retrospective review (2026-06-24).

-- ─── 1. locations: remove bypass-submissions insert policy ───────────────────
drop policy if exists "locations_insert_auth" on locations;

-- ─── 2. submissions: remove unconstrained self-update policy ─────────────────
drop policy if exists "submissions_update_own" on submissions;

-- ─── 3. ratings: remove rater identity exposure ──────────────────────────────
drop policy if exists "ratings_select_public" on ratings;

create policy "ratings_select_own"
  on ratings for select
  using (auth.uid() = user_id);

revoke select on ratings from anon;

drop view if exists ratings_public;

create view ratings_public as
  select id, location_id, cleanliness, accessibility, convenience,
         review_text, created_at, updated_at
  from ratings;

comment on view ratings_public is
  'Public read path for ratings. Excludes user_id to prevent rater identity exposure. '
  'Use for aggregate/display queries; use base table with RLS for own-row reads/mutations.';

grant select on ratings_public to anon;
grant select on ratings_public to authenticated;

-- ─── 4. respect_signal_90d view ──────────────────────────────────────────────
create or replace view respect_signal_90d as
  select
    location_id,
    sum(weight)::numeric as total_weight,
    count(*)::bigint     as event_count
  from respect_signal_log
  where "timestamp" > now() - interval '90 days'
  group by location_id;

grant select on respect_signal_90d to anon;
grant select on respect_signal_90d to authenticated;

-- ─── 5. get_locations_in_radius SECURITY DEFINER function ────────────────────
create or replace function get_locations_in_radius(
  user_lat              numeric,
  user_lng              numeric,
  radius_m              numeric  default 5000,
  filter_open_now       boolean  default false,
  filter_chill_spot     boolean  default false,
  filter_wheelchair     boolean  default false,
  filter_changing       boolean  default false,
  filter_no_purchase    boolean  default false,
  filter_gender_neutral boolean  default false,
  filter_high_conf      boolean  default false
)
returns setof locations
language sql
security definer
stable
set search_path = public
as $$
  select l.*
  from locations l
  where l.deleted_at is null
    and l.shadowban_status = false
    and st_dwithin(
          l.coordinates::geography,
          st_point(user_lng, user_lat)::geography,
          radius_m
        )
    and (not filter_open_now     or l.is_open_now = true)
    and (not filter_chill_spot   or l.chill_spot = true)
    and (not filter_wheelchair   or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'accessibility' and t.value = 'wheelchair'
         ))
    and (not filter_changing     or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'amenity' and t.value = 'changing_table'
         ))
    and (not filter_no_purchase  or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'purchase_required' and t.value = 'false'
         ))
    and (not filter_gender_neutral or exists (
           select 1 from tags t
           where t.location_id = l.id
             and t.key = 'gender' and t.value = 'neutral'
         ))
    and (not filter_high_conf    or l.confidence_tier = 'High')
  order by l.coordinates::geography <-> st_point(user_lng, user_lat)::geography;
$$;

grant execute on function get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to anon;
grant execute on function get_locations_in_radius(
  numeric, numeric, numeric, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

-- ─── 6. count_locations_within SECURITY DEFINER function ─────────────────────
create or replace function count_locations_within(
  p_lat      numeric,
  p_lon      numeric,
  p_radius_m numeric default 5000
)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)
  from locations
  where deleted_at is null
    and shadowban_status = false
    and st_dwithin(
          coordinates::geography,
          st_point(p_lon, p_lat)::geography,
          p_radius_m
        );
$$;

grant execute on function count_locations_within(numeric, numeric, numeric) to anon;
grant execute on function count_locations_within(numeric, numeric, numeric) to authenticated;
```

### app/src/lib/supabase.ts
```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### app/src/lib/__tests__/supabase.test.ts
```ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

import '../supabase';

describe('supabase client', () => {
  it('initializes with detectSessionInUrl: false', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.detectSessionInUrl).toBe(false);
  });

  it('initializes with AsyncStorage as auth storage', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.storage).toBe(AsyncStorage);
  });

  it('initializes with autoRefreshToken: true', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.autoRefreshToken).toBe(true);
  });

  it('initializes with persistSession: true', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.persistSession).toBe(true);
  });

  it('throws a clear error when EXPO_PUBLIC_SUPABASE_URL is missing', () => {
    const savedUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    try {
      jest.isolateModules(() => {
        expect(() => require('../supabase')).toThrow('EXPO_PUBLIC_SUPABASE_URL');
      });
    } finally {
      process.env.EXPO_PUBLIC_SUPABASE_URL = savedUrl;
    }
  });

  it('throws a clear error when EXPO_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    const savedKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    try {
      jest.isolateModules(() => {
        expect(() => require('../supabase')).toThrow('EXPO_PUBLIC_SUPABASE_ANON_KEY');
      });
    } finally {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = savedKey;
    }
  });
});
```

### app/src/app/(tabs)/index.tsx
```tsx
import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { supabase } from '@/lib/supabase';
import { APP_CONFIG_SMOKE_KEYS } from '@/lib/appConfigSmoke';

export default function MapScreen() {
  useEffect(() => {
    if (!__DEV__) return;
    supabase
      .from('app_config')
      .select('key, value')
      .in('key', APP_CONFIG_SMOKE_KEYS)
      .then(({ data, error }) => {
        if (error) {
          console.error('[smoke] supabase error:', error.message);
        } else {
          console.log('[smoke] app_config rows:', data?.length ?? 0);
        }
      });
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Map (Phase 3)</Text>
    </View>
  );
}
```

### app/package.json (relevant excerpt)
```json
{
  "dependencies": {
    "@rnmapbox/maps": "^10.3.1",
    "expo": "~55.0.26",
    "jest": "^29.7.0"
  }
}
```

### app/app.config.ts (Mapbox plugin config)
```ts
plugins: [
  '@rnmapbox/maps',
  {
    RNMapboxMapsVersion: '11.20.1',
    RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN ?? '',
    RNMapboxMapsImpl: 'mapbox',
  },
]
```

**All other Phase 1 source files are placeholders/scaffolds. Inspect from disk:**
- `app/src/app/_layout.tsx` — root layout (plain View + Slot, no gesture handler yet)
- `app/src/app/(auth)/_layout.tsx`, `sign-in.tsx`, `sign-up.tsx` — auth scaffolds, no logic
- `app/src/app/(tabs)/_layout.tsx`, `profile.tsx` — tab scaffolds
- `app/src/app/location/[id].tsx` — placeholder
- `app/src/lib/appConfigSmoke.ts` and `__tests__/appConfigSmoke.test.ts` — key list and static test
- `app/tsconfig.json`, `jest.config.js`, `jest.setup.ts`, `eslint.config.js`, `eas.json`

---

## Key Open Questions for Codex

1. **CR-01/CR-02 (PostgreSQL view security):** Do you agree that standard PostgreSQL views (`CREATE VIEW` without `SECURITY DEFINER` or `SECURITY INVOKER` annotation) evaluate RLS policies using the calling user's identity, NOT the view owner's? If the view is owned by `postgres` (Supabase superuser), does that mean the `users` table lookup in the `availability_flags_public` shadowban subquery still evaluates under the anon caller's RLS context — making the shadowban filter a no-op?

2. **CR-04 (Mapbox versioning):** Please verify independently: does `@rnmapbox/maps` npm package v10.x wrap native Mapbox SDK v11? The EAS build succeeded and produced a working APK. Is the `@rnmapbox/maps` v10.x + `RNMapboxMapsVersion: '11.20.1'` combination correct per the rnmapbox/maps documentation?

3. **CR-05 (jest.isolateModules):** Do you confirm that exceptions thrown inside a `jest.isolateModules()` callback are swallowed and do not propagate to the outer test body? Are there alternative test patterns that correctly verify module-load-time throws?

4. **Antigravity review gap:** `20260624000000_block_fixes.sql` has never been reviewed by Antigravity. Should Phase 2 be blocked until Antigravity reviews it?

---

## Your Task

1. Read `.claude/codex-prompt-latest.md` (this file) — done.
2. Inspect the actual source files from disk.
3. Validate or challenge the GSD code review findings, especially CR-01, CR-02, and CR-04.
4. Add any findings the GSD reviewer missed.
5. Return your verdict in the Codex review format:

```md
## Codex Review - Phase 1 Foundation & Scaffold (Complete)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results, or why verification was not run.

### Approved
- What is correct or ready to merge.
```

Copy your verdict to `.claude/codex-review-latest.md`.
