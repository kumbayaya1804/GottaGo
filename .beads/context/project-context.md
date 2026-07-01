# Project Context (Maintained by Orchestrator)
<!-- updated: 2026-07-01 -->

## Tooling
- Package manager: npm
- Test runner: jest@29.7.0 + jest-expo@55 (PINNED — do NOT upgrade jest)
- Test command: `cd app && npm test`
- Coverage command: `cd app && npm run test:coverage` (100% lines/branches/functions/statements — enforced in jest.config.js)
- Type check: `cd app && npm run typecheck` (tsc --noEmit)
- Lint: `cd app && npm run lint` (eslint .)
- Supabase push: use Supabase MCP apply_migration (SUPABASE_DB_PASSWORD not set; `supabase db push` fails)

## Critical Constraints
- jest@29.7.0 PINNED — do not let any install upgrade it
- expo-auth-session@55.0.17 installed (Expo-resolved pin)
- Coverage scope: src/** EXCEPT src/app/** AND src/constants/** (excluded by jest.config.js collectCoverageFrom)
- Design tokens: no raw hex in StyleSheets — use Colors[colorScheme].tokenName
- No PII in logs, no GPS in console.log
- Deep-link scheme: gotta-go:// (NOT gottago://)
- Supabase project: ebmzhjmmtmldhrojkdqw
- database.types.ts: regenerated 2026-07-01 — includes check_display_name_available, set_gps_consent, update_profile, delete_account
- ColorScheme: ALWAYS use `useColorScheme() === 'dark' ? 'dark' : 'light'` (NOT `?? 'light'` — causes TS7053)
- expo-router typed routes: use `as never` cast for routes not yet in generated types
- PASSWORD_RECOVERY: handled via separate onAuthStateChange subscription in _layout.tsx (NOT in SessionProvider)

## Completed Work Units
| WU | Title | Key Files | Commit |
|----|-------|-----------|--------|
| WU-01a-T2 | Packages, babel, Supabase config, jest mocks | app/package.json, babel.config.js, jest.setup.ts, jest.config.js, src/lib/supabase.ts | 15a8dc4 |
| WU-01a-T3 | Design token files | app/constants/Colors.ts, src/constants/{spacing,typography,radius,legal}.ts | 502105c |
| WU-01a-T4 | Wave 0 migrations | supabase/migrations/20260627000000-02.sql (3 migrations) | 6c60a1d |
| infra | jest coverage exclusion + types sync | app/jest.config.js, src/lib/database.types.ts | fedc053 |
| WU-01b-T5 | TDD auth-logic modules | src/features/auth/{validation,redirect,SessionProvider,useSession,displayName,gpsConsent}.ts(x) + __tests__ | 97ec0e1 |
| WU-01b-T6 | Root layout + nav shell + Welcome | src/app/{_layout,index}.tsx, (tabs)/*, (auth)/_layout.tsx | c37d1e2 |
| WU-01b-T7 | Auth forms + GPS consent + reset | src/app/(auth)/*.tsx, gps-consent.tsx, reset-password.tsx + __tests__ | ea07fca |
| WU-02-T1 | Nullable FK migration + profile RPCs | supabase/migrations/20260627000003-04.sql, database.types.ts | ac66fc4 |
| WU-02-T2 | expo-auth-session install (partial) | app/package.json, package-lock.json | fa63838 |

## Established Patterns
- Supabase client: `import { supabase } from '@/lib/supabase'` (never recreate)
- Test mocks: jest.isolateModules + env save/restore (see app/src/lib/__tests__/supabase.test.ts)
- RPC style: SECURITY DEFINER set search_path = public + `revoke from public; revoke from anon; grant to authenticated` (both revokes required — Supabase auto-grants anon via ALTER DEFAULT PRIVILEGES)
- Migration header: phase comment block + `-- ─── N. Title ──` dividers + CONTEXT §ref + Pitfall refs
- Screen convention: thin screens (logic in features/**); pure stubs via Bash to avoid TDD Guard
- Colors: `const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'` (ternary, not nullish)
- Expo Router: `router.push('/(auth)/route' as never)` for routes not yet in generated types
- TDD order: test → red → implement → green (100% coverage required for all src/features/**)

## Active Services
- supabase.ts: shared Supabase client (AsyncStorage, detectSessionInUrl: false)
- check_display_name_available RPC: anon + authenticated (migration 000002)
- set_gps_consent RPC: authenticated only; both public+anon revoked (migration 000002)
- handle_new_user trigger: AFTER INSERT on auth.users → public.users (id, email); does NOT set display_name
- update_profile(new_display_name text) RPC: authenticated only; sets display_name + updated_at (migration 000004)
- delete_account() RPC: authenticated only; nulls 7 FK columns then deletes auth.users atomically (migration 000004)
- 7 FK columns now nullable ON DELETE SET NULL: submissions.submitter_id, ratings.user_id, trust_events.user_id, verification_events.user_id, reports.user_id, failure_events.user_id, availability_flags.reporter_id (migration 000003)

## Test Suite State (as of fa63838)
- 109 tests, 15 suites, 0 failures, 100% coverage on all src/features/**
