# Execution State
<!-- updated: 2026-07-10 (P0 remediation batch reviewed, Round 8 both APPROVE, and COMMITTED as c5f4f7b) -->

## Current Position
- **P0 remediation batch: COMMITTED as `c5f4f7b` (2026-07-10).** (1) PostGIS schema qualification fixed (`20260710010000`), pushed with user authorization and live-verified. After Codex found the fix had reactivated legacy Phase 1 full-row RPCs, `20260710020000` plus `20260710030000` removed every overload; live verification shows zero remain. (2) `verification_events_insert_auth` was dropped by `20260710000000` and live-verified, so RLS denies ordinary client inserts. Round 4 live inspection found broad `anon`/`authenticated` table grants still present, including `TRUNCATE`; local forward migration `20260710121534` revokes all `anon` privileges and leaves `authenticated` with SELECT only. **CONFIRMED LIVE (2026-07-10):** direct query against `information_schema.role_table_grants` shows `anon` has zero privileges and `authenticated` has `SELECT` only on `public.verification_events`; `supabase_migrations.schema_migrations` records `20260710121534` as applied remotely. Deployed prior to this check (exact timing/authorization path not reconstructed — user reviewed and accepted the live state as correct rather than investigating further). (3) Verification baseline is clean: lint 0 errors, typecheck clean, 46/46 suites / 389/389 tests / coverage 100% with clean Jest exit. Codex Round 5's detail-fetch and provider-failure paths are fixed; Round 6's remaining app findings are also fixed (duplicate permission hook + orphaned test deleted, no references remain; Nearby denied/undetermined recovery actions added). Round 7's review-gate fingerprint finding is fixed: packets/verdicts now bind to a deterministic SHA-256 `scope_hash` of the staged queue; a 15th fixture proves re-staging changed queued bytes invalidates prior approvals. **Round 8: both Antigravity and Codex APPROVE**, scope_hash `sha256:87b008d0fdf36f710ce3f1e2659a52a3a420dea7ba36a7e7f4f9abbcb39cb66d` independently reproduced and confirmed by Claude before committing (not just trusted from the saved verdicts). `.claude/review-queue.txt` is now cleared. **Next action:** item 4 authority-doc refresh, then item 5 Phase 5 discussion gates. All pre-Phase-5 remediation (items 1-3) is now fully live and verified.
- **Phase 3 (Read Path & Map): CODE COMPLETE; VERIFICATION OVERRIDE AND DEVICE UAT OPEN.** All 5 plans (03-01..03-05, 4 waves) executed, merged, tested (294/294 Jest tests, 100% coverage on `src/features/**`/`src/lib/**`, clean tsc at phase close). Cross-AI review (Antigravity + Codex, 7 findings) resolved pre-execution; internal code review (`03-REVIEW.md`) found 2 more criticals post-execution (CR-01 null-viewport crash in MapScreen's denied-GPS "Search this area"; CR-02 `filter_chill_spot` violated the project's own D-08 null-include contract) — both fixed and pushed live via a follow-up migration (`20260707010000_phase3_chill_spot_null_include_fix.sql`). `03-VERIFICATION.md`: 12/13 must-haves; the 13th (pgTAP suite execution) accepted as a **tracked, user-signed-off override** (no Docker in this environment — see pending todo `2026-07-07-run-pgtap-suite-on-docker-capable-machine.md`). 7 device-UAT items remain unperformed, and the 2026-07-09 whole-project audit elevated the pending PostGIS schema-qualification issue to pre-Phase-5 remediation.
- **Migration-history drift discovered and reconciled during Phase 3 Wave 1 (2026-07-06/07):** remote had 5 tracking-table entries with no local file (from a prior session applying Phase 2 SQL directly via the Supabase MCP tool); reconciled via `supabase migration repair --status reverted` on the 5 orphans + a real `supabase db push --include-all` re-running all pending migrations. Local/remote migration history now matches exactly (16 entries as of Phase 3 close, +1 for the CR-02 fix = 17). **Supabase CLI is now correctly linked and authenticated in this environment** (contradicts the older `project-context.md` note that `supabase db push` fails — that's now fixed; a personal access token is sourced via `source ~/.supabase-gsd-token`, never embedded literally in any command).
- **Phase 4 (GPS Service & Submission): CODE/REVIEW GATE CLOSED.** All 6 plans (04-01..04-06) and 6 summaries exist; `.planning/ROADMAP.md` marks Phase 4 complete and `.planning/STATE.md` has advanced into Phase 5 planning. The final review-fix batch is committed at `bf93a37` (`fix phase 4 review findings`), and both saved external reviewer artifacts say **APPROVE** over the 32-file queue. GSD `progress` still reports Phase 04 as **Needs Review** only because `04-VERIFICATION.md` deliberately remains `status: human_needed` for two device-only walkthroughs.
- **Next recommended action:** do not resume Phase 4 discussion or write executable Phase 5 plans. All P0 remediation (PostGIS, verification-event RLS+ACL, clean verification baseline) is committed AND live-verified. Proceed to item 4 authority-doc refresh, then item 5 Phase 5 discussion. Phase 3/4 device UAT and Docker pgTAP remain explicit carry-forward work.
- **Phase 5 readiness (2026-07-09):** `.planning/phases/05-trust-engine-verification/05-READINESS.md` now reconciles the completed Phase 4 staging model with Phase 5. Do not write executable Phase 5 plans until its required discussion decisions are resolved, especially pending-candidate discoverability, the pre-publication verification-event model, trust/confidence formulas, the currently unmeasurable 48-hour no-flag route, and push-notification infrastructure.
- **Codex contingency orchestration (2026-07-09):** the human explicitly authorized Codex to continue while Claude is rate-limited. `docs/codex-model-routing.md` sets Sol/high as the contingency default, reserves max/ultra for difficult or decomposable work, and defines Terra/Luna as bounded delegates that do not replace independent Antigravity + Codex approval. After the usage reset, read-only Terra/high and Luna/medium advisory runs completed successfully. Their evidence-backed additions are incorporated into `05-READINESS.md`; they are internal planning advice, not independent approval artifacts.
- **Whole-project audit (2026-07-09):** `.planning/project-audit-2026-07-09.md` is a historical pre-remediation snapshot, not current execution guidance. Its items 1-3 are complete; use it only for provenance. The remaining order is (4) refresh schema/project/system-map/design/ship-config authority docs, then (5) resolve `05-DISCUSSION-DRAFT.md` before executable Phase 5 plans.
- TDD Guard: **ON**.
- Reviewer workflow (still current): Claude only writes/updates `.claude/antigravity-prompt-latest.md` and `.claude/codex-prompt-latest.md`. User runs both CLIs himself and they write their own `-review-latest.md` files. Claude does NOT invoke either CLI. This was followed correctly for Phase 3's pre-execution cross-AI review (`03-REVIEWS.md`); the post-execution code review (`03-REVIEW.md`) used the project's *internal* `gsd-code-review` skill (`gsd-code-reviewer` subagent), which is a different, Claude-invocable mechanism — not a violation of the external-reviewer rule.

## Historical Phase 4 Discuss-Phase Progress (superseded 2026-07-09)

This section is retained only for decision provenance. It is no longer the active recovery point; Phase 4 discussion, planning, execution, verification, and external review are complete except for the explicitly deferred device-UAT and Docker pgTAP checks.

**Non-building locations (parks, trailheads, port-a-potties) — 5 decisions locked, all "Recommended" option chosen:**
1. No street address → free-text location description replaces the address field (e.g. "North parking lot restroom, Alton Baker Park").
2. No new `location_type` field — existing "Public Facility" policy tag covers these adequately.
3. No distinct pin/icon styling for non-building locations — same as everything else for now.
4. Explicit "No address? Describe the location instead" skip-autocomplete affordance (not autocomplete-always-active).
5. **GPS is always canonical** — the address/description field is a human-readable label only; the real lat/lng always comes from the submitter's live GPS fix at Step 3 (`submit_location`'s GPS-confirm step), never geocoded from the address text. No geocoding dependency added.

This closes the open design question flagged in `PROJECT.md` on 2026-07-05/06 ("whether non-building locations need a distinct location/structure-type dimension") — answer: **no**, existing schema/tags suffice.

**Originally selected discussion areas (later resolved during Phase 4):**

The bullets below record the eventual Phase 4 resolutions, not current open questions.
- **access_sensitivity submission UX** — resolved as a Step 1 sensitivity toggle with explanatory copy and a D-15 confirmation dialog before submit when sensitivity is ON.
- **Access code (PIN) field framing** — resolved as a conditional Step 2 PIN field that appears only when policy tag is `code_required`; submitted values are staged through the RPC path and later update proposals use the stage-then-confirm flow.
- **Pending-pin tap behavior** — resolved as a dedicated pending submission surface (`PendingStatusSheet`) rather than the normal published-location detail sheet.

**Historical architectural note surfaced during this discussion:** the live `submissions` table already existed (`id, location_id [nullable FK], submitter_id, status ['pending'|'published'|'expired'|'rejected'], confirmation_count, expires_at [14-day default], created_at, updated_at`). Phase 4 has since resolved the pre-publication storage and submitter-only pending visibility path through the staged `submissions` columns plus `submit_location`, `get_my_pending_submissions`, and `withdraw_submission`; direct authenticated inserts were removed by `20260708010000_phase4_drop_direct_submission_insert.sql`.

## Recovery Instructions (current as of 2026-07-09)
1. Read `AGENTS.md` -> `docs/context-router.md` -> `.planning/STATE.md` -> this file.
2. Read `.planning/CLAUDE-HANDOFF-2026-07-09.md` for provenance, then treat this file, `.planning/STATE.md`, `.planning/ROADMAP.md`, commit `bf93a37`, and `.planning/phases/05-trust-engine-verification/05-READINESS.md` as the current Phase 4-to-5 handoff. `.planning/project-audit-2026-07-09.md` is historical evidence; read its 2026-07-10 banner before using the preserved body.
3. Do not re-enter `/gsd:discuss-phase 4` unless the user explicitly wants to revisit settled decisions.
4. If the goal is to make `gsd-tools progress` report Phase 04 as `Complete`, first perform the two tests in `04-HUMAN-UAT.md`, then update `04-HUMAN-UAT.md` and `04-VERIFICATION.md` honestly. Do not mark `status: passed` before those device checks are actually done.
5. Otherwise, obtain fresh Antigravity and separate Codex verdicts for the corrected audit-remediation batch, commit only after both APPROVE, request separate authorization to push and live-verify `20260710121534`, then proceed to remediation item 4 before converting Phase 5 discussion decisions into executable plans. Do not repeat the already-live migrations; keep Phase 3/4 device UAT and pgTAP Docker checks as tracked carry-forward items.

---

## Phase 3 Planning Summary (2026-07-05, historical — Phase 3 is now fully closed, see Current Position above)

| Step | Result |
|------|--------|
| UI-SPEC (`/gsd:ui-phase 3`) | Checker BLOCKed on Typography (5 sizes/3 weights) + Spacing (12px/20px non-standard) — both structural facts of the already-shipped Phase 1.5 token system, not Phase 3 authoring gaps. User approved as a documented standing exception: **D-33** in `03-CONTEXT.md`. UI-SPEC frontmatter `status: approved`, commit `76fd09d`. |
| Research (`/gsd:plan-phase 3`) | `03-RESEARCH.md` commit `bde615b`. Resolved the ARCHITECTURE.md-vs-UI-SPEC clustering discrepancy: **native `@rnmapbox/maps` `ShapeSource cluster:true`**, NOT the `supercluster` JS library. Caught 3 live-schema corrections to ARCHITECTURE.md: `suppressed_at` didn't exist yet (03-01 added it), `confidence_score`/`confidence_tier` are TEXT tiers, column is `shadowban_status` not `is_shadowbanned`, no `status` column on `locations`. |
| Planning | 5 plans, 4 waves. Commit `babec2e`, revised in `872b26b` (LocationDetail distance-wiring fix + 5 warnings). |
| Cross-AI review (2026-07-05, pre-execution) | Antigravity + Codex both REQUEST CHANGES (7 findings: `update_profile` display-name wipe [shared finding], bbox index-bypassing cast, D-08 null-filter violations, antimeridian crash, denied-GPS scope narrowing [→ approved decision **D-34**], `max_pins` not read server-side, wrong current-location source [`gpsConsent.ts` → new `useCurrentPosition` hook]). All 7 fixed in a revision pass, re-verified by plan-checker (0 blockers, 3 minor warnings), committed. |
| Execution (2026-07-06/07) | 4 waves, mostly worktree-isolated parallel `gsd-executor` agents (some hit session-limit mid-task and were recovered from partial worktree commits — see below). Wave 1 (03-01) included the DB migrations + a **[BLOCKING] `supabase db push`**, which surfaced the migration-drift issue (see Current Position) requiring a Supabase personal access token (sourced via a git-ignored `~/.supabase-gsd-token` file, never typed literally in any Claude-issued command — the harness's credential-leakage classifier blocked two earlier naive attempts). |
| Post-execution code review (2026-07-07) | Internal `gsd-code-review` skill (not an external reviewer) found 2 Critical + 4 Warning + 3 Info findings. Both criticals fixed (CR-01, CR-02) and verified; warnings/info left as tracked, non-blocking debt (WR-01..04, IN-01..03 in `03-REVIEW.md`). |
| Final verification | `gsd-verifier` agent: 12/13 must-haves, pgTAP-execution gap accepted as a user-signed-off override in `03-VERIFICATION.md` frontmatter. |

**Session-limit recovery pattern (recurred 3x during Phase 3 execution):** subagents dispatched via `Agent(..., isolation="worktree")` sometimes return a truncated/empty result with "You've hit your session limit" instead of the expected PLAN COMPLETE summary. **Always verify via `git log`/`git status` in the worktree directory directly** before trusting or discarding the work — in all 3 recurrences, real committed (or at least uncommitted-but-written) progress existed and was salvageable by inspecting the worktree, running the tests directly, and either merging what was there or finishing the remaining tasks in-place (as the orchestrator, not a fresh subagent) rather than restarting from scratch.

**Worktree cleanup pitfall (new, 2026-07-06/07):** removing a merged worktree via a raw `robocopy /MIR <empty-dir> <worktree-path>` trick (used to work around Windows `MAX_PATH` "Filename too long" errors from `git worktree remove`) can **wipe a `node_modules` junction that points back into the main checkout**, if the Wave 3 executor (or any executor) created one to work around a stale/absent worktree `node_modules` (see 03-03-SUMMARY.md's noted deviation). This happened once during Phase 3 cleanup — `app/node_modules` in the MAIN checkout was silently emptied. Caught immediately via a failed `npx tsc`/`npm test` right after, fixed with `cd app && npm ci`. **Always re-run `npx tsc --noEmit` + `npm test` in the main checkout immediately after any worktree cleanup, before trusting anything else.**

## Work Unit Status (Phase 1–2, all COMPLETE — unchanged from before, kept for historical WU→commit lookup)
| WU | BD ID | Status | Commit |
|----|-------|--------|--------|
| WU-01a-T1 | gotta-go-xpr.1 | COMPLETE | — |
| WU-01a-T2 | gotta-go-xpr.2 | COMPLETE | 15a8dc4 |
| WU-01a-T3 | gotta-go-xpr.3 | COMPLETE | 502105c |
| WU-01a-T4 | gotta-go-xpr.4 | COMPLETE | 6c60a1d |
| infra | — | COMPLETE | fedc053 |
| WU-01b-T5 | gotta-go-xpr.5 | COMPLETE | 97ec0e1 |
| WU-01b-T6 | gotta-go-xpr.6 | COMPLETE | c37d1e2 |
| WU-01b-T7 | gotta-go-xpr.7 | COMPLETE | ea07fca |
| WU-02-T1 | gotta-go-x88 | COMPLETE | ac66fc4 |
| WU-02-T2 | gotta-go-n1j | COMPLETE | fa63838 + dashboard/EAS config verified live |
| WU-02-T3 | gotta-go-3ov | COMPLETE | 10e0f9e |
| WU-02-T4 | gotta-go-wct | COMPLETE | 76c7375 |
| WU-02-T5 | gotta-go-g1u | COMPLETE | 254af27 |
| WU-02-T6 | gotta-go-ntn | COMPLETE | c33bc1a |

Phase 3 commits (2026-07-05 through 2026-07-07), in order:
| What | Commit |
|------|--------|
| Cross-AI plan review (Antigravity + Codex, both REQUEST CHANGES) | 514e5ba |
| Plan revision incorporating all 7 review findings | 22414e1 |
| Non-comparative engagement/novelty ideas todo captured | a1fde5c |
| Wave 1 (03-01) DB migrations merged | e8f9603 |
| 03-01 SUMMARY + authoritative type regen post-push | d880268 |
| Wave 2 (03-02) client data layer merged | e8f9603→... (see git log for exact chain) |
| Wave 3 (03-03) MapScreen + LocationDetailSheet merged | 5ba0966 |
| Wave 4 (03-04, 03-05) Nearby/family-toggle + filters/denied-GPS merged | (two merge commits, see git log) |
| Post-execution code review report | 153c7bf |
| CR-01 + CR-02 fixes (client null-guard + new migration, pushed live) | 03e47b4 |
| Phase verification (12/13, override) | c0e9224 / 5f3c44e |
| pgTAP follow-up todo + STATE.md close-out | 9741dbf |

Process/tooling commits (historical, unchanged):
| What | Commit |
|------|--------|
| Review-handoff standard tightening | c2e1e33 |
| Bookkeeping fixes from 2026-07-03 audit | 9986c4e |
| Dead Expo template code deletion | bc9a52b |
| Harness integrity fix batch | b413be8 |
| Phase 2 verification + audit closure | d159219 |

## Carry-Forward Patterns (apply going forward)

- **Server-authoritative derived-data pattern:** any UI value that looks computable client-side from data already on screen must still come from the SAME server-side computation as everywhere else that value appears. See Phase 3's `get_location_detail(location_id, user_lat, user_lng) → distance_m` fix.
- **D-08 null-include pattern (new, Phase 3 code-review CR-02):** every data-dependent filter clause on a nullable boolean/text column MUST use an explicit "is not false" / "is null or matches" escape branch, never bare equality (`= true`). A filter using strict equality on a nullable column silently excludes null rows — exactly backwards from this project's D-08 policy. Check this pattern on EVERY new filterable column added in future phases (Phase 4's `access_sensitivity`, if it ever becomes filterable, would need the same treatment).
- **Spatial index cast direction (new, Phase 3 Antigravity finding):** for a bbox `&&` test against an indexed `geography` column, cast the ENVELOPE to `::geography`, never cast the column to `::geometry` — casting the indexed column bypasses the GiST index entirely (forces a sequential scan).
- **Guard-race pattern:** any screen that calls `supabase.auth.signUp`/`signInWith*` and does further async work before navigating must raise `sessionCtx.setSuppressGuardRedirect(true)` first, cleared only via `useEffect` cleanup on unmount.
- **Retry-after-partial-success pattern:** track partial completion with explicit state so retries don't repeat an already-succeeded step.
- **Synchronous re-entrancy guard pattern:** use a `useRef` mutated immediately, not a `state` check, to block double-dispatch from synchronous handlers.
- **TanStack Query cache-key scoping pattern:** any user-scoped `useQuery` on an app-lifetime `QueryClient` MUST include the user id in `queryKey`.
- **Async test cleanup:** always resolve a `new Promise(() => {})`-style pending-fetch mock before the test ends.
- **Codebase-invariant source-scan test pattern:** for contracts that can't be unit-tested through mocks, walk `app/src` with real `fs` at test time and regex-scan.
- **Avoid tautological mock-only tests.**
- **Review packets require** a "Runtime Boundary And Mock Audit" section (prompts) / "Runtime Boundary Check" (verdicts) — self-enforced via `.beads/hooks/pre-commit`.
- **Antigravity CLI invocation:** write the packet to `.claude/antigravity-prompt-latest.md`, invoke with a short prompt pointing at the file. Binary: `C:\Users\mrsai\AppData\Local\agy\bin\agy.exe`.
- **Codex CLI:** `codex exec` — user runs it himself, per the manual reviewer workflow.
- **Supabase credential handling (new, Phase 3):** NEVER embed a live Supabase access token literally in any Claude-issued Bash/tool command — the harness's credential-leakage classifier will (correctly) block it. Instead, have the user write it to a git-ignored file (e.g. `~/.supabase-gsd-token`, outside the repo) via their own `!`-prefixed command, then `source` that file by path in Claude-issued commands. Verify the file structurally (grep for expected pattern, never echo the value) before use.
- **Live infra pushes need fresh, explicit authorization each time** — even a well-evidenced, clearly-beneficial fix (like CR-02's migration) triggered the harness's "Production Deploy" classifier because it was authored and merged autonomously without the user specifically approving THAT push. Ask before every distinct live database push, don't assume a general "you're executing this phase" authorization covers it.
- **Discussion-phase cross-referencing pattern:** systematically cross-referencing a phase's design-doc against actual ROADMAP.md scheduling surfaces real "designed but never scheduled" gaps.
- **Bounded, mechanical UI-checker thresholds vs. established design systems:** no built-in exception path — resolve via a documented, user-approved exception in the phase's CONTEXT.md (see D-33).

## Human Checkpoints
- [ ] Phase 3's 7 device-verification items (Mapbox rendering/gestures, RPC-failure banner, Nearby screen-reader pass, family_mode end-to-end + display-name preservation, filter AND-logic/session-persist, denied-GPS fallback) — listed in full in `03-VERIFICATION.md` § Human Verification Required. NOT yet performed.
- [ ] Phase 4's 2 device-verification items (SubmitFlow real GPS/permission/mock-location walkthrough; pending-pin/withdraw/code-update device walkthrough) - listed in `04-HUMAN-UAT.md` and `04-VERIFICATION.md`. NOT yet performed.
- [ ] pgTAP suites (`supabase/tests/phase3_read_rpcs.test.sql`, 24 assertions; `supabase/tests/phase4_submit.test.sql`, 21 assertions; `supabase/tests/phase4_access_code.test.sql`, 21 assertions) - NOT yet run anywhere (no Docker). Tracked as override + todo.

## Test Suite State (as of Phase 3 close, commit `03e47b4`+)
- 38 suites, 294 tests, 100% coverage on `src/features/**` + `src/lib/**`. jest@29.7.0 pinned. `npx tsc --noEmit` clean. `app/node_modules` reinstalled via `npm ci` after the worktree-cleanup incident above — confirmed working.
