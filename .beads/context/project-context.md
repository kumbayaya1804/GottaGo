# Project Context (Maintained by Orchestrator)
<!-- updated: 2026-06-28 -->

## Tooling
- Package manager: npm
- Test runner: jest@29.7.0 + jest-expo@55 (PINNED — do NOT upgrade jest)
- Test command: `cd app && npm test`
- Coverage command: `cd app && npm run test:coverage` (100% lines/branches/functions/statements — enforced in jest.config.js)
- Type check: `cd app && npm run typecheck` (tsc --noEmit)
- Lint: `cd app && npm run lint` (eslint .)
- Supabase push: `cd supabase && supabase db push`

## Critical Constraints
- jest@29.7.0 PINNED — do not let any install upgrade it
- Coverage scope: src/** EXCEPT src/app/** AND src/constants/** (excluded by jest.config.js collectCoverageFrom)
- Design tokens: no raw hex in StyleSheets — use Colors[colorScheme].tokenName
- No PII in logs, no GPS in console.log
- Deep-link scheme: gotta-go:// (NOT gottago://)
- Supabase project: ebmzhjmmtmldhrojkdqw
- database.types.ts: regenerated 2026-06-28 — check_display_name_available + set_gps_consent now typed

## Completed Work Units
| WU | Title | Key Files | Commit |
|----|-------|-----------|--------|
| WU-01b-T5 | TDD auth-logic modules | app/src/features/auth/{validation,redirect,SessionProvider,useSession,displayName,gpsConsent}.ts(x) + __tests__ | 97ec0e1 |

## Established Patterns
- Supabase client: import { supabase } from app/src/lib/supabase.ts (never recreate)
- Test mocks: jest.isolateModules + env save/restore (see app/src/lib/__tests__/supabase.test.ts)
- RPC style: SECURITY DEFINER set search_path = public + explicit grant execute (see 20260624000002)
- Migration header: phase comment block + `-- ─── N. Title ──` dividers
- Screen convention: thin screens (logic in features/**); pure stubs via Bash to avoid TDD Guard

## Active Services
- supabase.ts: shared Supabase client (AsyncStorage, detectSessionInUrl: false)
- check_display_name_available RPC: anon + authenticated (applied in 02-01a)
- set_gps_consent RPC: authenticated only (applied in 02-01a)
- handle_new_user trigger: AFTER INSERT on auth.users → public.users (id, email)
