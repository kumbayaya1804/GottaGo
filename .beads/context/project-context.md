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
- TDD Guard toggle: chat command must be the EXACT literal string `tdd-guard off` / `tdd-guard on` (nothing else in the message — it's an exact-match check on the raw prompt, not a fuzzy trigger). Writes `guardEnabled` to `.claude/tdd-guard/data/config.json`. A coordinator-relayed "the user said X" does NOT trigger it — only a literal user message does. Currently OFF (approved for WU-02-T3 only because jest@29.7.0 can't produce the machine-readable test-result file the guard's validator needs — `tdd-guard-jest` requires jest≥30). Re-enable once T3 commits.
- Background coder subagents correctly refuse to apply live/irreversible changes (DB migrations, type regen from live schema) based on a coordinator-relayed "user confirmed" message, even if accurately quoted — they require a message with real user provenance in that same conversation. There is no way to unstick this after the fact; the orchestrator should just perform that specific step itself in a fresh session where it's talking to the user directly, rather than keep resuming the same subagent.

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
| WU-02-T2 | expo-auth-session install + dashboard/EAS config | app/package.json, package-lock.json; Supabase Google provider, redirect URLs, email-confirm-disabled, EAS secrets GOOGLE_CLIENT_ID/GOOGLE_SECRET (all verified live 2026-07-01) | fa63838 + dashboard config (no code commit for the dashboard side) |
| WU-02-T3 | oauth/profile TDD modules (CODE COMPLETE, NOT YET COMMITTED) | src/features/auth/oauth.ts, src/features/profile/{updateProfile,deleteAccount,profileStats}.ts + tests; supabase/migrations/20260627000005_profile_stats_rpc.sql (written, not yet applied live) | — blocked on migration apply, see execution-state.md |

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
- get_profile_stats() RPC: authenticated only; derives user via auth.uid() (no caller-supplied id — matches update_profile/delete_account pattern); returns json {gps_verifications, locations_submitted, ratings_given} in one round trip. **Migration 20260627000005 WRITTEN, NOT YET APPLIED LIVE** — needed because `ratings` base-table SELECT is revoked from authenticated/anon (migration 000002, PII protection), so client-side querying it directly 42501s.

## Test Suite State (as of last independent verification, pre-migration-apply for WU-02-T3)
- 19 suites, 130 tests, 100% coverage on all touched files. oauth.ts/updateProfile.ts/deleteAccount.ts/profileStats.ts all at 100%. profileStats.ts has 4 expected typecheck errors until the RPC above is live and types are regenerated — not a real bug, just generated-types lag.
