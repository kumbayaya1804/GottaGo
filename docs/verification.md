# Verification Commands

Status: active. Update this file when the stack or host tooling changes.

## Goal

Every non-trivial change should have a clear verification signal before commit. Reviewers should report what they ran and what they could not run.

## Expected Command Categories

For the Expo/TypeScript app, expected commands include:

```bash
cd app && npm.cmd test -- --runInBand
cd app && npm.cmd run typecheck
cd app && npm.cmd run lint
cd app && npm.cmd run test:coverage -- --runInBand
```

On this Windows host, use `npm.cmd` rather than `npm` from PowerShell. The `.ps1` shims can be blocked by execution policy.

For focused Jest runs against Expo Router paths containing literal parentheses, use `--runTestsByPath` so Jest does not treat `(auth)` as a regular-expression group:

```bash
cd app && npm.cmd test -- --runInBand --runTestsByPath "src/app/__tests__/(auth)/sign-in.test.tsx"
```

## Supabase And Database Verification

When Supabase migrations or database logic exist, expected verification should include the project-standard equivalent of:

```bash
supabase db lint
supabase test db
supabase db reset
```

Use only commands that are actually configured for the repository. If local Supabase is not available, reviewers must say that database verification was not run.

## Browser And Frontend Verification

For user-facing UI changes, verify:
- Desktop and mobile responsive layout
- Loading states
- Error states
- Empty states
- Denied location permission
- Slow or failed network calls
- Keyboard accessibility for controls
- No PII or precise coordinates in visible logs/debug UI
- Parent layout, provider, route guard, and async event behavior when those boundaries can change the screen outcome
- Whether screen tests mock production boundaries such as router, auth session, Supabase RPCs, GPS, network, or RLS behavior

When a dev server exists, run it and inspect the affected route in a browser if practical.

## Security-Sensitive Verification

For changes involving GPS, trust, shadowban, RLS, or moderation, verification must include targeted tests or direct inspection of enforcement at the correct layer.

Minimum evidence to look for:
- Tests for allowed and denied access
- Tests for shadowbanned users/locations being excluded
- Tests for deleted/expired/suppressed records being excluded
- Tests for failed Supabase calls
- Tests for GPS radius, freshness, and accuracy rules
- No sensitive values in logs

For auth, routing, Supabase writes, GPS, trust/shadowban, RLS-sensitive reads, and async UI flows, reviewers should include a call-path and mock-boundary check in addition to test results. Passing isolated unit or screen tests is not sufficient when those tests replace the provider, route guard, database, policy, or external callback that decides production behavior.

## Review Reporting

Reviewers should include a verification section:

```md
### Verification
- `npm test` - passed
- `npm run typecheck` - passed
- Not run: Supabase database tests; no Supabase config exists yet.
```

If a command fails, report the failing command and the relevant failure. Do not hide failed verification behind an approval.
