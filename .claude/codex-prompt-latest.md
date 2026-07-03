# Codex Review Request - Gotta Go (Re-review #2, narrow)

**Task:** You returned REQUEST CHANGES on the profileStats cache-key fix because the regression test left a never-resolving promise dangling (Jest didn't exit). This is the fix for exactly that one finding — nothing else changed.

## The Fix

In `app/src/app/__tests__/(tabs)/profile.test.tsx`, the `CODEX-01` test's user-2 `profileStats` mock now uses a controllable deferred promise (captured `resolve` function) instead of `new Promise(() => {})`, and settles it after the no-leak assertion, before `unmount()`/`clear()`:

```tsx
let resolveUser2Stats: (value: {
  gpsVerifications: number;
  locationsSubmitted: number;
  ratingsGiven: number;
}) => void = () => {};
mockProfileStats.mockImplementation(
  () =>
    new Promise((resolve) => {
      resolveUser2Stats = resolve;
    })
);

const second = render(/* ... */);
await act(async () => { await Promise.resolve(); });

expect(second.queryByText('5')).toBeNull();

await act(async () => {
  resolveUser2Stats({ gpsVerifications: 7, locationsSubmitted: 2, ratingsGiven: 0 });
  await Promise.resolve();
});

second.unmount();
sharedQueryClient.clear();
```

No other lines in `profile.tsx` or the test file changed since your last review — this is purely the async-cleanup fix you requested.

## Verification (run just now)

- `cd app && npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(tabs)/profile.test.tsx"` — **exits 0**, 18/18 tests passed, completes in ~8s, no open-handle warning, no timeout. (This is the exact command from your last review that previously hung.)
- `cd app && npm.cmd run test:coverage -- --runInBand` (full suite) — **24/24 suites, 198/198 tests, 100% coverage on all `src/**` files, completes in ~41s, clean exit.**
- `cd app && npm.cmd run typecheck` — 0 errors.
- `cd app && npm.cmd run lint` — 0 errors, 27 pre-existing unrelated warnings only.

## Runtime Boundary And Mock Audit

Nearest callers/callees/providers: `_layout.tsx` creates the single app-lifetime `QueryClient` and provides it via `QueryClientProvider`; `profile.tsx`'s `statsQuery`/`profileQuery` are the only two `useQuery` call sites in the codebase, both keyed by `session?.user.id` after this fix. No RPC, migration, or policy changed — this round is purely test-lifecycle cleanup for the `CODEX-01` regression test. Mock boundary: the test mocks `useSession()`/`profileStats()`/`getMyProfile()` at the feature-module boundary and shares one real `QueryClient` across two `render()`/`unmount()` cycles to reproduce actual app-lifetime cache persistence; the only change this round is that the previously-dangling `profileStats()` promise for user 2 is now settled via a captured `resolve` before `unmount()`/`clear()`, which does not change what boundary is being tested — it only stops Jest from being kept alive by an unsettled promise.

## Your Task

Confirm the async-cleanup issue is resolved and the command now exits cleanly. If so, please return **APPROVE** for the overall WU-02-T5 change (the `profileStats` cache-key fix + this test cleanup) so Claude can commit. Standard format:

```md
## Codex Review - [change set]

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
...

### Verification
...

### Runtime Boundary Check
...

### Approved
...
```
