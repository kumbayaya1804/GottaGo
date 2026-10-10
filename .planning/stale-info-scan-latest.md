# Stale Information Scan - 2026-10-09

Trigger: monthly cadence (previous scan 2026-07-31, about 70 days old, and harness-scoped only) plus
the harness, schema, and dependency changes since then: metaswarm removed (`475b57b`),
`review-packets.js` and the low tier (`bbc8208`), plan 05-02 merged and live (`f0768c5`, migrations
`20260731000000` to `20260731000300`), `database.types.ts` regenerated (PR #2, `66e992a`), state
trim and archive (`ffe7921`), docs fixes (`b2e0b64`), skills moved to `.claude/skills/<name>/SKILL.md`
with three new skills (PR #3, `712e827`), BOM/lint cleanup (PR #4, `fed5ff6`). This is a full-scope
scan: harness, product, schema, dependencies, planning, security/privacy.
Branch: detached worktree `.claude/worktrees/scan` at master
Commit: e546a0a
Next review due: 2026-11-08, or sooner: before `/gsd-execute-phase` runs 05-04, 05-05, or 05-06 (the
BLOCKING item below), before `/gsd-plan-phase 6` (the `confidence_floor` item), and after any merge
that touches `supabase/migrations`.

Scope rules applied: historical files (`.planning/archive/**`, `.planning/STATE-ARCHIVE.md`,
`.planning/phases/0[1-4]*/**`, dated audits and handoffs) are treated as provenance and not flagged.
Archived reviewer verdicts (`.claude/reviews/**`, `.claude/*-review-latest.md`) were excluded from
every search and not opened. The startup sections of `CLAUDE.md`, `AGENTS.md`, and
`docs/context-router.md` are being rewritten on branch `chore/startup-context-routing`. Their master
wording was checked only for being wrong today, and it is not wrong.

## Commands Run

- `git status --short`, `git diff --name-only`: clean worktree at `e546a0a`, no diff.
- Standard drift-marker `rg` (`Gemini|gemini-review|GEMINI\.md|file:///|TODO|TBD|deprecated|outdated|Last reviewed`)
  over `AGENTS.md AGENTS_ROSTER.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .planning .claude`, excluding
  review archives, history files, and vendored Supabase skills. Hits: `docs/legal/README.md` TODOs, ROADMAP
  `TBD` plan lists for unplanned phases, and self-referential scan vocabulary. No Gemini text in the searched
  set. (The standard list omits root `CONTEXT.md`, which does contain Gemini text; see UPDATE REQUIRED.)
- Standard secret/env `rg` (`service_role|EXPO_PUBLIC|NEXT_PUBLIC|eyJ|sk\.|lat|lng|gps_lat|gps_lon`) over
  `app supabase docs`. `service_role` appears only in migrations (policies and comments). `EXPO_PUBLIC_*` is
  only the Supabase URL, anon key, and Mapbox public token. No `eyJ`/`sk.` tokens (the only `eyJ` hit is inside
  a package-lock integrity hash). `lat`/`lng` hits are RPC parameters and return columns only, with no
  persisted plain coordinate columns.
- Standard harness-artifact `rg` (`stale-info-scan|agent-harness|codex-prompt-latest|...|review-queue`): artifact
  names consistent across the root agent files, docs, commands, and hooks.
- `rg --hidden` sweeps (a plain `rg ... .` skips `.planning/.claude/.beads`, so every repo-wide search was
  re-run with `--hidden`) for `metaswarm`, `tdd[- ]guard`, GSD command names (`gsd:` and `/gsd-`), old flat
  skill filenames, and every `.claude/skills/...` path reference.
- Read in full: `docs/agent-harness.md`, `docs/verification.md`, `docs/SYSTEM_MAP.md`, `SPEC.md`,
  `CONTEXT.md`, `AGENTS_ROSTER.md`, `README.md`, all four `.claude/commands/*.md`,
  `.claude/skills/SKILL.md`, `review_packet_generator.md` (first 120 lines), `trust-engine-validator/SKILL.md`,
  `.github/workflows/ci.yml`, `.github/workflows/phase5-db-verify.yml` (steps), `.claude/settings.json`, both
  Antigravity policy and contract JSON files. Targeted sections: `CODEX.md`, `ANTIGRAVITY.md` headings,
  `.planning/PROJECT.md`, `.planning/ROADMAP.md` (Phases 5-6, progress), unexecuted Phase 5 plans
  (`05-03`..`05-06`, `05-VALIDATION.md`), `check-review-artifacts.js` (requirements and tier tables),
  `review-packets.js` (risk handling), `harness-hooks.js` (stale-scan check).
- `cat app/package.json`, `cat package.json`, `supabase/config.toml` (project_id, major_version 17).
- Generated types check: `app/src/lib/database.types.ts` contains `confidence_value`, `verify_location`,
  `search_pending_submissions_nearby`, `get_my_unseen_submission_publications`,
  `acknowledge_submission_publication`, `notification_outbox`, `confidence_tier_for`, and no retired
  `get_locations_in_radius`/`count_locations_within`.
- `diff -rq` of `.claude/skills/supabase*` against `.agents/skills/supabase*`: identical.
- `node --test .claude/hooks/harness-hooks.test.js .claude/hooks/check-review-artifacts.test.js .claude/hooks/review-packets.test.js supabase/scripts/run-isolated-db-suite.test.js scripts/os-portability.test.js`:
  179 tests, 173 pass, 0 fail, 6 skipped (platform skips on macOS), about 472 s.
- **Live Supabase (read-only):** Supabase MCP `list_migrations` against project `ebmzhjmmtmldhrojkdqw` (bound
  in `.mcp.json`): 34 applied migrations, matching the 34 files in `supabase/migrations/` by version and name,
  through `20260731000300_phase5_verify_and_publish`.
- **npm registry (read-only):** `cd app && npm outdated --json` (no `node_modules` in the worktree, so it shows
  wanted vs latest only). Notable: `expo` wanted 55.0.31, latest 57.0.27 (every `expo-*` module is likewise
  two majors behind); `react-native` 0.83.6 vs 0.87.1; `react` 19.2.0 vs 19.3.0;
  `@react-native-async-storage/async-storage` 2.2.0 vs 3.1.1; `react-native-gesture-handler` 2.30.1 vs 3.3.0;
  `react-native-worklets` 0.7.4 vs 0.13.0; `geolib` 3.3.14 vs 4.0.0. `@supabase/supabase-js`, TanStack Query,
  Zustand, `@rnmapbox/maps` (10.3.7), zod, and react-hook-form are current within their ranges.

## BLOCKING STALE INFO

- **Unexecuted Phase 5 plans give a pre-merge `supabase db push` as the production deploy step.**
  `.planning/phases/05-trust-engine-verification/05-04-PLAN.md:138,142,148,150`, `05-05-PLAN.md:236`, and
  `05-06-PLAN.md:112` tell the executor to run `supabase db push` (then `supabase gen types`) during plan
  execution. The current deploy path is different: a merge to `master` is the production deploy of
  `supabase/migrations`, through the Supabase GitHub integration (production branch `main` is bound to git
  `master`). Sources: `.beads/context/execution-state.md:9,45`, and 05-02 was applied this way
  (`.planning/archive/execution-state-history.md:10`). A CLI push from a feature branch puts a migration live
  before the review gate and PR merge. If review then changes that file, the integration skips the
  already-recorded version, and live and repo diverge under the same version number. That is a schema/RLS
  mistake risk.
  **Fix before executing 05-04, 05-05, or 05-06:** replace each push checkpoint with "merge the reviewed PR
  (explicit authorization for a production deploy), verify with read-only `list_migrations`/`execute_sql`,
  then regenerate types in their own reviewed batch" (the PR #1 to PR #2 pattern). Also record the
  deploy-on-merge rule in a durable active doc, either `docs/verification.md` § Supabase or
  `docs/schema-contract.md`. Today it lives only in `execution-state.md`.
  `.beads/context/project-context.md:12` still says "`supabase db push` **works**" as the push method. Mark it
  superseded in the same batch. 05-03 has no push step and is not affected.

## UPDATE REQUIRED

- **`docs/SYSTEM_MAP.md` still describes the pre-Phase-5 system.** `:3-4` (status "Phase 4 close", updated
  2026-07-10); `:11` says `confidence_score`/`confidence_tier` text tiers are the confidence fields, but
  the authority is now `locations.confidence_value numeric` 0-100 with the tier derived by
  `confidence_tier_for()`, and the text columns are commented DEPRECATED
  (`supabase/migrations/20260731000100_phase5_confidence_numeric.sql:61-72,154-160`); `:15` "relationship not
  yet reconciled"; `:28` and `:30-32` say "Verification/trust-engine RPCs are NOT yet built" and "The Trust
  Engine — NOT YET BUILT". Live today: `search_pending_submissions_nearby` (`20260717120100`), `verify_location`,
  the rewritten `submit_location`/`withdraw_submission`, `get_my_unseen_submission_publications`,
  `acknowledge_submission_publication` (`20260731000300`), `notification_outbox` (`20260731000200`). The live
  ledger was confirmed this scan. Refresh §1-§3 and add an audit-log row. (This is separate from the tracked
  schema-contract todo.)
- **`ROADMAP.md:242` (Phase 6 success criterion 1) puts the decay floor at `app_config.confidence_floor`.** That
  key is `0.05` on the old 0-1 scale (`20260519020000_fix_schema.sql:26`). The migration that created the
  0-100 authority says `confidence_floor` "is NOT valid for 0-100 math" and seeds `confidence_floor_value = 5`
  for Phase 6's decay job (`20260731000000_phase5_app_config_seeds.sql:68-75,97-98`). Planning Phase 6 against
  this criterion would floor at effectively zero and break criterion 2 ("No location reaches confidence 0").
  Change it to `app_config.confidence_floor_value` and say the decay applies to `locations.confidence_value`.
  Fix before `/gsd-plan-phase 6`.
- **`.planning/PROJECT.md` describes shipped Phase 5 work as future, and the 48-hour route as live policy.**
  `:131` "Minimum 2 independent GPS verifications (or 1 + 48hr no-flag window)". Current fact: publication
  needs the creator's implicit claim plus one currently-eligible independent verifier
  (`ROADMAP.md:198,212`), and the 48-hour route is an unmeasurable, unscheduled fail-closed stub
  (`ROADMAP.md:231,300`). `:147` "2-verification publish threshold ... not yet built; no pending-to-published
  transition function exists yet". In fact `verify_location` reads `submission_publish_threshold` and publishes
  (`20260731000300_phase5_verify_and_publish.sql:76,133`) and has been live since 2026-09-28. `:184` footer
  says last updated 2026-07-10, but the file was edited in `ffe7921`.
- **Workflow docs name GSD commands that the frozen `core` profile does not install.** The installed set is
  `gsd-discuss-phase`, `gsd-plan-phase`, `gsd-execute-phase`, `gsd-phase`, `gsd-help`, `gsd-new-project`
  (`CLAUDE.md:18-20`, `AGENTS_ROSTER.md:69-74`). Missing commands referenced: `.planning/PROJECT.md:163`
  (`/gsd-transition`) and `:171` (`/gsd:complete-milestone`), the process steps for phase and milestone
  closure, which carry the stale-scan obligation; `.planning/phases/05-trust-engine-verification/05-VALIDATION.md:32`
  (`/gsd:verify-work`; `AGENTS_ROSTER.md:74` routes verification to Superpowers instead). Reword to the
  current entry points (`gsd-phase` or a manual step, and `superpowers:verification-before-completion`).
- **`SPEC.md` status and open decisions are out of date.** `:3` says the rules are captured "before
  implementation exists". Phases 1-4 and 05-01/05-02 are implemented. `:169-179` "Open Product Decisions"
  still lists items that are decided. GPS radius and accuracy are locked in `app_config` (`max_accuracy_m` 50,
  `verify_radius_m` 100, `max_gps_age_s` 60: `20260519020000_fix_schema.sql:22-24`, D-01). Anonymous
  contribution is refused (`auth.uid() is null` check, `20260731000300...sql:508`). The trust formula is
  D-48/D-49 (`trust_multiplier_step`, `20260731000000...sql:101`). Raw-GPS retention is 30 days
  (`raw_gps_retention_days`, D-40). Mark each one decided with its source, keep the ones still open (moderator
  tooling, respect-signal formula, final decay job), and update the status line. Full-tier file.
- **Root `CONTEXT.md` (the glossary, which says "AI agents start every session" with it) has stale roles and
  schema terms.** `:185-191` lists "Gemini CLI" and "Codex App" as reviewers. The current reviewers are
  Antigravity (`agy`) and Codex (`codex exec`), per `AGENTS.md:16-21`. `:145-146` calls the coordinate type
  "Geometry", but `locations.coordinates` is `geography` (`20260519010000_remote_schema.sql:68`). `:71`
  "Confidence Score (0-100)": the 0-100 field is `confidence_value`, and `confidence_score` is a deprecated
  text tier. `:74` tiers `high/medium/low/unknown`: they are actually `High/Medium/Low`, derived by
  `confidence_tier_for()`. `:50` example radius "50 meters": `verify_radius_m` is 100. `:195` last updated
  2026-06-21. Also add `CONTEXT.md` to the standard search list in `docs/stale-info-scan.md:136` and
  `.claude/commands/stale-info-scan.md:33`. Its absence is why the Gemini line survived earlier scans.
- **`docs/agent-harness.md:166-171` Minimum Commit Gate requires the Antigravity verdict without exception.**
  This contradicts the low tier described in the same file (`:76`, `:83`), in `AGENTS.md:42`, and in the gate
  (`check-review-artifacts.js:819`). Make `:169` conditional ("full tier only"). Full-tier file.
- **`docs/verification.md:30-35` lists an incomplete set of harness tests.** It omits
  `.claude/hooks/review-packets.test.js` (run in CI, `ci.yml:55`) and
  `supabase/scripts/verify-confidence-backfill-binding.test.js` (run in CI, `phase5-db-verify.yml:27`). Add
  both. (`execution-state.md:56` already uses the `.claude/hooks/*.test.js` glob.) Low tier.

## WATCH

- **The stale-scan reminder uses file mtime, not the scan date.** `.claude/hooks/harness-hooks.js:316` checks
  `statSync(scan).mtimeMs`, so any edit to the report (for example the 2026-09-07 follow-up note) or a fresh
  clone or worktree checkout resets the 30-day clock. The 2026-07-31 scan went about 70 days without a
  reminder. `docs/stale-info-scan.md:21` describes it as "older than 30 days". Consider parsing the
  `# Stale Information Scan - YYYY-MM-DD` header (hooks batch, full tier; another session is editing this file
  now).
- `docs/agent-harness.md:4` "Last reviewed: 2026-07-30" although the file was substantively changed
  2026-09-28 (low tier) and 2026-10-09 (skills).
- `docs/agent-harness.md:218` "Also disclosed (2026-09-26, not yet accepted or rejected by the user)": the
  packet-scanner heuristic still has no user decision after two weeks.
- `docs/agent-harness.md:44-45`, `AGENTS_ROSTER.md:41,59`, `CODEX.md:13` say "Claude writes" the packets.
  `review-packets.js` writes them from Claude's claims file (`CLAUDE.md:31`). Wording only.
- `.claude/commands/codex-prompt.md:15` claims template shows `risk_level: medium|high` and omits `low`,
  although the script accepts `low` (`review-packets.js:100`) and the low tier requires declaring it (`:40` of
  the same command). Following the template literally only costs an extra reviewer.
- `CODEX.md:41-44` contains the Antigravity CLI `default-cli-project` permission-persistence workaround (copied
  from `ANTIGRAVITY.md:60-63`). It is not a Codex CLI fact. Drop it or rephrase.
- `docs/review-severity.md` has no follow-up rule (findings only in unchanged lines are `NOTE (follow-up)`),
  although `agent-harness.md:81`, `CODEX.md`, `ANTIGRAVITY.md`, and `review-packets.js:77` do. No
  contradiction yet.
- `.planning/ROADMAP.md:204-205` still says "document intended range before Phase 5 weight calculations". That
  is done (D-48: multiplier 0.5 to 1.0, `trust_multiplier_step`). `:381` refers to `/gsd:review-backlog`
  (backlog only, and not installed).
- `.beads/plans/active-plan.md:9-10,25` still describes Phase 3 planning. It is marked
  `status: no-active-plan` and declared non-authoritative (`CLAUDE.md:73`), so it is harmless while that rule
  holds.
- `.claude/codex-security-investigation-prompt.md`: a one-off 2026-07-05 investigation packet in an active
  location (Windows path at `:5`; lists removed `.metaswarm/*` and old flat skill files at `:50-63`). Only
  referenced by the `scripts/os-portability.test.js:33` allowlist. Candidate to move to `.planning/archive/`.
- Leftover names, harmless: `check-review-artifacts.js:38` still protects `.claude/tdd-guard/`;
  `check-review-artifacts.test.js:1668` uses `.metaswarm/profile.json` as a full-tier fixture.
- CI's `harness-portability` job (`ci.yml:50-57`) does not run `probity.config.test.js` (listed in
  `docs/verification.md:33`).
- Dependencies: Expo SDK 55 is two majors behind the registry's latest (57). React Native 0.83 vs 0.87.
  Several native modules have new majors that are SDK-gated. An SDK upgrade is a planned decision, not drift.
  Expo's support window for SDK 55 was not verified. Re-check before TestFlight/09-03. `PROJECT.md:130`
  "`@rnmapbox/maps` ^10.1.x" vs installed range ^10.3.1 (minor).
- `docs/legal/README.md:12,18-19`: Termly public URLs are still TODO placeholders. Must be filled before
  store submission.
- `.claude/antigravity-review-policy.json`: still `mode: probation`, `calibrationStatus: not_run` (intended,
  unchanged). `.claude/reviews/` now holds 52 scope directories, 1.1 MB.
- Committed packets on master are the PR #2 round (`generated_at 2026-09-29`) and carry a correct `RETIRED ...
  committed as 66e992a` first line. Later batches' packets were not committed to master. That is fine while
  the retire header is present.

## CURRENT

- Roles agree across `AGENTS.md`, `AGENTS_ROSTER.md`, `CLAUDE.md`, `docs/agent-harness.md`, `CODEX.md`,
  `ANTIGRAVITY.md`: Claude implements, Codex is approval-bearing, Antigravity is advisory in probation.
- Low-tier rule text is identical in `AGENTS.md:42`, `CLAUDE.md:34`, `AGENTS_ROSTER.md:82`,
  `docs/agent-harness.md:76`, `.claude/commands/codex-prompt.md:40`, `antigravity-review.md:5`, and matches
  `check-review-artifacts.js` `LOW_RISK_PATTERNS`/`FULL_RISK_OVERRIDES` and `review-packets.js:273-278`.
- Codex and Antigravity verdict-format sections match the gate's `ARTIFACT_REQUIREMENTS` headings and
  required text (`check-review-artifacts.js:62-110`) and the generator's section lists (`review-packets.js:67-68`).
- metaswarm is gone from active docs, hooks, settings, and CI. The only active mention is the deliberate
  historical note in `docs/verification.md:37`.
- Probity references are consistent (`CLAUDE.md:56`, `agent-harness.md:240`, `probity.config.ts`, root
  `package.json` `@nizos/probity ^1.10.0`, protected by `check-review-artifacts.js:47`).
- Skill layout: all seven domain skills sit at `.claude/skills/<name>/SKILL.md`. The three workflow skills
  (`artifact_qa_gate.md`, `review_packet_generator.md`, `stale_info_scan.md`) stay flat, and every reference
  to them resolves. Every link in the `.claude/skills/SKILL.md` index resolves. Files the skills reference
  exist. The vendored Supabase skills in `.claude/skills/` and `.agents/skills/` are byte-identical.
- Schema: the live migration ledger (34) equals the repo (34). `database.types.ts` reflects every Phase 5
  object. Coordinates are stored only as PostGIS `geography` (`locations.coordinates`,
  `verification_events.gps_location`). There are no persisted plain lat/lng columns. `service_role` is never
  referenced in `app/`. The client reads only `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` and
  `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`.
- Product framing agrees across `SPEC.md:7`, `.planning/PROJECT.md:13`, `docs/watch-the-gap.md:80`,
  `README.md`: "certainty under urgency", global proof-of-concept availability, and no hardcoded launch city
  (`ROADMAP.md:295`).
- `.planning/STATE.md` frontmatter and position (Phase 5, 05-03 next, 20/37 plans) match `ROADMAP.md:226-231,396`
  and `execution-state.md:9-14`. `README.md` defers status to STATE (no duplication). Tech-stack versions in
  `README.md:34` and `PROJECT.md:130` (SDK 55, RN 0.83, React 19.2) match `app/package.json`.
- `docs/verification.md` app commands match `app/package.json` scripts and CI. Isolated-runner requirements
  match `phase5-db-verify.yml`.
- `.claude/settings.json` hooks match the `harness-hooks.js` subcommands. The Stop hook still runs
  `stop-stale-scan`.

## Tracked Elsewhere (not re-raised)

- `.planning/todos/pending/2026-10-09-phase5-caller-role-access-tests.md`: discovery/verify pgTAP never
  `SET ROLE`; anon denial unproven.
- `.planning/todos/pending/2026-10-09-gps-consent-silent-failure.md`: `gpsConsent.ts` returns granted on a
  failed save.
- `.planning/todos/pending/2026-10-09-stage-queue-lstat-error-handling.md`: non-ENOENT `lstat` errors treated
  as absence.
- `.planning/todos/pending/2026-10-09-schema-contract-snapshot-refresh.md`: `docs/schema-contract.md` is still
  the July snapshot.
- `.planning/todos/pending/2026-10-09-mapscreen-act-warning.md`: test-only act warning.
- `.planning/todos/pending/2026-10-09-design-system-colors-description.md`: `docs/design/design-system.md:4`
  "5-token placeholder".
- The startup-section rewrite of `CLAUDE.md`/`AGENTS.md`/`docs/context-router.md` is in review on
  `chore/startup-context-routing`.

## Deferrals

- None recorded by this scan. Every BLOCKING and UPDATE REQUIRED item above is open for Claude (owner) to fix
  or defer explicitly. The BLOCKING item gates 05-04, 05-05, and 05-06 execution. The `confidence_floor` item
  gates Phase 6 planning.

## Blocked Checks

- App `npm run lint`, `npm run typecheck`, `npm test`: not run. The scan worktree has no `node_modules`, and
  installing would write outside the single permitted output file. Last recorded result: 46 suites / 397 tests,
  tsc and eslint clean (`execution-state.md:55`, 2026-10-09).
- `node --test probity.config.test.js`: not run (needs root `node_modules` for `@nizos/probity`).
- pgTAP / isolated DB suites: not run (scan scope is read-only; needs OrbStack/Docker).
- Live Supabase beyond the migration ledger (live RLS policies, grants, function bodies vs repo): not checked.
  Only `list_migrations` ran.
- Reviewer verdict and packet pairing (`stale-info-scan.md:106`): verdict files were deliberately not opened.
  Pairing is inferred only from the packets' RETIRED header.
- Expo SDK support policy, Mapbox SDK deprecation status (`.planning/research/STACK.md:189`), and app-store
  requirements: no external documentation was consulted.
