# Stale Information Scan - 2026-07-03

Trigger: Phase transition (Phase 2 execution complete, verification pending) + full project audit 2026-07-03
Branch: master
Commit: 9986c4e (audit bookkeeping fixes)
Next review due: 2026-08-02 — or at the Phase 2 → Phase 3 transition if that comes first (a transition triggers its own scan per docs/stale-info-scan.md)

## Commands Run

- `git status --short` — 25 working-tree entries, all accounted for: the in-flight audit-cleanup code batch awaiting Antigravity+Codex review (8 deletions in `app/components/`, `app/constants/Colors.ts` → `app/src/constants/Colors.ts` move, 11 import-path edits, tsconfig/eslint exclusion cleanup), regenerated `.claude/*-prompt-latest.md` packets, and draft `.planning/project-audit-2026-07-03.md`. No unexplained drift.
- `git log --oneline -8` — latest: 9986c4e (audit bookkeeping), e504607 (Plan 02-02 savepoint), c33bc1a (WU-02-T6 test)
- `rg -n "Gemini|gemini-review|GEMINI\.md|file:///" AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .planning .claude` — no Gemini workflow instructions remain (only the scan pattern itself in docs/stale-info-scan.md and historical attribution in .planning/research/ARCHITECTURE.md:220,316). `file:///` links found in `.claude/antigravity-review-latest.md:28` and `.claude/skills/*.md` (see WATCH).
- `rg -n "service_role|EXPO_PUBLIC|NEXT_PUBLIC|eyJ|sk\." app supabase docs` — 56 matches, all benign: RLS/service-role policy patterns in migrations, `EXPO_PUBLIC_*` env var NAMES in `app/jest.setup.ts` / `app/src/lib/supabase.ts` / its test (no values), one `eyJ`-substring false positive inside a sha512 integrity hash in `app/package-lock.json`. No literal secrets.
- `rg -n "stale-info-scan|agent-harness|codex-prompt-latest|antigravity-review-latest|codex-review-latest|review-queue" ...` — harness artifact references consistent across AGENTS.md, AGENTS_ROSTER.md, CLAUDE.md, CODEX.md, ANTIGRAVITY.md, docs/agent-harness.md, hooks, and all four slash commands (`/antigravity-review`, `/codex-prompt`, `/review-gate`, `/stale-info-scan` all exist in `.claude/commands/`).
- `rg -n -i "claude-(opus|sonnet|haiku|fable|mythos)-[0-9]"` (excl. lockfiles/node_modules) — only hits are the alias examples in docs/stale-info-scan.md:102 and `.planning/config.json` `model_profile_overrides`. No dated snapshot IDs anywhere.
- `claude-api` skill model catalog consulted — `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5` are all Active, current-tier aliases with no same-tier successor (Fable 5 is a separate above-Opus tier, not an Opus successor). Catalog cache date 2026-06-24.
- `app/package.json` inspected — scripts (`test`, `test:coverage`, `typecheck`, `lint`) match docs/verification.md; expo ~55.0.26, react-native 0.83.6, react 19.2.0, jest 29.7.0 (pinned), jest-expo ^55.0.18, @rnmapbox/maps ^10.3.1, @supabase/supabase-js ^2.106.0, TanStack Query 5, zustand 5, zod 4, msw 2 — all consistent with CLAUDE.md / PROJECT.md constraints.
- `supabase/config.toml` inspected — present, project_id "Gotta_Go", standard local config.
- `supabase/migrations/` listed — 12 migrations, latest 20260701211135_profile_stats_rpc.sql.
- `app/src/lib/database.types.ts` grepped — generated types include `get_profile_stats`, `update_profile`, `delete_account`, `check_display_name_available`; types are fresh through the latest migration. ✓
- Review artifacts inspected: `.claude/review-queue.txt` (14 files, matches the uncommitted batch), both `*-prompt-latest.md` (current audit-cleanup packet, full Prompt Packet Requirements met, no secrets), both `*-review-latest.md` (prior WU-02-T6 APPROVEs — see WATCH).
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `SPEC.md`, `docs/schema-contract.md` read and cross-checked.

## BLOCKING STALE INFO

- None.

## UPDATE REQUIRED

1. **`docs/schema-contract.md` alignment claim is stale relative to six newer migrations** — Header (docs/schema-contract.md:3) says "aligned with live schema as of 2026-06-24", but six migrations landed after that date: `20260627000000_handle_new_user_trigger`, `20260627000001_display_name_unique_index`, `20260627000002_auth_rpcs`, `20260627000003_nullable_user_fks`, `20260627000004_profile_rpcs`, `20260701211135_profile_stats_rpc`. The contract was partially updated (users-table rules at docs/schema-contract.md:60 reference the SECURITY DEFINER profile-update RPC), but it does not document: the `handle_new_user` provisioning trigger, the `check_display_name_available` / `set_gps_consent` / `update_profile` / `delete_account` / `get_profile_stats` RPCs, or the Phase-2 FK change that made 7 user-FK columns nullable with ON DELETE SET NULL (GDPR erasure path — data-model-relevant for every table section it touches, e.g. `submissions.submitter_id`, `ratings.user_id`). Reviewers and the Phase 3 planner read this contract as the schema reference. Required: refresh the alignment date and reconcile the affected table/RPC sections before Phase 3 planning. (Generated `database.types.ts` IS current, so this is a docs-only gap, not a types gap.)

2. **`.planning/PROJECT.md` evolution items due at the imminent Phase 2 transition** — (a) Footer (.planning/PROJECT.md:182) still says "Last updated: 2026-05-18 after initialization" although content includes 2026-07-01 audit decisions. (b) Every Key Decisions row still shows outcome "— Pending" (lines 140–155), including decisions that are implemented and operating (React Native/Expo, Supabase+PostGIS, Mapbox, jest pin, multi-agent review, 2-verification threshold design). PROJECT.md's own Evolution section requires outcome/requirement updates at each phase transition — Phase 2 verification is the next gate. Required: run the PROJECT.md evolution pass (outcomes, footer date, any validated requirements) when Phase 2 closes.

## WATCH

3. **STATE.md `total_phases: 12` vs 11 phase checkboxes in ROADMAP.md** — `.planning/STATE.md:8` says 12 total phases; `.planning/ROADMAP.md` lists 11 (`1, 1.5, 2–7, 7.5, 8, 9`). `percent: 17` was computed from 12 (2/12), so the counters are internally consistent with 12 but not with the visible roadmap. The `completed_phases` undercount from the prior scan WAS fixed (now 2); this residual denominator mismatch is either a GSD counting convention or a leftover. Verify/correct at Phase 2 verification.

4. **Review verdict artifacts currently lag the prompt packets (expected mid-cycle state, gate condition)** — `.claude/antigravity-prompt-latest.md` and `.claude/codex-prompt-latest.md` correctly describe the pending audit-cleanup batch (scope matches `.claude/review-queue.txt` exactly), but `.claude/antigravity-review-latest.md` and `.claude/codex-review-latest.md` still hold the prior WU-02-T6 APPROVE verdicts. This is normal while the review is pending — but the uncommitted batch MUST NOT commit until both reviewers return fresh verdicts against the current packets. Clears itself when the review gate runs.

5. **`file:///` absolute links** — `.claude/antigravity-review-latest.md:28` (Antigravity emits these by design; file is overwritten per review) and `.claude/skills/*.md` (six files use `file:///C:/Users/mrsai/...` links intentionally for Antigravity's `view_file` navigation). Portability-only concern if the repo ever moves paths or machines; no action now. Carried over from prior scans.

6. **ROADMAP.md Phases 3–9 plan checkboxes unchecked / plans not yet written** — expected placeholders for future phases, not drift. Revisit at each phase transition.

## CURRENT

- **Agent harness consistency** — AGENTS.md, AGENTS_ROSTER.md, CLAUDE.md, CODEX.md, ANTIGRAVITY.md, and docs/agent-harness.md agree on roles (Claude orchestrator/implementer; Antigravity architecture/PostGIS/RLS/trust; Codex implementation/security/tests), artifact names, verdict definitions, and output formats. All referenced slash commands exist. ✓
- **Gemini remnants** — ANTIGRAVITY.md is now model-agnostic ("regardless of which underlying model powers Antigravity"); no `/gemini-review` or GEMINI.md instructions anywhere in active workflow docs. Remaining "Gemini" strings in `.planning/research/ARCHITECTURE.md:220,316` are historical attribution of prior SYSTEM_MAP.md feedback, not instructions. ✓
- **Prompt packet quality** — both current packets satisfy docs/agent-harness.md § Prompt Packet Requirements: task goal, changed files matching review-queue.txt, why/context, verification claims (typecheck 0 errors), dependency call chains, runtime-boundary/mock audit sections, output format; no secrets or location data. ✓
- **Claude model drift** — `.planning/config.json` overrides use current active aliases (opus-4-8 / sonnet-5 / haiku-4-5), no dated snapshots, no retired IDs; verified against the claude-api skill catalog. ✓
- **Secrets/privacy** — no `.env` values, service-role keys, JWTs, tokens, real emails, or precise coordinates committed or present in reviewer prompts. `app/.env.local` not tracked. ✓
- **Schema types freshness** — `app/src/lib/database.types.ts` includes all RPCs through the 2026-07-01 migration. ✓
- **Dependencies & verification commands** — package.json scripts match docs/verification.md (including Windows `npm.cmd` guidance); jest@29.7.0 pin, jest-expo@55 pairing, coverage thresholds paired files (root + app) all intact per CLAUDE.md. ✓
- **Planning/status accuracy** — ROADMAP Phase 2 correctly unchecked with all three plans (02-01a, 02-01b, 02-02) checked; STATE.md resume signal accurately states Phase 2 verification is the next step and no VERIFICATION.md exists yet. Completed work is not described as future work. ✓
- **Product/brand** — SPEC.md and PROJECT.md agree on "certainty under urgency", target users (IBS/Crohn's, wheelchair users, parents), global proof-of-concept launch (no hardcoded city), community-reported liability framing, and out-of-scope items. Watch the Gap four-gate framing intact. ✓
- **In-flight working tree** — the uncommitted changes are the documented, packet-described audit-cleanup batch awaiting the review gate (plus the draft audit report), not unexplained drift. ✓

## Resolved Since 2026-06-27 Scan

- **UR#1 (15 uncommitted strategy-shift files)** — RESOLVED. Committed via the 2026-07-01/02 commit series; PROJECT.md, ROADMAP.md, research docs, and STATE.md are all tracked and current. Working tree now contains only the reviewed audit-cleanup batch.
- **UR#2 (`.claude/antigravity-prompt-latest.md` said "Gemini 3.5")** — RESOLVED. Packet regenerated for the current review; no model-identity strings remain.
- **W#3 (ANTIGRAVITY.md "Gemini 3.5" ×3)** — RESOLVED in 9986c4e; capability section now model-agnostic.
- **W#4 (stale "Last reviewed: 2026-05-20" dates)** — RESOLVED in 9986c4e; docs/agent-harness.md and docs/stale-info-scan.md both now "Last reviewed: 2026-07-03".
- **W#6 (STATE.md untracked, completed_phases undercount)** — RESOLVED. STATE.md is tracked and `completed_phases: 2` counts Phase 1.5. (Residual `total_phases` denominator question → new WATCH #3.)
- **W#5 (file:/// links in antigravity-review-latest.md)** — NOT resolved, reclassified: the file is overwritten per review and Antigravity emits file:/// links by design; carried forward as WATCH #5.

## Blocked Checks

- **Live Supabase schema** — not verified against the live project (no credentialed Supabase query run during this scan). Migrations + freshly generated `database.types.ts` used as proxy evidence; they are internally consistent.
- **App test suite** — not re-run inside this scan. Verification evidence from earlier this session (2026-07-03): 25 suites / 200 tests passing, 0 typecheck errors, 0 lint errors. Recorded as session evidence, not scan-run output.
- **External doc freshness** (Expo SDK 55, Mapbox SDK 11.x, @supabase/supabase-js 2.106) — not rechecked; no dependency changes since the decisions were made, so not decision-affecting this cycle.
- **Anthropic model catalog** — checked via the claude-api skill's cached catalog (cache date 2026-06-24), not a live platform.claude.com fetch; nine days old, low drift risk for alias-level status.
