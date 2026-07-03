You are Antigravity for the "Gotta Go" project. You already reviewed and APPROVED WU-02-T5 (Phase 2, Plan 02-02) in this same session. Since then, Codex (the other independent reviewer) found a real MAJOR issue in that same change that you did not catch, and Claude fixed it. Please re-review just this fix.

Read your operating instructions from ANTIGRAVITY.md and docs/agent-harness.md if you need to refresh context, then read these files fresh from disk (do not rely on your memory of the earlier version):
- app/src/app/(tabs)/profile.tsx
- app/src/app/__tests__/(tabs)/profile.test.tsx
- app/src/app/_layout.tsx (unchanged since your last review — just re-confirm the QueryClient it creates is the one whose scoping is at issue)

Codex's finding (already fixed, please verify the fix is correct and sufficient):
"profileStats is user-scoped data, but its TanStack Query key was the static ['profileStats'] while the root QueryClient is app-lifetime state created once in _layout.tsx. If user A signs out and user B signs in during the same app runtime, the profile screen could synchronously render user A's cached contribution counts for user B until the stale query refetches. Fix: key stats by the authenticated user, e.g. queryKey: ['profileStats', session.user.id]. Add a regression test using one QueryClient across a user switch."

Claude's fix: changed the queryKey to ['profileStats', session?.user.id] (see profile.tsx), and added a new test 'CODEX-01: does not leak a previous user's cached stats to a newly signed-in user' in profile.test.tsx that shares a single QueryClient across two render()/unmount() cycles for two different users and asserts the first user's cached value does not appear for the second user while their fetch is still in flight.

Also note the getMyProfile query (queryKey: ['myProfile', session?.user.id]) was ALREADY scoped by user id before this fix — only profileStats had the bug.

Verification already run: npm test --runInBand -- 198/198 tests passing, 24 suites, 0 failures (includes the new regression test). npm run typecheck -- 0 errors. npm run lint -- 0 errors, only pre-existing unrelated warnings.

Please return your verdict in the Antigravity review format from ANTIGRAVITY.md, including a Runtime Boundary Check confirming whether this fix is complete (e.g. is there any OTHER query in this codebase with the same unscoped-cache-key risk you should flag, given this same QueryClient is shared app-wide) and whether the regression test actually proves the fix.

## Runtime Boundary And Mock Audit

Nearest callers/callees/providers for this fix: `_layout.tsx` creates the single app-lifetime `QueryClient` and provides it via `QueryClientProvider`; `profile.tsx`'s `statsQuery`/`profileQuery` are the only two `useQuery` call sites in the codebase, both now keyed by `session?.user.id`. No RPC, migration, or policy changed in this fix — it is purely a client-side cache-key scoping correction. Mock boundary: `profile.test.tsx`'s `CODEX-01` regression test mocks `useSession()` and `profileStats()`/`getMyProfile()` at the feature-module boundary (not `supabase` itself) and shares one real `QueryClient` instance across two `render()`/`unmount()` cycles to reproduce the actual app-lifetime cache persistence — this is the boundary that matters for this specific bug (TanStack Query's cache, not RLS/Supabase), so mocking Supabase further out does not hide anything relevant to this finding.
