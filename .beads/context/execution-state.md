# Execution State
<!-- updated: 2026-07-01 -->

## Current Position
- Active plan: 02-02 (OAuth + Profile + Deletion)
- Active work unit: WU-02-T3 (TDD modules) — code complete, blocked only on a live migration apply requiring direct user confirmation
- Current phase: WAITING FOR HUMAN (one mechanical step, see below)
- Next auto task: after T3 closes — WU-02-T4 (OAuth UI + callback + sign-up wiring)

## WU-02-T3 Status — code done, one blocking step left

All four modules are implemented, tested, and were sent through one full review round (Antigravity + Codex both REQUEST CHANGES → fixes applied). A second review round is still needed after the migration below is live — do not commit before that.

**Files (all on disk, uncommitted):**
- `app/src/features/auth/oauth.ts` + `__tests__/oauth.test.ts` (12 tests) — includes the null-safety fix for `data?.url` from round 1 review
- `app/src/features/profile/updateProfile.ts` + `__tests__/updateProfile.test.ts` (3 tests)
- `app/src/features/profile/deleteAccount.ts` + `__tests__/deleteAccount.test.ts` (2 tests)
- `app/src/features/profile/profileStats.ts` + `__tests__/profileStats.test.ts` (4 tests) — rewritten in round 1 fixes to call `get_profile_stats()` RPC instead of querying `ratings` directly (which fails — see below)
- `supabase/migrations/20260627000005_profile_stats_rpc.sql` — written, reviewed by the user directly (content shown in chat, approved), **NOT YET APPLIED LIVE**

**Round 1 review findings (both fixed on disk):**
1. [CRITICAL/MAJOR, both reviewers independently] `profileStats.ts` queried `ratings` directly via client, but `20260624000002_ratings_privacy_fix.sql` already revokes base-table SELECT on `ratings` from `authenticated`/`anon` (PII protection) — query would 42501 at runtime despite mocked tests passing. Fixed: new `get_profile_stats()` SECURITY DEFINER RPC, derives user via `auth.uid()` (no caller-supplied id), returns all 3 counts as one JSON object. `profileStats.ts` rewritten to call it; test rewritten to mock `.rpc()` instead of `.from().select()`.
2. [MINOR, Antigravity] `oauth.ts:25` unsafe `data.url` access if `signInWithOAuth` resolves without a URL. Fixed: explicit guard throwing a descriptive error instead of a raw `TypeError`.
3. [MINOR, informational, not T3's scope] iOS Guideline 4.8 compliance depends on `sign-in.tsx` (built in T4) correctly gating `signInWithGoogle` behind `Platform.OS === 'android'` — flag for whoever builds T4, no action in T3.

**Why it's blocked:** applying a migration to the live Supabase project (`ebmzhjmmtmldhrojkdqw`) and regenerating `database.types.ts` are persistent, hard-to-cleanly-undo changes to shared infrastructure. The coder subagent (background agent, resumable by ID) correctly refuses to do this on a *relayed* confirmation from the coordinator (Claude), even when the coordinator accurately quotes the user's own words — it requires a message that arrives directly from the user in that conversation. This is sound design, not a bug, and there's no way to retroactively satisfy it within that same subagent conversation.

**Current typecheck state (expected, will resolve once unblocked):** 4 errors in `profileStats.ts` (RPC name/shape not in generated types yet — `database.types.ts` doesn't know about `get_profile_stats` until the migration is live and types are regenerated) + 2 pre-existing unrelated errors in `(auth)/forgot-password.test.tsx` and `_layout.test.tsx` (untouched by this task, predate it).

## How to unblock next session (do this directly, don't resume the stuck subagent)

The resuming Claude Code session receives the user's message directly — so do this yourself rather than trying to get the old subagent unstuck:

1. Confirm with the user they still want `supabase/migrations/20260627000005_profile_stats_rpc.sql` applied (content is on disk, was already shown to and approved by the user once — re-confirm since time has passed).
2. Apply it via the **Supabase MCP `apply_migration` tool** (project ref `ebmzhjmmtmldhrojkdqw`) — NOT `supabase db push` CLI, which fails in this environment (`SUPABASE_DB_PASSWORD` not set — see `project-context.md` § Tooling).
3. Regenerate `app/src/lib/database.types.ts` from the live schema (Supabase MCP `generate_typescript_types`, or the project's existing regen convention).
4. Re-run full DoD: `cd app && npm test`, `npm run test:coverage` (100% required), `npm run typecheck` (the 4 profileStats.ts errors should be gone; the 2 pre-existing ones are fine), `npm run lint`.
5. Regenerate fresh `.claude/antigravity-prompt-latest.md` / `.claude/codex-prompt-latest.md` (same 8-file review-queue scope) and get a **fresh** round of both reviews — round 1's REQUEST CHANGES findings were fixed, but they haven't been re-reviewed. Do not reuse round 1's verdicts as if they cover the current code.
6. Only after both return APPROVE: commit (reference both verdicts in the message per `docs/agent-harness.md`), clear `.claude/review-queue.txt`, close beads `gotta-go-3ov`, then proceed to WU-02-T4.

## Work Unit Status
| WU | BD ID | Status | Phase | Commit |
|----|-------|--------|-------|--------|
| WU-01a-T1 | gotta-go-xpr.1 | COMPLETE | COMMITTED | — |
| WU-01a-T2 | gotta-go-xpr.2 | COMPLETE | COMMITTED | 15a8dc4 |
| WU-01a-T3 | gotta-go-xpr.3 | COMPLETE | COMMITTED | 502105c |
| WU-01a-T4 | gotta-go-xpr.4 | COMPLETE | COMMITTED | 6c60a1d |
| infra | — | COMPLETE | COMMITTED | fedc053 |
| WU-01b-T5 | gotta-go-xpr.5 | COMPLETE | COMMITTED | 97ec0e1 |
| WU-01b-T6 | gotta-go-xpr.6 | COMPLETE | COMMITTED | c37d1e2 |
| WU-01b-T7 | gotta-go-xpr.7 | COMPLETE | COMMITTED | ea07fca |
| WU-02-T1 | gotta-go-x88 | COMPLETE | COMMITTED | ac66fc4 |
| WU-02-T2 | gotta-go-n1j | COMPLETE | COMMITTED | fa63838 + dashboard/EAS config verified live 2026-07-01 |
| WU-02-T3 | gotta-go-3ov | CODE COMPLETE, uncommitted | BLOCKED on migration apply (see above) | — |
| WU-02-T4 | gotta-go-wct | PENDING | — | — |
| WU-02-T5 | gotta-go-g1u | PENDING | — | — |
| WU-02-T6 | gotta-go-ntn | PENDING | — | — |

## Recovery Instructions
1. Read `.beads/plans/active-plan.md` (plan structure) and this file in full.
2. Read `.beads/context/project-context.md` (tooling + patterns + newly-added services).
3. Follow "How to unblock next session" above — do the migration apply + type regen yourself, don't resume the stuck subagent for that specific step.
4. Once T3 commits and closes, spawn T4 (OAuth UI + callback + sign-up wiring): `sign-in.tsx`, `auth/callback.tsx`, `sign-up.tsx`. T4 must also address the Guideline 4.8 platform-gating note from T3's round-1 review.

## Test Suite State (as of last independent verification, pre-migration-apply)
- 19 suites, 130 tests (will be 133+ once the profileStats RPC path is fully typed and any additional coverage lands), 100% coverage on all touched files
- jest@29.7.0 pinned; TDD Guard currently **disabled** for this project (`guardEnabled: false` in `.claude/tdd-guard/data/config.json`) — user approved disabling it for WU-02-T3 only. **Re-enable with the exact chat message `tdd-guard on` once T3 commits.**
