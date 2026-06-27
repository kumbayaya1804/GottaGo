# Phase 1: Foundation & Scaffold - Research

**Researched:** 2026-05-19
**Domain:** Supabase schema verification, Expo dev client scaffold, TypeScript type generation
**Confidence:** HIGH — schema is live, all packages are installed, codebase is inspected directly

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**app_config Thresholds** — All values seed in a migration, admin-editable via Supabase Studio without
redeployment. Anon role can SELECT. Only service role can UPDATE/DELETE.

| Key | Value |
|-----|-------|
| `max_accuracy_m` | 50 |
| `verify_radius_m` | 100 |
| `max_gps_age_s` | 60 |
| `decay_half_life_days` | 30 |
| `confidence_floor` | 0.05 |
| `report_suppress_threshold` | 4 |

**Supabase Environment** — Live project exists. Link via `supabase link --project-ref <ref>` then
`supabase db push`. Migration files are source of truth. Never apply schema changes via Studio SQL
editor. Env vars: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
(gitignored). TypeScript types generated from live remote schema immediately after migrations push.
`src/lib/supabase.ts` uses `createClient<Database>(...)` with the Database generic from day one.

**EAS + Mapbox Token Strategy** — Mapbox secret download token (`sk.*`) stored as EAS secret
(`MAPBOX_DOWNLOAD_TOKEN`). Public access token (`pk.*`) in `EXPO_PUBLIC_MAPBOX_TOKEN`. Google Maps
API key for geocoding/Places REST only. Dev client build gated to final step in Phase 1, after tokens
and EAS account configured. `eas build --profile development --platform android` first.

**Map Rendering** — `@rnmapbox/maps` only. `react-native-maps` Google provider is broken on Expo SDK
55 iOS (expo/expo#43288). Decision confirmed.

**App Directory Structure** — Reorganize from template `app/app/(tabs)/` to:
```
app/src/app/
  _layout.tsx              # root: providers
  (auth)/
    _layout.tsx            # redirect to (tabs) if session exists
    sign-in.tsx            # placeholder
    sign-up.tsx            # placeholder
  (tabs)/
    _layout.tsx            # protected: redirect to sign-in if no session
    index.tsx              # map (placeholder)
    profile.tsx            # placeholder
  location/
    [id].tsx               # location detail (placeholder)
  +not-found.tsx
```
Source files live under `app/src/` not `app/app/`. `src/lib/` created with `supabase.ts` and
`database.types.ts`. All placeholder screens render minimal `<View><Text>` only.

### Claude's Discretion

None documented in CONTEXT.md for Phase 1 (all decisions are locked).

### Deferred Ideas (OUT OF SCOPE)

- **Launch availability decision:** Resolved after Phase 1.5 planning. The app should be available globally for proof of concept; marketing, promotion, owned social media handles, partnerships, and community campaigns drive local density.
- **Apple Sign-In full implementation:** Stubbed in Phase 2, fully implemented in Phase 9.
</user_constraints>

---

## Summary

Phase 1 is a verification and wiring phase, not a greenfield build. The Supabase schema (8 migrations,
all 8 confirmed to exist on disk) and the Expo dependency scaffold were completed before GSD was
formalized. The remaining work is: (1) add the `app_config` table migration, (2) verify PostGIS GIST
index and RLS lint, (3) link the Supabase project and push migrations, (4) wire the typed Supabase
client (`src/lib/supabase.ts`), (5) generate TypeScript types from the live schema, (6) restructure
the Expo app directory from the template layout to the canonical `src/app/` layout, and (7) build an
EAS dev client and smoke-test the Mapbox + Supabase connection.

The current `app/app/` directory still contains the create-expo-app template output (`(tabs)/index.tsx`,
`(tabs)/two.tsx`, `modal.tsx`). No `src/` directory exists yet. The jest.config.js has a latent bug
(`setupFilesAfterFramework` should be `setupFilesAfterEnv`) that will silently prevent the mocks in
`jest.setup.ts` from loading — this must be fixed before any test-driven work in Phase 1 or later
phases.

The EAS CLI is not currently installed (`eas` command not found in PATH). It must be installed globally
before the dev client build step. The Supabase CLI is installed at version 2.100.1.

**Primary recommendation:** Plan 01-01 covers DB work (app_config migration, index verification, RLS
lint, project link, migrations push, type generation). Plan 01-02 covers Expo restructure (canonical
directory layout, `src/lib/supabase.ts`, jest.config fix) and the EAS dev client build smoke test.
Each plan is independently committable and reviewable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| app_config table + seed | Database (Postgres) | — | Pure schema/data — no client involvement |
| PostGIS GIST index | Database (Postgres) | — | Index lives in Postgres; verified via CLI |
| RLS lint | Database (Postgres) | Supabase CLI | `supabase db lint` runs against the remote project |
| TypeScript type generation | Supabase CLI | Repo (committed file) | CLI reads live schema, outputs `.ts` file to `src/lib/` |
| Supabase client setup | Client (Expo) | — | `src/lib/supabase.ts` is the client's entry point to Postgres |
| Expo Router directory structure | Client (Expo) | — | File-based routing owned by client tier |
| EAS dev client build | EAS Build (CI/cloud) | — | Native build runs on Expo's build infrastructure |
| Placeholder screens | Client (Expo) | — | Routing scaffolding only |

---

## Standard Stack

All packages are already installed in `app/package.json`. No new installations are needed in Phase 1.
The plan should reference installed versions, not install new packages.

### Already Installed (confirmed via package.json inspection)

| Library | Installed Version | Purpose |
|---------|------------------|---------|
| `expo` | ~55.0.25 | SDK + build system |
| `expo-router` | ~55.0.15 | File-based navigation |
| `@supabase/supabase-js` | ^2.106.0 | DB + auth client |
| `@react-native-async-storage/async-storage` | ^3.0.3 | Supabase auth storage |
| `react-native-url-polyfill` | ^3.0.0 | Required by Supabase JS on RN |
| `@rnmapbox/maps` | ^10.3.1 | Map rendering |
| `react-native-turbo-mock-location-detector` | ^2.3.1 | GPS mock detection |
| `react-native-mmkv` | ^4.3.1 | Fast local storage for Zustand persist |
| `zustand` | ^5.0.13 | Client state management |
| `@tanstack/react-query` | ^5.100.11 | Server state + caching |
| `react-hook-form` | ^7.76.0 | Form state |
| `zod` | ^4.4.3 | Schema validation |
| `jest-expo` | ^55.0.18 | Test runner preset |
| `@testing-library/react-native` | ^13.3.3 | Component testing |
| `@testing-library/jest-native` | ^5.4.3 | Jest matchers |
| `msw` | ^2.14.6 | Network mocking |
| `typescript` | ~5.9.2 | Type checking |

**Note on version divergence:** `@testing-library/react-native` is at `^13.3.3` but STACK.md recommends
`^14.x`. This is acceptable for Phase 1 — the test infrastructure is pre-scaffolded and functional. Do
not upgrade versions mid-phase; flag for Phase 9 dependency audit.

**Note on STACK.md version recommendations vs. installed:** Package versions installed are newer than
STACK.md recommendations in several cases (e.g., `zod` ^4.4.3 vs ^3.x, `react-native-mmkv` ^4.3.1 vs
^3.x). The installed versions take precedence — they were installed deliberately with `npm install`.
[VERIFIED: npm registry — versions confirmed via `npm view`]

### CLI Tools

| Tool | Available | Version | Install Command |
|------|-----------|---------|-----------------|
| `supabase` | Yes | 2.100.1 | Already installed |
| `eas` | **No** | — | `npm install -g eas-cli` (latest: 19.0.1) |
| `node` | Yes | 24.15.0 | Already installed |
| `npm` | Yes | 11.14.1 | Already installed |

`eas-cli` must be installed before Plan 01-02's dev client build step.
[VERIFIED: npm registry — eas-cli 19.0.1 confirmed via `npm view eas-cli version`]

---

## Package Legitimacy Audit

> slopcheck was installed but incorrectly checked PyPI instead of npm for these Node.js packages —
> a documented cross-ecosystem confusion vector. All packages below were verified via `npm view`
> against the npm registry and inspected for suspicious postinstall scripts. No postinstall scripts
> were found on any of the checked packages.

| Package | Registry | Installed Version | Latest npm | Source Repo | Postinstall | Disposition |
|---------|----------|------------------|-----------|-------------|-------------|-------------|
| `@supabase/supabase-js` | npm | 2.106.0 | 2.106.0 | github.com/supabase/supabase-js | none | Approved |
| `@rnmapbox/maps` | npm | 10.3.1 | 10.3.1 | github.com/rnmapbox/maps | none | Approved |
| `expo` | npm | 55.0.25 | 55.0.25 | github.com/expo/expo | none | Approved |
| `react-native-mmkv` | npm | 4.3.1 | 4.3.1 | github.com/mrousavy/react-native-mmkv | none | Approved |
| `react-native-url-polyfill` | npm | 3.0.0 | 3.0.0 | github.com/charpeni/react-native-url-polyfill | none | Approved |
| `react-native-turbo-mock-location-detector` | npm | 2.3.1 | 2.3.1 | github.com/jpudysz/react-native-turbo-mock-location-detector | none | Approved |
| `zustand` | npm | 5.0.13 | 5.0.13 | github.com/pmndrs/zustand | none | Approved |
| `@tanstack/react-query` | npm | 5.100.11 | 5.100.11 | github.com/TanStack/query | none | Approved |
| `eas-cli` (to install) | npm | — | 19.0.1 | github.com/expo/eas-cli | [ASSUMED] | Approved — official Expo tool |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck ran against wrong registry)
**Packages flagged as suspicious [SUS]:** none

*slopcheck cross-ecosystem note: slopcheck checked PyPI for npm packages and flagged them as SLOP.
This is a known false-positive scenario documented in the Package Legitimacy Gate protocol. All
packages were independently verified on the npm registry via `npm view`.*

---

## Architecture Patterns

### System Architecture Diagram

```
User opens app (Expo dev client)
        |
        v
app/src/app/_layout.tsx          <- root layout: providers (future: QueryClient, SessionProvider)
        |
        +-- (auth)/              <- unauthenticated group (Phase 2: real auth; Phase 1: placeholder)
        |     sign-in.tsx
        |     sign-up.tsx
        |
        +-- (tabs)/              <- authenticated group (Phase 1: placeholder screens)
        |     index.tsx          <- map placeholder
        |     profile.tsx        <- profile placeholder
        |
        +-- location/[id].tsx    <- location detail placeholder
        |
        +-- +not-found.tsx
        |
        v
src/lib/supabase.ts              <- typed Supabase client (createClient<Database>)
        |
        v
Supabase remote project          <- live Postgres + PostGIS + Auth
        |
        +-- bathroom_locations   <- GIST index on geography(Point, 4326)
        +-- profiles             <- auto-created on signup
        +-- verification_events
        +-- availability_flags
        +-- reports
        +-- trust_events
        +-- respect_signal_90d   <- materialized view
        +-- app_config           <- NEW in Phase 1: tunable thresholds
```

**Data flow for Phase 1 smoke test:**
```
EAS dev client launch
  -> Mapbox MapView renders (confirms @rnmapbox/maps config plugin wired correctly)
  -> supabase.from('app_config').select() returns rows (confirms Supabase connection live)
  -> TypeScript compiler finds no errors in src/lib/database.types.ts (confirms generated types valid)
```

### Recommended Project Structure (end state of Phase 1)

```
app/
  app.json                        # already configured: @rnmapbox/maps plugin, expo-secure-store, expo-image
  package.json                    # all deps installed
  tsconfig.json                   # paths: "@/*": ["./*"] — NOTE: needs update when src/ added
  jest.config.js                  # NEEDS FIX: setupFilesAfterFramework -> setupFilesAfterEnv
  jest.setup.ts                   # mocks ready: Mapbox, expo-location, MMKV, turbo-mock-detector
  src/
    app/                          # Expo Router entry (replaces app/app/)
      _layout.tsx                 # root providers
      (auth)/
        _layout.tsx
        sign-in.tsx               # placeholder
        sign-up.tsx               # placeholder
      (tabs)/
        _layout.tsx               # protected layout
        index.tsx                 # map placeholder
        profile.tsx               # profile placeholder
      location/
        [id].tsx                  # detail placeholder
      +not-found.tsx
    lib/
      supabase.ts                 # typed createClient<Database>
      database.types.ts           # generated from live schema
  assets/                         # already exists
  constants/                      # already exists
  components/                     # already exists (template; kept for now)

supabase/
  config.toml                     # project_id = "Gotta_Go", major_version = 17
  migrations/
    20260519000001_extensions.sql
    20260519000002_profiles.sql
    20260519000003_bathroom_locations.sql
    20260519000004_verification_events.sql
    20260519000005_availability_flags.sql
    20260519000006_reports.sql
    20260519000007_trust_events.sql
    20260519000008_respect_signal_90d.sql
    20260519000009_app_config.sql   # NEW in Plan 01-01
  seed.sql                        # does NOT exist yet — config.toml references it; must create or disable
```

### Pattern 1: app_config Migration (new migration for Phase 1)

**What:** A 9th migration creates the `app_config` table with the locked threshold values and correct
RLS policies (anon can SELECT, service role only for UPDATE/DELETE).

**Why migration not Studio:** schema-contract.md and CONTEXT.md are explicit — migration files are the
source of truth. Never apply schema changes via Studio SQL editor.

```sql
-- Source: CONTEXT.md ## Decisions (locked values)
-- File: supabase/migrations/20260519000009_app_config.sql

create table app_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;

-- Anon can read (client uses verify_radius_m for UX feedback)
create policy "app_config_select_anon"
  on app_config for select
  using (true);

-- Service role only for writes (enforced by no insert/update policy for authenticated)
-- (service_role bypasses RLS by default)

insert into app_config (key, value, description) values
  ('max_accuracy_m',          '50',   'GPS accuracy threshold for submission and verification'),
  ('verify_radius_m',         '100',  'Physical presence window in meters for verification'),
  ('max_gps_age_s',           '60',   'Maximum age of GPS fix in seconds at time of submission'),
  ('decay_half_life_days',    '30',   'Confidence score half-life for exponential decay'),
  ('confidence_floor',        '0.05', 'Minimum confidence score — locations never decay to zero'),
  ('report_suppress_threshold','4',   'Number of matching reports to auto-suppress a location');
```

### Pattern 2: Typed Supabase Client (src/lib/supabase.ts)

**What:** The client is initialized once, typed with the generated `Database` interface, using
AsyncStorage for auth persistence. This is the exact pattern from STACK.md and CONTEXT.md.

**Critical:** `react-native-url-polyfill/auto` must be the FIRST import.

```typescript
// Source: STACK.md ## 4. Backend Client
// File: app/src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // browser-only feature — required false for RN
  },
});
```

### Pattern 3: Expo Router Canonical Directory Structure

**What:** Expo Router reads routes from whichever directory is configured as the `main` entry in
`package.json` (currently `expo-router/entry`) and the `expo.entryPoint` or `expo.scheme` in
`app.json`. The current template output lives at `app/app/`. The canonical target is `app/src/app/`.

**How Expo Router locates the app directory:** Expo Router v6 defaults to looking for the `app`
directory relative to the project root. To point it at `src/app/`, the `expo.experiments.typedRoutes`
is already enabled (confirmed in `app.json`). The `main` field in `package.json` is `expo-router/entry`
which is correct. To move the routes directory from `app/app/` to `app/src/app/`, set:

```json
// app/app.json — add to expo object
"entryPoint": "src/app"
```
[ASSUMED — Expo Router v6 `entryPoint` field name needs verification against
https://docs.expo.dev/versions/v55.0.0/ before using. The alternative is keeping the `app/` directory
but placing `src/` as a sibling for lib/stores/hooks.]

**Alternative (safer, requires no config change):** Keep Expo Router routes at `app/app/src/app/` is
not standard. The cleanest approach consistent with CONTEXT.md is to move the Expo Router directory
by updating `app.json` with the correct field. The planner should verify the exact `app.json` field
name before implementing.

### Pattern 4: Expo Router Placeholder Screen

**What:** All placeholder screens render only `<View><Text>` with no real logic. This satisfies the
CONTEXT.md requirement ("no real UI, just routing structure") and ensures the EAS dev client can
navigate the route tree without crashing.

```typescript
// Source: CONTEXT.md ## App Directory Structure
import { View, Text } from 'react-native';

export default function SignInScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Sign In (Phase 2)</Text>
    </View>
  );
}
```

### Pattern 5: TypeScript Type Generation

**What:** After `supabase db push` succeeds, types are generated from the live schema and committed.
The `--project-id` flag points at the remote project ref ID (provided by user as prerequisite).

```bash
# Run from repo root (supabase CLI operates at repo level)
supabase gen types typescript --project-id <ref> --schema public \
  > app/src/lib/database.types.ts
```

**If project ref not yet provided:** Generate a placeholder `database.types.ts` that exports an empty
`Database` type so `createClient<Database>` compiles. Replace with the real generated file once `supabase
link` is complete.

```typescript
// app/src/lib/database.types.ts (placeholder — replaced after supabase link)
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
```

### Anti-Patterns to Avoid

- **Putting Mapbox token in app.json source:** The `RNMapboxMapsDownloadToken` in `app.json` should
  reference an environment variable or be left as a placeholder. The real `sk.*` token comes from the
  EAS secret `MAPBOX_DOWNLOAD_TOKEN` at build time. Committing a real `sk.*` token to git is a
  credential leak.
- **Using `app/app/` as the source file directory:** Template files (`modal.tsx`, `(tabs)/two.tsx`,
  `EditScreenInfo.tsx`, `Themed.tsx`) are scaffolding noise that conflicts with the canonical
  structure. They must be removed or replaced, not left alongside the new structure.
- **Calling `supabase.auth.getSession()` in screen useEffect:** Phase 1 roots will use a simple
  placeholder `_layout.tsx`. Do NOT introduce any per-screen session calls even in placeholder
  form — establish the `onAuthStateChange` subscription pattern from day one (Phase 2 will expand it).
- **Skipping the URL polyfill:** `react-native-url-polyfill/auto` must be imported before any
  Supabase client initialization. Without it, Supabase throws `URL is not a constructor` on Android.
- **Applying schema changes via Studio SQL editor:** All schema changes must go through the migration
  file at `supabase/migrations/`. The seed.sql referenced in `config.toml` does not exist yet — the
  plan must either create it (empty) or disable it in `config.toml` to prevent `supabase db push`
  errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript types for Postgres tables | Manual interface definitions | `supabase gen types typescript` | Manual types drift from schema; generated types are authoritative and free |
| Supabase connection/auth plumbing | Custom fetch wrappers | `@supabase/supabase-js` createClient | SDK handles auth refresh, JWT rotation, session persistence atomically |
| Mapbox config plugin wiring | Custom native module configuration | `@rnmapbox/maps` config plugin in `app.json` | Config plugin handles iOS/Android native setup; hand-rolling breaks on EAS Build |
| Route-level auth protection | Custom HOC or middleware | Expo Router `<Redirect>` in group layouts | Built-in primitive; hand-rolled guards can introduce flash-of-unauthenticated-content |

**Key insight:** Phase 1 is almost entirely "wire up what exists" rather than "write new logic." The
value is in connecting the pieces correctly (Supabase linked, types generated, client typed, app builds)
not in writing application code.

---

## Common Pitfalls

### Pitfall 1: seed.sql Missing

**What goes wrong:** `supabase db push` or `supabase db reset` fails with an error about
`./seed.sql` not being found.

**Why it happens:** `config.toml` has `[db.seed] enabled = true` and `sql_paths = ["./seed.sql"]`
but the file does not exist on disk (confirmed by inspection).

**How to avoid:** Create an empty `supabase/seed.sql` (a SQL comment is enough) as the first task
in Plan 01-01, before any push or reset commands.

**Warning signs:** Any `supabase db push` command that exits with a file-not-found error.

### Pitfall 2: jest.config.js Key Typo

**What goes wrong:** `jest.setup.ts` mocks (Mapbox, expo-location, MMKV, turbo-mock-detector) never
load. Tests that depend on these mocks fail silently or with confusing errors.

**Why it happens:** `jest.config.js` uses `setupFilesAfterFramework` but the correct Jest config key
is `setupFilesAfterEnv`. Jest silently ignores unrecognized keys without warning.

**How to avoid:** Fix the key in `jest.config.js` as an early task in Plan 01-02 (before any test
runs). The fix is a one-line change: `setupFilesAfterFramework` → `setupFilesAfterEnv`.

**Warning signs:** Running `jest` produces no mock-related failures even when modules like
`@rnmapbox/maps` are imported — the mocks loaded correctly ONLY if `setupFilesAfterEnv` is correct.

### Pitfall 3: Mapbox Token Not Configured for EAS Build

**What goes wrong:** EAS build fails at the Mapbox native SDK download step with an authentication
error, because the config plugin passes an empty/placeholder download token.

**Why it happens:** `app.json` has `@rnmapbox/maps` in `plugins` but no `RNMapboxMapsDownloadToken`
value. The EAS build needs the `sk.*` secret token to download the Mapbox iOS/Android SDK from
Mapbox's private Maven/CocoaPods registry.

**How to avoid:** The plan must include a prerequisite step for the user to:
1. Create Mapbox account at mapbox.com
2. Generate a secret download token (`sk.*`, scope `Downloads:Read`)
3. Store it as an EAS secret: `eas secret:create --name MAPBOX_DOWNLOAD_TOKEN --value sk.xxx`
4. Reference it in `app.json` plugin config via `process.env.MAPBOX_DOWNLOAD_TOKEN` (or via
   `app.config.ts` if converting from static JSON)

**Warning signs:** EAS build logs show 401/403 errors when downloading CocoaPods or Gradle
dependencies for rnmapbox.

### Pitfall 4: app.json Plugin Config Requires app.config.ts for Dynamic Values

**What goes wrong:** Environment variables cannot be referenced in `app.json` (static JSON). The
Mapbox plugin needs the download token at build time from an EAS secret. Using `app.json` directly
means hardcoding the token (credential leak).

**Why it happens:** `app.json` is static JSON. EAS secrets are available as environment variables
during EAS Build, but only accessible in `app.config.ts` (dynamic config) via `process.env`.

**How to avoid:** Convert `app.json` → `app.config.ts` to enable dynamic plugin configuration:

```typescript
// app/app.config.ts
import { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Gotta Go',
  slug: 'gotta-go',
  // ... other fields from app.json ...
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-image',
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsVersion: '11.x',
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN ?? '',
        RNMapboxMapsImpl: 'mapbox',
      },
    ],
  ],
};
export default config;
```

[ASSUMED — The exact `RNMapboxMapsVersion` value to use with `@rnmapbox/maps` ^10.3.1 needs
verification against https://rnmapbox.github.io/docs/install before the plan commits to it.]

**Warning signs:** Building with a real token in `app.json` that is then committed to git.

### Pitfall 5: Expo Router Source Directory Configuration

**What goes wrong:** Moving routes from `app/app/` to `app/src/app/` breaks the Expo Router lookup
if the configuration field is wrong or omitted.

**Why it happens:** Expo Router v6 requires the routes directory to be discoverable. Without the
correct `app.json`/`app.config.ts` field, it will continue looking at `app/` relative to project
root, finding nothing, and crashing.

**How to avoid:** The AGENTS.md in `app/` says "Read the exact versioned docs at
https://docs.expo.dev/versions/v55.0.0/ before writing any code." The planner must include a
task to verify the exact Expo Router v6 field for specifying the routes directory before
implementing the directory restructure.

[ASSUMED — Expo Router v6 directory configuration field name is not verified in this research
session. Marked for verification against versioned docs before implementation.]

**Warning signs:** Metro bundler fails with "No routes found" or app launches to a blank screen
after the directory move.

### Pitfall 6: supabase db lint Scope

**What goes wrong:** `supabase db lint` is run against the local development stack instead of
the remote project, giving false comfort about RLS completeness.

**Why it happens:** `supabase db lint` without `--linked` runs against the local Supabase Docker
stack. The live remote project may have drifted if any changes were applied via Studio.

**How to avoid:** Run `supabase db lint --linked` after `supabase link` to lint against the remote
project. Also run `supabase db reset` locally to verify migrations apply cleanly in sequence.

### Pitfall 7: tsconfig.json Path Alias Needs Update

**What goes wrong:** After creating `src/app/`, the `@/*` path alias in `tsconfig.json` still
resolves to `app/` (the project root), not `app/src/`. Any import like `import { X } from '@/lib/...'`
will fail to resolve.

**Why it happens:** The existing `tsconfig.json` has `"paths": { "@/*": ["./*"] }` which maps
to the `app/` directory root. After adding `src/`, imports from `src/app/` code need
`@/lib/supabase` to resolve to `src/lib/supabase`, not `lib/supabase` at the project root.

**How to avoid:** Update `tsconfig.json` paths when creating the `src/` directory structure:
```json
"paths": {
  "@/*": ["./src/*"]
}
```

---

## Code Examples

### Verify GIST Index Exists (SQL)

```sql
-- Source: supabase/migrations/20260519000003_bathroom_locations.sql (already in migrations)
-- This index should already exist after migrations are applied:
-- create index bathroom_locations_location_idx
--   on bathroom_locations using gist (location);

-- Verification query to run after push:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'bathroom_locations'
  AND indexdef ILIKE '%gist%';
-- Expected: returns row with bathroom_locations_location_idx
```

### Verify RLS Enabled on All Tables

```sql
-- Run against remote or local after migrations apply
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'bathroom_locations', 'verification_events',
    'availability_flags', 'reports', 'trust_events', 'app_config'
  );
-- Expected: all rows have rowsecurity = true
```

### Smoke Test Supabase Connection (inline in placeholder screen)

```typescript
// Temporary — add to (tabs)/index.tsx placeholder to confirm connection in dev client
// Remove before Phase 2 (screen gets real content then)
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

useEffect(() => {
  supabase
    .from('app_config')
    .select('key, value')
    .then(({ data, error }) => {
      if (error) console.error('[smoke] supabase error:', error.message);
      else console.log('[smoke] app_config rows:', data?.length);
    });
}, []);
```

### EAS Commands (run from app/ directory)

```bash
# Install EAS CLI (run from anywhere)
npm install -g eas-cli

# Log in and initialize (run from app/)
eas login
eas init

# Create EAS secrets (run from app/)
eas secret:create --name MAPBOX_DOWNLOAD_TOKEN --value "sk.xxx"
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxx.supabase.co"
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."

# Build dev client — Android first (faster)
eas build --profile development --platform android

# iOS build (requires Apple Developer enrollment for real device; simulator OK without)
eas build --profile development --platform ios
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 1 |
|---|---|---|
| `app.json` static config for all Expo config | `app.config.ts` dynamic config for env-var injection | Phase 1 needs conversion for Mapbox token; otherwise token must be hardcoded |
| Expo Go for development | EAS dev client (mandatory for Mapbox) | Already understood — plan must build dev client, not test in Expo Go |
| `supabase gen types` with `--local` flag | `supabase gen types` with `--project-id` (remote) | Phase 1 types come from live remote schema, not local Docker stack |

**Deprecated/outdated:**
- `setupFilesAfterFramework` in Jest config: Not a valid key. Was never valid — likely a typo at
  scaffold time. The correct key is `setupFilesAfterEnv` (since Jest 24).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Expo Router v6 uses a specific `app.json`/`app.config.ts` field to redirect the routes directory from `app/` to `src/app/` | Common Pitfalls #5, Architecture Patterns | If the field name is wrong, directory restructure breaks routing; high-severity build failure |
| A2 | `RNMapboxMapsVersion` value for `@rnmapbox/maps` ^10.3.1 that unlocks Mapbox SDK v11 features | Common Pitfalls #4 | Wrong version pin could cause native build failures or missing features |
| A3 | `eas-cli` v19.0.1 is compatible with Expo SDK 55 project configuration | Standard Stack | Version mismatch with EAS could cause build config validation failures |

---

## Open Questions

1. **Expo Router v6: routes directory field name**
   - What we know: Expo Router is file-based and the convention is an `app/` directory. CONTEXT.md
     requires routes at `src/app/`.
   - What's unclear: The exact `app.json` or `app.config.ts` field that redirects Expo Router's
     root from `app/` to `src/app/`. Could be `expo.router.root`, `expo.entryPoint`, or a Metro
     config option.
   - Recommendation: Task in Plan 01-02 to read https://docs.expo.dev/versions/v55.0.0/ for the
     exact field before restructuring the directory. If no field exists, the plan may need to keep
     routes at `app/app/` and use `src/` as a sibling for lib/stores/hooks only — which is also
     consistent with CONTEXT.md's intent (source separation, not necessarily full route relocation).

2. **seed.sql: create empty file or disable in config.toml?**
   - What we know: `config.toml` references `./seed.sql` which does not exist. `supabase db push`
     behavior when seed file is missing is unclear (may error on reset but not push).
   - What's unclear: Whether `supabase db push` (used for remote) executes the seed, or only
     `supabase db reset` (used for local) does.
   - Recommendation: Create `supabase/seed.sql` with only a comment to satisfy the config reference.
     This is safe and future-ready for Phase-level seeding.

3. **app_config migration timestamp**
   - What we know: All 8 existing migrations use timestamp prefix `20260519000001` through
     `20260519000008`. The next migration should be `20260519000009`.
   - What's unclear: If the plan is executed on a different date, should the new migration use today's
     date or continue the existing sequence?
   - Recommendation: Use `20260519000009` to maintain the sequence established by the existing
     migrations. This is the safer choice since `supabase db push` applies migrations in filename
     order, and a future-dated migration from a different day would sort differently.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `supabase` CLI | `supabase link`, `db push`, `gen types`, `db lint` | Yes | 2.100.1 | — |
| `eas` CLI | `eas login`, `eas init`, `eas build`, `eas secret:create` | **No** | — | Install: `npm install -g eas-cli` |
| `node` | All npm/expo/eas commands | Yes | 24.15.0 | — |
| `npm` | Package management | Yes | 11.14.1 | — |
| Supabase project ref ID | `supabase link`, `supabase gen types` | **User must provide** | — | Use placeholder types until linked |
| Mapbox tokens (`sk.*`, `pk.*`) | EAS build, runtime map render | **User must create** | — | Dev client build blocked until created |
| EAS account | `eas login`, `eas build` | **User must create** | — | Dev client build blocked until created |

**Missing dependencies with no fallback:**
- `eas` CLI — must install before Plan 01-02's build step
- Supabase project ref ID — plan must include prerequisite gate for user to provide it

**Missing dependencies with fallback:**
- Mapbox public token — if not yet created, smoke test renders a blank map (app does not crash)
- TypeScript types — placeholder `database.types.ts` unblocks compilation until real types generated

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 30.4.2 + jest-expo 55.0.18 |
| Config file | `app/jest.config.js` (BUG: `setupFilesAfterFramework` must be changed to `setupFilesAfterEnv`) |
| Quick run command | `npm test` (run from `app/`) |
| Full suite command | `npm test -- --coverage` (run from `app/`) |

### Phase Requirements to Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SC-1 | `supabase db reset` applies all migrations cleanly | CLI verification | `supabase db reset` (zero errors exit code) | N/A — CLI |
| SC-2 | PostGIS GIST index exists on `bathroom_locations.location` | SQL assertion | Query `pg_indexes` (see Code Examples) | N/A — SQL |
| SC-3 | `app_config` table exists and is seeded | SQL assertion | `supabase db lint --linked` + spot-check query | N/A — SQL |
| SC-4 | RLS enabled on all 6 core tables | SQL assertion | Query `pg_tables.rowsecurity` | N/A — SQL |
| SC-5 | Expo dev client builds with Mapbox + Supabase composing | Build + manual smoke | `eas build --profile development --platform android` | N/A — EAS |
| SC-6 | `database.types.ts` generated from live schema and committed | File existence + TS check | `npm run typecheck` (run from `app/`) | ❌ Wave 0 — file must be created |

### Sampling Rate

- **Per task commit:** `npm run typecheck` (from `app/`) — confirms TypeScript compiles
- **Per wave merge:** `npm test` (from `app/`) — confirms mocks load after jest.config fix
- **Phase gate:** All 6 Success Criteria verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `app/src/lib/database.types.ts` — must exist (even as placeholder) before `npm run typecheck` passes
- [ ] `supabase/seed.sql` — must exist before `supabase db reset` succeeds locally
- [ ] Fix `app/jest.config.js`: `setupFilesAfterFramework` → `setupFilesAfterEnv`
- [ ] Update `app/tsconfig.json` paths when `src/` directory is created

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 2) | — |
| V3 Session Management | No (Phase 2) | — |
| V4 Access Control | Yes | RLS on all tables; service-role restriction on trust/moderation columns |
| V5 Input Validation | Partial | app_config seed data is hardcoded constants; no user input |
| V6 Cryptography | No | No key generation in Phase 1 |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Service-role key exposed in client | Information Disclosure | Never put service_role key in `.env.local` or client code; anon key only |
| Mapbox secret token committed to git | Information Disclosure | Use `app.config.ts` + EAS secrets; never hardcode `sk.*` in `app.json` |
| Migration schema drift via Studio | Tampering | CONTEXT.md: migration files are source of truth; Studio SQL editor forbidden |
| RLS misconfiguration on app_config | Elevation of Privilege | Policy: anon SELECT only; no policy for authenticated INSERT/UPDATE; service_role bypasses by default (intentional) |

**Phase 1 security gate:** `supabase db lint --linked` must return zero warnings before Plan 01-01 is
considered complete. Any `No RLS` warning on a table the client can access is a BLOCK-level finding.

---

## Project Constraints (from CLAUDE.md)

These directives are extracted from `CLAUDE.md` and `app/CLAUDE.md` (which imports `AGENTS.md`).
The planner must verify all Phase 1 tasks comply.

| Directive | Impact on Phase 1 |
|-----------|-------------------|
| Multi-agent review: Claude implements → logs to `.claude/review-queue.txt` → Antigravity + Codex review → resolve BLOCK/REQUEST CHANGES → commit | Every committed file in Phase 1 goes through this review cycle |
| No commit without APPROVE from both Antigravity and Codex (or all issues resolved) | EAS dev client build cannot be committed until reviewer verdicts documented |
| GSD workflow entry points: use `/gsd-execute-phase` for planned phase work | Plans are executed via GSD, not ad-hoc edits |
| Read exact versioned Expo docs at https://docs.expo.dev/versions/v55.0.0/ before writing code | Any Expo Router or SDK API used in Phase 1 must be verified against SDK 55 docs |
| TDD: Red → Green → Refactor for all non-trivial behavior | The jest.config.js fix is a prerequisite to any TDD work; fix it in Wave 0 |
| No PII in logs | Smoke test console.log in placeholder screen must not include user data |
| No raw SQL strings unless migrations or safely parameterized server-only code | The app_config migration SQL is acceptable; no raw SQL in TypeScript client code |

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection: `app/package.json`, `app/jest.config.js`, `app/jest.setup.ts`, `app/app.json`, `app/tsconfig.json`, `supabase/config.toml`, all 8 migration files — direct read
- `npm view [package] version` — npm registry, confirmed installed versions match latest
- CONTEXT.md (phase decisions), STACK.md (library choices), ARCHITECTURE.md (patterns), schema-contract.md (RLS rules) — project authoritative docs

### Secondary (MEDIUM confidence)

- Jest config key `setupFilesAfterEnv` confirmed via `node_modules/jest-config/build/index.js` source inspection
- `supabase` CLI v2.100.1 confirmed available in PATH
- `eas-cli` v19.0.1 confirmed on npm registry via `npm view eas-cli version`

### Tertiary (LOW / ASSUMED)

- Expo Router v6 `app.json` field for custom routes directory — marked [ASSUMED]; must be verified against https://docs.expo.dev/versions/v55.0.0/
- `RNMapboxMapsVersion` value for `@rnmapbox/maps` ^10.3.1 — marked [ASSUMED]; must be verified against https://rnmapbox.github.io/docs/install

---

## Metadata

**Confidence breakdown:**
- DB schema + migrations: HIGH — all 8 files read directly; structure fully understood
- app_config migration pattern: HIGH — follows identical pattern to existing migrations
- Supabase CLI commands: HIGH — CLI available and version confirmed
- EAS/Mapbox setup: MEDIUM — token strategy from CONTEXT.md is authoritative; exact `app.config.ts` field names assumed from STACK.md
- Expo Router directory config: LOW — needs verification against versioned docs before implementation
- Package versions: HIGH — all confirmed via `npm view` against live registry
- jest.config bug: HIGH — confirmed via `jest-config` source that `setupFilesAfterEnv` is correct

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable ecosystem; 30-day estimate)
