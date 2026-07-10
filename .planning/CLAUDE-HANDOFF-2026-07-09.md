# Claude Recovery Handoff - 2026-07-09

Status: HISTORICAL as of 2026-07-10 — see the Remediation Update below before
acting on anything in this file.
Prepared by: Codex GPT-5.6 Sol while Claude was rate-limited.

## Remediation Update - 2026-07-10 (Claude)

Items 1-3 of the Required Remediation Order below are COMPLETE; do not repeat
them:

1. **Done, live** — PostGIS fix migration `20260710010000` pushed with user
   authorization and live-verified (all Phase 3 RPCs confirmed broken with
   `42704` before, working after). Codex's review then caught that the fix had
   wrongly repaired (rather than retired) the two legacy Phase 1 radius RPCs,
   reactivating a SECURITY DEFINER full-row read granted to anon;
   `20260710020000` + `20260710030000` dropped every overload of both
   functions, pushed and live-verified (zero overloads remain; anon read
   attempt raises 42501).
2. **Policy done live; ACL forward fix local** — `verification_events_insert_auth`
   dropped (`20260710000000`) and RLS denial live-verified. Round 4 found broad client
   table grants still live; `20260710121534` removes them locally and awaits review,
   commit, fresh deployment authorization, and live ACL verification. pgTAP now covers
   ACLs plus denied INSERT (Docker-blocked, unexecuted).
3. **Done** — lint 0 errors, typecheck clean, 46/46 suites / 389/389 tests /
   coverage 100% with CLEAN Jest exit and no `--forceExit` (root cause was
   TanStack Query gc timers in `submit.test.tsx` and `useFamilyMode.test.ts`;
   the 4 `use*` fetchers are renamed `fetch*`; `nearby.tsx` entity escaped;
   MapScreen `act()` warnings 7 → 1, residual disclosed). Codex Round 5's two
   app-recovery findings are fixed: detail-fetch failure has a reachable retry;
   permission/GPS rejection has an explicit unavailable state, retry, and Map
   manual-browse path, with late-settlement-after-unmount coverage. Round 6's
   follow-up findings are also fixed: Map no longer makes a duplicate permission
   request, its provider-rejection screen test uses the real hook, and Nearby's
   denied state opens OS settings while `undetermined` stays a distinct pending state.
   The orphaned duplicate hook and its three standalone tests were removed; no callers
   or references remain. Codex Round 7's final harness finding is fixed too: packets
   and verdicts bind to a deterministic staged-queue SHA-256 fingerprint, enforced by
   the pre-commit hook with a 15/15 regression suite.

Item 4 (PROJECT.md / schema-contract.md / SYSTEM_MAP.md / design docs /
config.json refresh) and item 5 (Phase 5 human decisions → 05-CONTEXT →
plans) remain OPEN, in that order. Earlier review findings are fixed. Round 4 added the
local ACL forward migration and corrected the final stale-scan sequence; Round 5 added
the app recovery fixes above; Round 6 closed the remaining duplicate-request and Nearby
denied-recovery gaps and Round 7 closed the stale-verdict bypass. Fresh Round 8
independent verdicts over 49 files are required before
commit; deployment of `20260710121534`
requires separate authorization after commit. The "Verification Evidence From This
Audit" section below is the OBSOLETE pre-remediation baseline — kept for history only.

## Resume Here

Read in this order:

1. `AGENTS.md`
2. `docs/context-router.md`
3. `.planning/STATE.md`
4. `.beads/context/execution-state.md`
5. `.planning/project-audit-2026-07-09.md` (historical provenance; read its 2026-07-10 banner first)
6. `.planning/stale-info-scan-latest.md`
7. `.planning/phases/05-trust-engine-verification/05-READINESS.md`
8. `.planning/phases/05-trust-engine-verification/05-DISCUSSION-DRAFT.md`
9. `docs/codex-model-routing.md` only if model choice/delegation remains in scope

Do not restart Phase 4 discussion and do not write executable Phase 5 plans yet.

## Current Position

- Phase 2: passed, 11/11.
- Phase 3: 5/5 plans code-complete, but `03-VERIFICATION.md` remains `gaps_found`.
  Seven device checks and the pgTAP suite remain open. The whole-project audit elevated
  the unqualified PostGIS calls under `SET search_path = public` to a P0 remediation.
- Phase 4: 6/6 plans code/review-complete at `bf93a37`; both historical external
  reviews approve the old 32-file Phase 4 queue. Two device walkthroughs and the two
  Phase 4 pgTAP suites remain open.
- Phase 5: readiness/discussion only. The six-plan split is provisional. No executable
  plan or migration has been authorized.

## Historical Required Remediation Order (items 1-3 complete)

1. Add a forward-only Phase 3 fix migration that schema-qualifies PostGIS types and
   functions in `search_locations_bbox`, `search_locations_nearby`, and
   `get_location_detail`; scan other security-definer functions for the same pattern.
2. Add a reviewed lockdown migration that removes authenticated direct inserts into
   `verification_events`; future client writes must use server-owned RPCs.
3. Restore the verification baseline:
   - rename the four async RPC helpers currently misnamed as `use*`, or otherwise fix
     the React Hooks lint violations without disabling the safety rule;
   - fix the unescaped JSX entity in `nearby.tsx`;
   - fix Jest cleanup/open handles and MapScreen `act(...)` warnings;
   - rerun test, coverage, typecheck, and lint without `--forceExit`.
4. Refresh `.planning/PROJECT.md`, `docs/schema-contract.md`, `docs/SYSTEM_MAP.md`, the
   implemented-phase portions of the design docs, and `.planning/config.json`'s
   nonexistent `REQUIREMENTS.md` ship sources.
5. Resolve the human decisions in `05-DISCUSSION-DRAFT.md`, convert approved answers
   into `05-CONTEXT.md`, then write plans 05-01 through 05-06.

## Phase 5 Decisions That Must Not Be Guessed

- Pending-candidate precision/radius and abuse controls.
- Raw GPS retention and deletion treatment.
- Trust ranges, multiplier mapping, deltas, proximity curve, and accuracy curve.
- Numeric confidence range, initial value, tiers, clamping, and backfill.
- Legacy Phase 4 creator claims that lack accuracy/fix-time evidence.
- Withdrawal/cancel/expiry behavior once immutable verification evidence exists.
- Historical shadowban treatment.
- Accessibility-tag staging and legacy pending submissions with no stored selections.
- Personal-impact copy/count semantics.
- Notification closure/deployment requirements.

## Verification Evidence From This Audit

- `npm.cmd run typecheck`: exit 0.
- `npm.cmd run lint`: exit 1, 5 errors and 30 warnings.
- `npm.cmd test -- --runInBand`: 47 suites / 383 tests report PASS, then the process
  does not exit and times out after 241 seconds.
- `npm.cmd test -- --runInBand --detectOpenHandles`: same PASS count and timeout;
  repeated MapScreen unwrapped-`act` warnings.
- `git diff --check`: exit 0 after handoff artifacts were corrected.
- Not run: coverage, pgTAP, device UAT, live Supabase verification.

## Historical Review And Commit State

- `.claude/review-queue.txt` is the current scope list for this uncommitted batch.
- `.claude/*-prompt-latest.md` and `*-review-latest.md` still describe/approve the
  previous Phase 4 queue. They are stale for the current batch.
- Regenerate both reviewer packets after remediation stabilizes the scope.
- Do not commit until current Antigravity and separate Codex verdicts both APPROVE and
  verification failures are resolved or explicitly accepted by the human.

## Worktree Safety

- Preserve the regenerated `app/src/lib/database.types.ts`. It now comes from the live
  post-sweep public schema and intentionally removes the retired
  `count_locations_within` and `get_locations_in_radius` RPC contracts. Do not restore
  the earlier metadata-only version or the failed `database.types.generated.ts` error
  artifact.
- Do not reset, clean, discard, or overwrite unrelated user changes.
- No live Supabase query/push, Edge Function deploy, cron change, credential access,
  destructive operation, commit, or push occurred during the Codex contingency.
- Every future live database push or deployment still requires fresh user approval.

## Codex Contingency Record

- Local Codex default: `gpt-5.6-sol` at `high` effort.
- Use Sol `max` for the P0 PostGIS/RLS/trust decisions.
- The global Codex skill at
  `C:\Users\mrsai\.codex\skills\artifact-qa-gate\SKILL.md` was upgraded on
  2026-07-09 for GPT-5.6 Sol with risk-scaled evidence levels, exact-target and
  persistence controls, delegated-work verification, clean-exit requirements, and a
  routed Gotta Go profile at `references/gotta-go.md`. The skill validates with the
  skill-creator `quick_validate.py` tool. It lives outside this Git repository, so the
  repo review queue and historical Phase 4 approvals do not cover the global skill.
- Terra and Luna completed bounded read-only advisory passes; their findings are
  incorporated into the readiness and audit artifacts but are not independent review
  approvals.
- When Claude returns, Claude resumes as the default GSD orchestrator. The implementing
  agent cannot self-approve.
