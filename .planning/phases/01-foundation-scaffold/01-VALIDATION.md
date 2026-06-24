# Phase 1: Foundation & Scaffold — Validation Strategy

**Phase:** 01
**Phase Slug:** foundation-scaffold
**Date:** 2026-05-19
**Source:** Extracted from 01-RESEARCH.md § Validation Architecture

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 30.4.2 + jest-expo 55.0.18 |
| Config file | `app/jest.config.js` (BUG: `setupFilesAfterFramework` → must be `setupFilesAfterEnv` — fix in Wave 1) |
| Quick run command | `npm test` (run from `app/`) |
| Full suite command | `npm test -- --coverage` (run from `app/`) |

---

## Phase Requirements to Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SC-1 | `supabase db reset` applies all migrations cleanly | CLI verification | `supabase db reset` (zero errors exit code) | N/A — CLI |
| SC-2 | PostGIS GIST index exists on `locations.coordinates` | SQL assertion | Query `pg_indexes` (see Code Examples in RESEARCH.md) | N/A — SQL |
| SC-3 | `app_config` table exists and is seeded | SQL assertion | `supabase db lint --linked` + spot-check query | N/A — SQL |
| SC-4 | RLS enabled on all 6 core tables | SQL assertion | Query `pg_tables.rowsecurity` | N/A — SQL |
| SC-5 | Expo dev client builds with Mapbox + Supabase composing | Build + manual smoke | `eas build --profile development --platform android` | N/A — EAS |
| SC-6 | `database.types.ts` generated from live schema and committed | File existence + TS check | `npm run typecheck` (run from `app/`) | ❌ Wave 1 — must be created |

---

## Sampling Rate

- **Per task commit:** `npm run typecheck` (from `app/`) — confirms TypeScript compiles
- **Per wave merge:** `npm test` (from `app/`) — confirms mocks load after jest.config fix
- **Phase gate:** All 6 Success Criteria verified before `/gsd:verify-work`

---

## Wave 0 Gaps (must exist before tests can run)

- [ ] `app/src/lib/database.types.ts` — must exist (even as placeholder) before `npm run typecheck` passes
- [ ] `supabase/seed.sql` — must exist before `supabase db reset` succeeds locally
- [ ] Fix `app/jest.config.js`: `setupFilesAfterFramework` → `setupFilesAfterEnv`
- [ ] Update `app/tsconfig.json` paths when `src/` directory is created: `"@/*": ["./src/*"]`

---

## Security Gate

`supabase db lint --linked` must return zero warnings before Plan 01-01 is considered complete.
Any `No RLS` warning on a client-accessible table is a **BLOCK-level finding**.

---

## Known Latency Exception

SC-5 (EAS dev client build) runs via `eas build` — a cloud build that takes 15–30+ minutes.
No faster automated substitute exists for native mobile dev client builds. Expected duration noted for executor awareness.

---

## Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 2) | — |
| V3 Session Management | No (Phase 2) | — |
| V4 Access Control | Yes | RLS on all tables; service-role restriction on trust/moderation columns |
| V5 Input Validation | Partial | app_config seed data is hardcoded constants; no user input |
| V6 Cryptography | No | No key generation in Phase 1 |
