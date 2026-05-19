# Verification Commands

Status: provisional. Update this file when the actual stack is scaffolded.

## Goal

Every non-trivial change should have a clear verification signal before commit. Reviewers should report what they ran and what they could not run.

## Expected Command Categories

Once the project has a Node/TypeScript app, expected commands should include:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

If the project uses a different package manager, replace these with the project-standard commands.

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

## Review Reporting

Reviewers should include a verification section:

```md
### Verification
- `npm test` - passed
- `npm run typecheck` - passed
- Not run: Supabase database tests; no Supabase config exists yet.
```

If a command fails, report the failing command and the relevant failure. Do not hide failed verification behind an approval.

