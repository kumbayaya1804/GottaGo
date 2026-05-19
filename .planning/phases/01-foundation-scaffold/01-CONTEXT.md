# Phase 1 Context: Foundation & Scaffold

**Phase:** 01 — Foundation & Scaffold
**Date:** 2026-05-19
**Status:** Ready for planning

---

## Domain

DB configuration finalized and verified (app_config table, PostGIS GIST index, RLS lint), Supabase project linked and migrations pushed, TypeScript types generated and committed, Expo app directory restructured to canonical layout, Supabase client wired up, EAS dev client built and smoke-tested with Mapbox + Supabase composing.

Bootstrap note: 8 Supabase migrations and the full Expo dependency scaffold were created outside GSD before this phase was formalized. Phase 1 plan picks up from that baseline.

---

## Decisions

### app_config Thresholds

All values seed in a migration and are admin-editable via Supabase Studio without redeployment. Anon role can SELECT (client uses verify_radius_m for "get closer" UX feedback). Only service role can UPDATE/DELETE.

| Key | Value | Rationale |
|-----|-------|-----------|
| `max_accuracy_m` | 50 | Dense urban environments; tight enough to resist casual spoofing |
| `verify_radius_m` | 100 | Physical presence window; covers indoor GPS drift |
| `max_gps_age_s` | 60 | Must have active fix at time of submission |
| `decay_half_life_days` | 30 | Monthly half-life; appropriate for college-town turnover |
| `confidence_floor` | 0.05 | Locations never decay to zero; hidden only via suppressed_at |
| `report_suppress_threshold` | 4 | 4 matching reports auto-suppresses; single actor can't suppress alone |

### Supabase Environment

- Live Supabase project exists. User has the project reference ID.
- Link via `supabase link --project-ref <ref>` then push migrations via `supabase db push`.
- Migration files are the source of truth — never apply schema changes via Studio SQL editor.
- Environment variables: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (gitignored). EAS secrets for CI/production builds.
- TypeScript types generated from live remote schema immediately after migrations push: `supabase gen types typescript --project-id <ref> --schema public > app/src/lib/database.types.ts`. Committed and kept up to date.
- `src/lib/supabase.ts` uses `createClient<Database>(...)` with the Database generic from day one. No untyped interim state.

### EAS + Mapbox Token Strategy

- **Mapbox tokens:** User needs to create both at mapbox.com before the dev client build:
  - Secret download token (`sk.*`, scope `Downloads:Read`) → stored as EAS secret (`MAPBOX_DOWNLOAD_TOKEN`), passed to `@rnmapbox/maps` config plugin
  - Public access token (`pk.*`) → `EXPO_PUBLIC_MAPBOX_TOKEN` in `.env.local`
- **EAS account:** User needs to create an Expo/EAS account, then `eas login` + `eas init` in the `app/` directory.
- **Google Maps API key:** Still needed for geocoding/Places REST calls (not for map rendering). Stored as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local`.
- **Map rendering:** Mapbox (`@rnmapbox/maps`) — not react-native-maps. react-native-maps Google provider is broken on Expo SDK 55 iOS (expo/expo#43288). Decision confirmed by user.
- **Dev client build:** Gated final step in Phase 1. Runs only after Mapbox tokens and EAS account are configured. `eas build --profile development --platform android` first (faster), then iOS.
- Plan 01-02 ends with a smoke test: dev client launches, Mapbox map renders, Supabase connection returns data.

### App Directory Structure

- Reorganize from template `app/app/(tabs)/` to canonical structure in Phase 1:
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
- `src/lib/` created in Phase 1 with `supabase.ts` (typed client) and `database.types.ts` (generated or placeholder until remote project is linked).
- All placeholder screens render a minimal `<View><Text>` — no real UI, just routing structure.
- Source files live under `app/src/` not `app/app/` — clean separation from Expo Router's `app/` directory.

---

## Canonical Refs

Downstream agents must read these before planning or implementing Phase 1:

| File | Purpose |
|------|---------|
| `.planning/research/STACK.md` | Full tech stack decisions, install sequence, anti-patterns |
| `.planning/research/ARCHITECTURE.md` | Build order levels, component boundaries, data flow diagrams |
| `docs/schema-contract.md` | DB contract, RLS rules, migration review checklist |
| `supabase/migrations/` | All 8 existing migration files — understand before adding app_config |
| `app/app.json` | Current Expo config with plugins already wired (`@rnmapbox/maps`, `expo-secure-store`, `expo-image`) |
| `app/package.json` | Full dependency list already installed |
| `AGENTS_ROSTER.md` | Agent roles, review workflow — read before any implementation |

---

## Code Context

Reusable assets already in place:

- `supabase/migrations/20260519000001_extensions.sql` — PostGIS + pgcrypto already enabled
- `supabase/migrations/20260519000002_profiles.sql` through `...000008_respect_signal_90d.sql` — full schema already written and committed
- `app/jest.config.js` + `app/jest.setup.ts` — test infrastructure with Mapbox/expo-location/MMKV mocks ready
- `app/app.json` — `@rnmapbox/maps` plugin already configured (needs real token values)

Patterns to follow:
- PostGIS: `geography(Point, 4326)` with `ST_DWithin` in meters — never geometry + degrees
- Supabase client: `createClient<Database>` with AsyncStorage auth, `detectSessionInUrl: false`
- No service-role key anywhere the client can access

---

## Deferred Ideas

- **Launch city decision (Portland vs. Vegas vs. Eugene):** Raised during discussion. Eugene remains the current ROADMAP target. User mentioned possibly launching from Portland or Vegas instead (leaving Oregon in June). This is a roadmap-level decision — revisit before Phase 8 (UX) to ensure any city-specific seeding strategy is locked. Note for PROJECT.md update.
- **Apple Sign-In full implementation:** Blocked on Apple Developer enrollment ($99/year). Stubbed in Phase 2, fully implemented in Phase 9.

---

## Open Questions for Planner

- User has not yet provided the Supabase project ref ID. Plan 01-01 should include a prerequisite step: "Provide project ref ID to run `supabase link`."
- The `app/` subdirectory contains the Expo project (created by `create-expo-app app`). All Expo CLI commands run from `app/`, not the repo root. Plan must be explicit about working directory for each step.
