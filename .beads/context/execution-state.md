# Execution State
<!-- updated: 2026-10-09: stale-state cleanup. Everything before this date (save points 2026-07-05 to 2026-09-28) is preserved verbatim in `.planning/archive/execution-state-history.md`. -->

## Resume here (2026-10-09)

Plan for this stretch (approved 2026-10-09): `~/.claude/plans/nested-petting-sun.md`, Steps 1-6, then product work. Status dashboard (static snapshot, v9 from 2026-09-28): https://claude.ai/artifact/BCaNAugM3bHtYwhuFyRzJc.

**Where things stand:**
- **Phase 5:** 05-01 and 05-02 complete. 05-02 merged to master (`f0768c5`, PR #1) and its four migrations (`20260731000000` to `20260731000300`) are LIVE, verified by read-only queries. A merge to master IS a production deploy of `supabase/migrations` (the Supabase GitHub integration binds production branch `main` to git `master`).
- **Step 1 DONE: 05-02 Task 4 types batch** committed `66e992a` (Codex APPROVE, Antigravity ADVISORY; scope `sha256:a747ea14…`), merged via PR #2 (`7990928`), CI green on all OSes. `database.types.ts` now matches the live 14-argument `submit_location`; app builds are unblocked.
- **Step 2 (this save point):** STATE.md trimmed to GSD's template shape (log moved to `.planning/STATE-ARCHIVE.md`), this file trimmed, ROADMAP/PROJECT corrections, PostGIS todo moved to completed. Savepoint commit `chore(savepoint)` on master.
- **Next batches, in order:** Step 3 docs (low tier: `docs/verification.md` publish-suite and dblink wording, `docs/design/design-system.md:4` Colors path, context-router archive line); Step 4 Windows BOM/lint patch (`~/Downloads/GottaGo-transfer/05-02-bom-strip.patch`, 28 files, plus 12 "TDD Guard" test-header comments; full tier); Step 5 salvage of `chore/skills-audit`: IN PROGRESS in worktree `.claude/worktrees/skills-restructure` (branch `chore/skills-restructure`, from master). Old diff backed up in `~/GottaGo-savepoints/2026-10-09-skills-audit/`. Content applied (conflicts resolved to master where master already removed model wording), the 3 round-1 Codex findings fixed (stageQueue `lstat` with a RED-then-GREEN test), old skill names updated in `review-packets.js` and a gate test; hook suite 146/146. Next: queue, packets, full-tier review; the user runs the commit (touches `.claude/hooks/*`); Step 6 `/stale-info-scan`, delete remote branches `phase5-05-02-stranded` and `wip/05-02-recovery` (ask first).
- **Then product work:** 05-03 (needs Mapbox tokens, on hold by the user), device UAT, Apple Developer enrollment (USD 99/year).

**Device setup (done unless noted):** iPhone 14 Pro Max (cable works, Developer Mode on, `devicectl` sees it) plus `Pixel_9` AVD; Xcode 27.0, iOS 27.0 simulator runtime, CocoaPods, Watchman, Android SDK with `ANDROID_HOME` in `~/.zshrc`. Local Supabase stack with the dev-only Eugene seed; `app/.env.local` (gitignored, mode 600) points at `http://192.168.0.65:54321` with the local anon key. Mapbox placeholders `PASTE_PK_TOKEN_HERE` / `PASTE_SK_TOKEN_HERE` still in `app/.env.local`. The local stack binds 0.0.0.0: run it only on a trusted network. After a reboot: start OrbStack, then `supabase start`.

**User-scope tooling (not in the repo):** Probity (TDD on `app/src/**`, verified live), GSD 1.42.3 frozen `--profile=core` (do not update: upstream deprecated), Beads `bd` not installed (`.beads/hooks` holds the git gate hook; `git config core.hooksPath` must print `.beads/hooks`). Shared status line `~/.claude/hooks/statusline.js` (Claude Code and Antigravity); Codex uses `[tui] status_line` in `~/.codex/config.toml`.

## Recovery Instructions

1. Read `AGENTS.md` -> `docs/context-router.md` -> `.planning/STATE.md` -> this file. Archives (`.planning/STATE-ARCHIVE.md`, `.planning/archive/`) are provenance only.
2. Check `git log -5 --oneline` and `git status` before trusting any doc's claimed state. This project has repeatedly had discrepancies between planning docs and what was actually live or committed. Verify against the live database (Supabase MCP `list_migrations`, read-only `execute_sql`) rather than assuming docs are current.
3. Check for a concurrent session's in-flight work before staging or committing under `supabase/**`, `app/**`, `docs/**`, or gated `.claude/**` paths: `git status --short` and `.claude/review-queue.txt` (gitignored; reflects only the current batch). If you find files you don't recognize, `git reset -- <their files>` to unstage (not discard) before your own commit, then `git add` them back afterward. Out-of-band edits during a live review belong in a separate git worktree.
4. Commits touching `.claude/hooks/*` or `.claude/settings.json`: hand the exact `git commit` command to the user to run, even when the gate passes clean.
5. The dblink race harness is DONE: it dials the session's own interface address via `host(inet_server_addr())` (`phase5_discovery_cooldown_race.test.sql`, reused by `phase5_verify_publish.test.sql`). Do not revisit the old dead ends (Unix-socket `user=postgres password=postgres`; `hostaddr=<non-.1 loopback>`).

## Carry-Forward Patterns (apply going forward)

- **Review workflow:** write `.claude/review-claims.md`, then `node .claude/hooks/review-packets.js` (stages the queue and writes both blind packets, or only Codex's for a low-tier batch). Every packet includes the User Advocacy question ("Does this decision serve someone with 60 seconds before an emergency?"). Ask the user before each commit and each push; approval for one batch does not carry to the next. After a batch commits, retire its packets (first line of both `*-prompt-latest.md`: committed as `<sha>`, do not review again), or a later reviewer run finds no staged scope and BLOCKs.
- **Refresh the status dashboard at every save point (user request, 2026-09-27).** Dashboard: https://claude.ai/artifact/BCaNAugM3bHtYwhuFyRzJc. It is a static snapshot; its data lives in one `// ---- Data` block (PHASES, MONTHS, FINDINGS, BLOCKERS, STEPS, TESTS). (1) Read the current page with the Artifact tool (`action: "read"`), since the source is not in the repo; (2) re-collect: plan counts from `.planning/STATE.md` frontmatter and `.planning/ROADMAP.md`, review verdicts from `.claude/reviews/<scope>/{antigravity,codex}/`, GitHub state from `git rev-list master...origin/master` and `gh run list`, monthly commits with explicit Pacific-time month boundaries (`--since=YYYY-MM-01T00:00:00-07:00 --until=<next month>`), never `--until=YYYY-MM-31`; (3) republish with `url` set to that link; (4) tell the user.
- **Server-authoritative derived-data pattern:** any UI value that looks computable client-side must still come from the same server-side computation as everywhere else that value appears (Phase 3 `get_location_detail(...) → distance_m`).
- **D-08 null-include pattern:** every data-dependent filter clause on a nullable boolean/text column must use an explicit "is not false" / "is null or matches" branch, never bare equality. Check it on every new filterable column.
- **Spatial index cast direction:** for a bbox `&&` test against an indexed `geography` column, cast the envelope to `::geography`, never the column to `::geometry` (that bypasses the GiST index).
- **Guard-race pattern:** any screen that calls `supabase.auth.signUp`/`signInWith*` and does further async work before navigating must raise `sessionCtx.setSuppressGuardRedirect(true)` first, cleared only via `useEffect` cleanup on unmount.
- **Retry-after-partial-success pattern:** track partial completion with explicit state so retries don't repeat an already-succeeded step.
- **Synchronous re-entrancy guard pattern:** use a `useRef` mutated immediately, not a `state` check, to block double-dispatch.
- **TanStack Query cache-key scoping:** any user-scoped `useQuery` on an app-lifetime `QueryClient` must include the user id in `queryKey`.
- **Async test cleanup:** always resolve a `new Promise(() => {})`-style pending-fetch mock before the test ends.
- **Codebase-invariant source-scan tests:** for contracts that can't be unit-tested through mocks, walk `app/src` with real `fs` at test time and regex-scan.
- **Avoid tautological mock-only tests.**
- **Review packets require** a "Runtime Boundary And Mock Audit" section (prompts) / "Runtime Boundary Check" (verdicts), enforced by `.beads/hooks/pre-commit`.
- **Reviewer CLIs:** the user runs both. Antigravity: `agy` (or `antigravity`) with a short prompt pointing at `.claude/antigravity-prompt-latest.md`. Codex: `codex exec` with a short prompt pointing at `.claude/codex-prompt-latest.md`; use `--sandbox danger-full-access` when the claims need Docker/runtime evidence.
- **Supabase credential handling:** never embed a live Supabase access token in a Claude-issued command. The user writes it to a gitignored file outside the repo (e.g. `~/.supabase-gsd-token`) via their own `!` command; Claude sources it by path and verifies it structurally without echoing the value.
- **Live infra pushes need fresh, explicit authorization each time,** including merges to master that carry `supabase/migrations` changes (they deploy to production).
- **Discussion-phase cross-referencing:** cross-reference a phase's design doc against ROADMAP.md scheduling to surface "designed but never scheduled" gaps.
- **Mechanical UI-checker thresholds vs. the design system:** resolve via a documented, user-approved exception in the phase's CONTEXT.md (see D-33).

## Human Checkpoints
- [ ] Phase 3's 7 device-verification items: `.planning/phases/03-read-path-map/03-VERIFICATION.md` § Human Verification Required. Not yet performed.
- [ ] Phase 4's 2 device-verification items: `04-HUMAN-UAT.md` and `04-VERIFICATION.md`. Not yet performed.
- [x] pgTAP suites run (resolved 2026-08-01; full isolated suite 253/253, Docker pgTAP green in CI since PR #1).

## Test Suite State (2026-10-09)
- App (`app/`): 46 suites, 397 tests; `npx tsc --noEmit` and `npx eslint src --quiet` clean.
- Harness: `node --test .claude/hooks/*.test.js scripts/*.test.js`; 5 Windows-only skips on macOS.
- Database: `node supabase/scripts/run-isolated-db-suite.js` (needs OrbStack/Docker).
