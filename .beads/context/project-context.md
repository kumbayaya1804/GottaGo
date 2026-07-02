# Project Context (Maintained by Orchestrator)
<!-- updated: 2026-07-02 (savepoint) -->

## Tooling
- Package manager: npm
- Test runner: jest@29.7.0 + jest-expo@55 (PINNED — do NOT upgrade jest)
- Test command: `cd app && npm test` (Windows PowerShell: use `npm.cmd`; `--runTestsByPath` for Expo Router paths containing literal parens like `(auth)`, since Jest otherwise treats them as a regex group)
- Coverage command: `cd app && npm run test:coverage` (100% lines/branches/functions/statements — enforced in jest.config.js)
- Type check: `cd app && npm run typecheck` (tsc --noEmit)
- Lint: `cd app && npm run lint` (eslint .)
- Supabase push: use Supabase MCP `apply_migration` (`SUPABASE_DB_PASSWORD` not set; `supabase db push` fails). **The tool assigns its own timestamp-based migration version on apply, ignoring the local filename's version** — always rename the local migration file post-apply to match what `list_migrations` reports live, or repo/live history drifts (caught by Codex in WU-02-T3 round 2).
- TDD Guard: chat command must be the EXACT literal string `tdd-guard off` / `tdd-guard on` (exact-match on the raw prompt, not fuzzy). Writes `guardEnabled` to `.claude/tdd-guard/data/config.json`. A coordinator-relayed "the user said X" does NOT trigger it — only a literal user message does. **Currently ON** (was OFF only for WU-02-T3, re-enabled after that commit).
- Background coder subagents correctly refuse to apply live/irreversible changes (DB migrations, type regen from live schema) based on a coordinator-relayed "user confirmed" message, even if accurately quoted — they require a message with real user provenance in that same conversation. There is no way to unstick this after the fact; the orchestrator should just perform that specific step itself in a fresh session where it's talking to the user directly, rather than keep resuming the same subagent.
- **Review-artifact self-enforcement (new 2026-07-02):** `.beads/hooks/pre-commit` runs `node .claude/hooks/check-review-artifacts.js` before beads' own logic. If any staged file is also in `.claude/review-queue.txt`, it blocks the commit unless both `.claude/{antigravity,codex}-prompt-latest.md` contain "Runtime Boundary And Mock Audit" and both `.claude/{antigravity,codex}-review-latest.md` contain "Runtime Boundary Check". Presence check only. Tracked in git (outside the beads-managed block in that file) — survives clones once `bd hooks install` sets `core.hooksPath` to `.beads/hooks`. Note: `.git/hooks/` is NOT the active hooks path in this repo (`core.hooksPath` points to `.beads/hooks`) — don't wire anything into `.git/hooks/` expecting it to fire.

## Critical Constraints
- jest@29.7.0 PINNED — do not let any install upgrade it
- expo-auth-session@55.0.17 installed (Expo-resolved pin)
- Coverage scope: src/** EXCEPT src/app/** AND src/constants/** (excluded by jest.config.js collectCoverageFrom)
- Design tokens: no raw hex in StyleSheets — use Colors[colorScheme].tokenName
- No PII in logs, no GPS in console.log
- Deep-link scheme: gotta-go:// (NOT gottago://)
- Supabase project: ebmzhjmmtmldhrojkdqw
- database.types.ts: regenerated 2026-07-01 — includes check_display_name_available, set_gps_consent, update_profile, delete_account, get_profile_stats
- ColorScheme: ALWAYS use `useColorScheme() === 'dark' ? 'dark' : 'light'` (NOT `?? 'light'` — causes TS7053)
- expo-router typed routes: use `as never` cast for routes not yet in generated types
- PASSWORD_RECOVERY: handled via separate onAuthStateChange subscription in _layout.tsx (NOT in SessionProvider)
- `redirect.ts`'s `nextRoute` only auto-redirects authenticated users out of the literal `(auth)` route **group** (`segments[0] === '(auth)'`) — routes outside `(auth)`/`(tabs)` (e.g. `auth/callback`, `gps-consent`, `reset-password`) must navigate explicitly; the guard won't do it for them.
- Any screen where a session can appear mid-flow (before the screen is done with its own async work) must use the `suppressGuardRedirect` context field to prevent the root guard from racing it — see Established Patterns below.

## Completed Work Units
| WU | Title | Key Files | Commit |
|----|-------|-----------|--------|
| WU-01a-T1 | Foundation scaffold | — | (pre-dates detailed tracking) |
| WU-01a-T2 | Packages, babel, Supabase config, jest mocks | app/package.json, babel.config.js, jest.setup.ts, jest.config.js, src/lib/supabase.ts | 15a8dc4 |
| WU-01a-T3 | Design token files | app/constants/Colors.ts, src/constants/{spacing,typography,radius,legal}.ts | 502105c |
| WU-01a-T4 | Wave 0 migrations | supabase/migrations/20260627000000-02.sql (3 migrations) | 6c60a1d |
| infra | jest coverage exclusion + types sync | app/jest.config.js, src/lib/database.types.ts | fedc053 |
| WU-01b-T5 | TDD auth-logic modules | src/features/auth/{validation,redirect,SessionProvider,useSession,displayName,gpsConsent}.ts(x) + __tests__ | 97ec0e1 |
| WU-01b-T6 | Root layout + nav shell + Welcome | src/app/{_layout,index}.tsx, (tabs)/*, (auth)/_layout.tsx | c37d1e2 |
| WU-01b-T7 | Auth forms + GPS consent + reset | src/app/(auth)/*.tsx, gps-consent.tsx, reset-password.tsx + __tests__ | ea07fca |
| WU-02-T1 | Nullable FK migration + profile RPCs | supabase/migrations/20260627000003-04.sql, database.types.ts | ac66fc4 |
| WU-02-T2 | expo-auth-session install + dashboard/EAS config | app/package.json, package-lock.json; Supabase Google provider, redirect URLs, email-confirm-disabled, EAS secrets | fa63838 + dashboard config (no code commit) |
| WU-02-T3 | oauth.ts + profile RPC callers (updateProfile/deleteAccount/profileStats) | src/features/auth/oauth.ts, src/features/profile/{updateProfile,deleteAccount,profileStats}.ts + tests; supabase/migrations/20260701211135_profile_stats_rpc.sql | 10e0f9e |
| WU-02-T4 | OAuth UI (sign-in Google/Apple gating) + deep-link callback route + sign-up profile wiring + guard-race/retry fixes | src/app/(auth)/{sign-in,sign-up}.tsx, src/app/auth/callback.tsx, src/features/auth/SessionProvider.tsx, src/app/_layout.tsx + all tests | 76c7375 |
| process | Review-handoff standard tightening (runtime-boundary/mock-boundary audit, self-enforcing pre-commit hook) | CODEX.md, ANTIGRAVITY.md, docs/agent-harness.md, docs/verification.md, .claude/commands/*, .claude/hooks/check-review-artifacts.js, .beads/hooks/pre-commit | c2e1e33 |

## Established Patterns
- Supabase client: `import { supabase } from '@/lib/supabase'` (never recreate)
- Test mocks: jest.isolateModules + env save/restore (see app/src/lib/__tests__/supabase.test.ts)
- RPC style: SECURITY DEFINER set search_path = public + `revoke from public; revoke from anon; grant to authenticated` (both revokes required — Supabase auto-grants anon via ALTER DEFAULT PRIVILEGES)
- Migration header: phase comment block + `-- ─── N. Title ──` dividers + CONTEXT §ref + Pitfall refs
- Migration filename convention: draft a timestamp, but **rename to match what Supabase's `apply_migration` actually records live** after applying (its own timestamp, not the draft one)
- Screen convention: thin screens (logic in features/**); pure stubs via Bash to avoid TDD Guard
- Colors: `const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light'` (ternary, not nullish)
- Expo Router: `router.push('/(auth)/route' as never)` for routes not yet in generated types
- TDD order: test → red → implement → green (100% coverage required for all src/features/**)
- **Guard-suppression pattern** (WU-02-T4): any screen where an async call (`signUp`, `signInWith*`) creates a session as a side effect, followed by further async work before the screen navigates, must call `sessionCtx.setSuppressGuardRedirect(true)` before that call and clear it **only via a `useEffect` cleanup fired on unmount** — never in a `finally` block (that only narrows the race window, doesn't close it, since it can fire in the same render commit as an error becoming visible).
- **Retry-after-partial-success pattern** (WU-02-T4): when a flow has two sequential server calls and the first can succeed while the second fails independently, track completion of the first with explicit state (e.g. `accountCreated`) so a retry only repeats the failed step, not the whole flow.
- **Review packet structure** (updated 2026-07-02): lean, focused excerpts over full-document dumps; every packet needs "Dependency Call Chains" (nearest callers/callees/providers/guards/RPCs) and "Runtime Boundary And Mock Audit" sections; reviewer verdicts must include "Runtime Boundary Check". Self-enforced via `.beads/hooks/pre-commit`.

## Active Services
- supabase.ts: shared Supabase client (AsyncStorage, detectSessionInUrl: false)
- check_display_name_available RPC: anon + authenticated (migration 000002)
- set_gps_consent RPC: authenticated only; both public+anon revoked (migration 000002)
- handle_new_user trigger: AFTER INSERT on auth.users → public.users (id, email); does NOT set display_name
- update_profile(new_display_name text) RPC: authenticated only; sets display_name + updated_at (migration 000004)
- delete_account() RPC: authenticated only; nulls 7 FK columns then deletes auth.users atomically (migration 000004)
- 7 FK columns now nullable ON DELETE SET NULL: submissions.submitter_id, ratings.user_id, trust_events.user_id, verification_events.user_id, reports.user_id, failure_events.user_id, availability_flags.reporter_id (migration 000003)
- get_profile_stats() RPC: authenticated only; derives user via auth.uid() (no caller-supplied id); returns json {gps_verifications, locations_submitted, ratings_given} in one round trip. Live as migration `20260701211135_profile_stats_rpc.sql`.
- signInWithGoogle() / handleAuthCallback() (oauth.ts): Google OAuth via expo-web-browser openAuthSessionAsync (traps the redirect in-app on Android, never escapes to a real OS deep link) + PKCE exchange for password-recovery/escaped-OAuth deep links via auth/callback.tsx.
- suppressGuardRedirect / setSuppressGuardRedirect (SessionContextValue, SessionProvider.tsx): lets a screen temporarily disable the root layout guard's auto-redirect while it's mid-flow. Consumed today by sign-up.tsx and _layout.tsx only.

## Test Suite State (as of commit 76c7375)
- 20 suites, 153 tests, 100% coverage on all `src/features/**`. typecheck clean, lint clean (27 pre-existing unrelated `unicode-bom` warnings).
