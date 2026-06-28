---
phase: "02-auth-profiles"
plan: "01a"
type: execute
wave: 1
depends_on: []
autonomous: false   # [ASSUMED]-package install checkpoint + [BLOCKING] supabase db push
requirements: [REQ-2-1, REQ-2-4, REQ-2-6, REQ-2-7]
files_modified:
  - app/babel.config.js
  - app/jest.setup.ts
  - app/jest.config.js
  - app/package.json
  - supabase/config.toml
  - app/constants/Colors.ts
  - app/src/constants/typography.ts
  - app/src/constants/spacing.ts
  - app/src/constants/radius.ts
  - app/src/constants/legal.ts
  - supabase/migrations/20260627000000_handle_new_user_trigger.sql
  - supabase/migrations/20260627000001_display_name_unique_index.sql
  - supabase/migrations/20260627000002_auth_rpcs.sql

must_haves:
  truths:
    - "react-native-gesture-handler is installed at the Expo SDK-55 pin (via npx expo install, NOT npm latest)"
    - "app/babel.config.js exists and exports babel-preset-expo"
    - "jest@29.7.0 remains pinned — not upgraded by any install in this plan"
    - "supabase/config.toml minimum_password_length = 8 (aligned to Zod 8-char rule)"
    - "supabase/config.toml [auth.external.google] block present (enabled = true, env() references)"
    - "jest.setup.ts mocks expo-web-browser and expo-router (useSegments, useRouter); existing mocks untouched"
    - "handle_new_user trigger captured in migration 00000 (id+email only, no display_name)"
    - "lower(display_name) case-insensitive unique index applied to public.users"
    - "check_display_name_available RPC callable by anon + authenticated roles"
    - "set_gps_consent RPC callable by authenticated role only"
    - "LEGAL_URLS constant exported from app/src/constants/legal.ts (placeholder or live Termly URLs)"
    - "Three Wave 0 migrations applied live via supabase db push with no errors"
  artifacts:
    - path: "supabase/migrations/20260627000000_handle_new_user_trigger.sql"
      provides: "handle_new_user AFTER INSERT trigger (id+email) captured in version control"
      contains: "handle_new_user"
    - path: "supabase/migrations/20260627000001_display_name_unique_index.sql"
      provides: "case-insensitive unique index on lower(display_name)"
      contains: "lower(display_name)"
    - path: "supabase/migrations/20260627000002_auth_rpcs.sql"
      provides: "check_display_name_available + set_gps_consent SECURITY DEFINER RPCs"
      contains: "set_gps_consent"
    - path: "app/constants/Colors.ts"
      provides: "39-token light+dark color table from design-system.md §1"
      contains: "background"
    - path: "app/src/constants/legal.ts"
      provides: "LEGAL_URLS constant with termsOfService + privacyPolicy"
      exports: ["LEGAL_URLS"]
  key_links:
    - from: "app/jest.setup.ts"
      to: "expo-web-browser + expo-router mocks"
      via: "jest.mock calls — prerequisites for Tasks 5-7 (02-01b) tests"
      pattern: "expo-web-browser|expo-router"
    - from: "app/src/constants/legal.ts"
      to: "LEGAL_URLS"
      via: "imported by Welcome, Sign-Up, and Profile screens in 02-01b + 02-02"
      pattern: "LEGAL_URLS"
---

<objective>
Wave 0 foundation for Phase 2: install and configure all prerequisites so the auth-logic modules
and screens in 02-01b can be built on solid ground.

Scope: react-native-gesture-handler install + babel config, Supabase config alignment (password
length, Google provider block), jest harness mock additions, design token files (Colors + typography
+ spacing + radius + legal), and the three Wave 0 DB migrations (handle_new_user trigger capture,
case-insensitive display_name unique index, check_display_name_available + set_gps_consent RPCs)
pushed to the live project.

Purpose: 02-01b (auth modules + screens) cannot begin until the push succeeds and the token files
exist. All 13 files in this plan are non-screen infrastructure.

Output: Token files; three Wave 0 migrations applied; package + config updates. Summarized in
`.planning/phases/02-auth-profiles/02-01a-SUMMARY.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@CLAUDE.md
@.planning/phases/02-auth-profiles/02-CONTEXT.md
@.planning/phases/02-auth-profiles/02-RESEARCH.md
@.planning/phases/02-auth-profiles/02-PATTERNS.md
@docs/design/design-system.md
@docs/schema-contract.md

<interfaces>
<!-- Contracts the executor uses directly — extracted from the codebase. No exploration needed. -->

Shared Supabase client (DO NOT modify — import only) — app/src/lib/supabase.ts:
  export const supabase = createClient<Database>(url, anonKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
  });

Deep-link scheme (authoritative): app.config.ts:10 → scheme: 'gotta-go'
  → all redirects use gotta-go://auth/callback. Any doc that says 'gottago' is WRONG (Pitfall 1).

Current users columns (supabase/migrations/20260519010000_remote_schema.sql:12-28):
  id uuid PK references auth.users(id) on delete cascade, email text, display_name text (nullable),
  gps_consent boolean (nullable), gps_consent_at timestamptz, created_at, updated_at, plus trust/gamification cols.
  RLS policies: service_role_all, users_select_own, users_update_own — NO insert policy
  (→ profile row MUST be created by a SECURITY DEFINER trigger, never client INSERT).

SECURITY DEFINER RPC + grant pattern to copy verbatim in style —
  supabase/migrations/20260624000002_ratings_privacy_fix.sql:13-58, 70-75
  (header comment block, `-- ─── N. Title ──` dividers, `security definer set search_path = public`,
  explicit `grant execute on function <name>(<types>) to <role>`).

handle_new_user (live body, LOCKED per CONTEXT §10):
  AFTER INSERT ON auth.users → INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email).
  display_name is NOT set by the trigger — it is set post-signup by update_profile RPC (delivered in 02-02).
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 1: [ASSUMED-package gate] Verify react-native-gesture-handler before install</name>
  <read_first>
    - .planning/phases/02-auth-profiles/02-RESEARCH.md (## Package Legitimacy Audit — slopcheck unavailable; package tagged [ASSUMED])
  </read_first>
  <what-built>
    Nothing yet — this gate precedes the first package install. RESEARCH tagged
    react-native-gesture-handler [ASSUMED] because slopcheck was unavailable in the research env.
  </what-built>
  <how-to-verify>
    1. Open https://www.npmjs.com/package/react-native-gesture-handler
    2. Confirm maintainer is "Software Mansion", repo is github.com/software-mansion/react-native-gesture-handler, and weekly downloads are in the millions.
    3. Confirm there is no suspicious `postinstall` script on the package page.
    Mitigation T-02-SC: only `npx expo install react-native-gesture-handler` (Expo-resolved SDK-55 pin) is approved — never an npm `latest` hand-pin.
  </how-to-verify>
  <resume-signal>Type "approved" to proceed to install, or describe the concern.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Wave 0 — packages, babel, Supabase config, test harness mocks</name>
  <files>app/package.json, app/babel.config.js, app/jest.setup.ts, app/jest.config.js, supabase/config.toml</files>
  <read_first>
    - app/babel.config.js (confirm it does NOT exist — PATTERNS Environment Facts)
    - app/jest.setup.ts (existing mocks — do not redeclare @rnmapbox/maps, expo-location, react-native-mmkv)
    - app/jest.config.js (the '!src/app/**' coverage exclusion comment)
    - supabase/config.toml (lines 177 minimum_password_length, 221 enable_confirmations, 317 [auth.external.apple])
    - .planning/phases/02-auth-profiles/02-RESEARCH.md (§Standard Stack install rules; §Pitfall 7 password length)
  </read_first>
  <action>
    Install gesture-handler with `cd app && npx expo install react-native-gesture-handler` (Expo resolves the
    SDK-55 pin — never hand-pin; do not let jest be upgraded from the PINNED 29.7.0). Create app/babel.config.js
    exporting a function that returns preset `babel-preset-expo` and the `react-native-worklets/plugin` (Reanimated)
    plugin last; verify gesture-handler does not require an additional babel plugin under New Architecture before
    adding one. In supabase/config.toml change `minimum_password_length = 6` to `8` (align to the 8-char Zod rule)
    and add an `[auth.external.google]` block with `enabled = true` and `client_id`/`secret` read from env
    (`env(GOOGLE_CLIENT_ID)` / `env(GOOGLE_SECRET)`) for local dev — actual secrets live in EAS/dashboard, not here.
    In app/jest.setup.ts ADD jest.mock for `expo-web-browser` (`maybeCompleteAuthSession`, `openAuthSessionAsync`)
    and `expo-router` (`useSegments`, `useRouter` returning a `replace` mock); leave existing mocks untouched.
    In app/jest.config.js keep the `'!src/app/**'` coverage exclusion and update its comment to record the LOCKED
    convention (per CONTEXT §10 / Open Q6): testable auth logic lives in src/features/** at 100% coverage; src/app/**
    screens stay thin and are TDD-tested but excluded from coverage collection.
  </action>
  <acceptance_criteria>
    - `app/babel.config.js` exists and exports a config including the `babel-preset-expo` preset.
    - `cd app && grep -n '"react-native-gesture-handler"' package.json` returns a line (dependency added).
    - `cd app && node -e "require('child_process').execSync('npx jest --version')"` reports a jest 29.x version (NOT upgraded).
    - `grep -n 'minimum_password_length = 8' supabase/config.toml` returns a match; `grep -n '\[auth.external.google\]' supabase/config.toml` returns a match.
    - `grep -n 'expo-web-browser' app/jest.setup.ts` and `grep -n 'expo-router' app/jest.setup.ts` both return matches.
    - `cd app && npm test` exits 0 (existing suites still green after harness changes).
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Design token files (Colors, typography, spacing, radius, legal)</name>
  <files>app/constants/Colors.ts, app/src/constants/typography.ts, app/src/constants/spacing.ts, app/src/constants/radius.ts, app/src/constants/legal.ts</files>
  <read_first>
    - docs/design/design-system.md (§1 color tokens light+dark, §2 typography, §3 spacing, §4 radius)
    - .planning/phases/02-auth-profiles/02-UI-SPEC.md (## Implementation Notes for Planner → Token Files Created in Phase 2; Color/Typography/Spacing tables)
    - app/constants/Colors.ts (current 5-token placeholder being replaced)
  </read_first>
  <action>
    Replace app/constants/Colors.ts: export a `Colors` object keyed by `light` and `dark`, each containing the full
    39-token table from design-system.md §1 (background, surface, primary, primaryPressed, primarySurface, textPrimary,
    textSecondary, textInverse, textDisabled, textLink, border, divider, errorRed, emergency, emergencyOrange, scrim,
    skeletonBase, skeletonHighlight, tabBackground, tabIconDefault, tabIconSelected, and the remaining badge/status
    tokens) — exact hex values from §1.1 (light) and §1.2 (dark). Create app/src/constants/typography.ts exporting all
    9 named scale entries (display, h1, h2, h3, body, bodyMedium, subhead, caption, label) each as `{ fontSize, fontWeight, lineHeight }`
    per §2. Create app/src/constants/spacing.ts exporting the 9 numeric tokens (xs 4, sm 8, md 12, base 16, lg 20, xl 24,
    xxl 32, xxxl 48, giant 64). Create app/src/constants/radius.ts exporting the 6 numeric tokens (xs, sm, md, lg, xl, pill)
    per §4. Create app/src/constants/legal.ts exporting `LEGAL_URLS = { termsOfService, privacyPolicy }` (Termly URLs) —
    these are an open input (RESEARCH A5/Open Q4); set them to the project Termly URLs if known, otherwise to clearly-marked
    placeholder constants and surface in the SUMMARY that the user must supply the real Termly URLs before review. These
    five files are constants (TDD-excluded; no test files required) but are prerequisites for every screen.
  </action>
  <acceptance_criteria>
    - `cd app && npx tsc --noEmit -p tsconfig.json` reports no errors for the new constant files.
    - `grep -c "" app/constants/Colors.ts` reflects the full 39-token table (file is no longer the 380-byte placeholder).
    - `grep -n 'xxxl' app/src/constants/spacing.ts` returns a match and `grep -n 'pill' app/src/constants/radius.ts` returns a match.
    - `grep -n 'LEGAL_URLS' app/src/constants/legal.ts` returns a match exporting termsOfService and privacyPolicy.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 4: [BLOCKING] Wave 0 migrations + supabase db push (trigger, unique index, RPCs)</name>
  <files>supabase/migrations/20260627000000_handle_new_user_trigger.sql, supabase/migrations/20260627000001_display_name_unique_index.sql, supabase/migrations/20260627000002_auth_rpcs.sql</files>
  <read_first>
    - .planning/phases/02-auth-profiles/02-CONTEXT.md (§5 display_name rules, §10 handle_new_user live body)
    - .planning/phases/02-auth-profiles/02-PATTERNS.md (SQL RPC migrations section; users RLS quote; migration header convention)
    - supabase/migrations/20260624000002_ratings_privacy_fix.sql (header + SECURITY DEFINER + grant style to copy)
    - docs/schema-contract.md (RLS rules + migration review checklist)
  </read_first>
  <action>
    Before writing the trigger migration, VERIFY the live trigger via Supabase MCP (`list` triggers on auth.users or
    `select tgname from pg_trigger`) — capture the exact existing definition so the migration reproduces it idempotently.
    Migration 1 (handle_new_user): `create or replace function public.handle_new_user() returns trigger language plpgsql
    security definer set search_path = public as $$ begin insert into public.users (id, email) values (new.id, new.email);
    return new; end; $$;` plus `create trigger on_auth_user_created after insert on auth.users for each row execute function
    public.handle_new_user();` (drop-if-exists first so it is reproducible). Body is id+email ONLY — display_name is set by
    update_profile in 02-02 (LOCKED, CONTEXT §10). Mitigates T-02-04-adjacent provisioning gap (Pitfall 4).
    Migration 2 (unique index): `create unique index if not exists users_display_name_lower_uniq on public.users (lower(display_name));`
    case-insensitive per CONTEXT §10 (mitigates display-name impersonation; NULLs remain distinct so existing
    ratings.unique(user_id, location_id) is unaffected).
    Migration 3 (auth_rpcs): `check_display_name_available(name text) returns boolean language sql security definer
    set search_path = public as $$ select not exists (select 1 from users where lower(display_name) = lower(name)); $$;`
    granted to `anon` and `authenticated` (pre-signup check). And `set_gps_consent() returns void language plpgsql
    security definer set search_path = public as $$ begin if auth.uid() is null then raise exception 'not authenticated';
    end if; update public.users set gps_consent = true, gps_consent_at = now() where id = auth.uid(); end; $$;` granted to
    `authenticated` only (mitigates T-02-04: consent written server-side, only via this RPC). Each migration opens with the
    header-comment block (phase + the live-schema gap it closes) and `-- ─── N. Title ──` dividers per PATTERNS.
    Then run `cd supabase && supabase db push` to apply to the live project. This task is [BLOCKING]: 02-01b must not
    start until the push succeeds (the screens call these RPCs and rely on the trigger).
  </action>
  <acceptance_criteria>
    - `grep -n 'handle_new_user' supabase/migrations/20260627000000_handle_new_user_trigger.sql` and `grep -n 'after insert on auth.users' -i supabase/migrations/20260627000000_handle_new_user_trigger.sql` both match.
    - `grep -n 'lower(display_name)' supabase/migrations/20260627000001_display_name_unique_index.sql` matches.
    - `grep -n 'check_display_name_available' supabase/migrations/20260627000002_auth_rpcs.sql` and `grep -n 'set_gps_consent' supabase/migrations/20260627000002_auth_rpcs.sql` both match, each followed by a `grant execute` line.
    - `supabase db push` completes with no error and reports the three new migrations applied (paste output into SUMMARY).
    - Supabase MCP confirms `users_display_name_lower_uniq` exists and `set_gps_consent`/`check_display_name_available` are callable.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → build | Third-party package code enters the trusted build |
| client → Postgres RPC | Consent + display-name-availability writes/reads cross into elevated SECURITY DEFINER functions |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-PROV | Elevation of Privilege | profile row creation | mitigate | No client INSERT on users (no INSERT RLS policy); profile created only by SECURITY DEFINER handle_new_user trigger (Task 4). |
| T-02-SC | Tampering | npx expo install react-native-gesture-handler | mitigate | [ASSUMED] package gated behind blocking-human checkpoint (Task 1) verifying npmjs maintainer/repo/no-postinstall; Expo-resolved pin only. |
</threat_model>

<verification>
- `cd app && npm test` exits 0 after harness changes (existing suites still green).
- `supabase db push` applied the three Wave 0 migrations; Supabase MCP confirms trigger, unique index, and both RPCs.
- `grep -n 'minimum_password_length = 8' supabase/config.toml` matches.
- Token files all present and TypeScript-clean (`npx tsc --noEmit`).
- jest@29.7.0 still pinned (not upgraded by any install step).
</verification>

<success_criteria>
- Foundation layer complete: packages, babel, config, token files, Wave 0 migrations all applied.
- 02-01b can now begin: token constants importable, RPCs callable, trigger live.
- LEGAL_URLS status surfaced in SUMMARY (placeholder or live Termly URLs).
</success_criteria>

<output>
Create `.planning/phases/02-auth-profiles/02-01a-SUMMARY.md` when done (record supabase db push
output, Termly URL status, and jest version after install).
</output>
