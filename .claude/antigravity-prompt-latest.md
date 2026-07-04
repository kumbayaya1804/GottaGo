You are Antigravity for the "Gotta Go" project. This is a review request for the **audit cleanup code batch** (project audit 2026-07-03) — a structural-only change with zero behavior modification intended. Read your operating instructions from `ANTIGRAVITY.md` and `docs/agent-harness.md` if needed, then read the files in `.claude/review-queue.txt` fresh from disk.

## What Changed And Why

A full project audit found the old Expo template directories at the `app/` root. Investigation showed:

1. **`app/components/` (8 files) was genuinely dead** — Expo scaffold leftovers (EditScreenInfo, ExternalLink, StyledText, Themed, useClientOnlyValue×2, useColorScheme×2), referenced by nothing under `src/`. **Deleted.**
2. **`app/constants/Colors.ts` was NOT dead** — 11 live files imported it via relative paths, even though it sat in a directory excluded from `tsconfig.json`. Its own docblock says the intended import is `@/constants/Colors` (which resolves to `src/constants/` via the path alias) — i.e., the file was always meant to live with the other design tokens in `src/constants/` (`spacing.ts`, `typography.ts`, `radius.ts`, `legal.ts`) and got stranded at the template location. **Moved (`git mv`) to `app/src/constants/Colors.ts`, content unchanged.**
3. **11 import paths updated** — pure one-`../`-removal per file, matching how each file already imports its sibling constants: 8 files at 3-up depth (`../../../constants/Colors` → `../../constants/Colors`): the three `(auth)` screens, both `(components)` modals, `(tabs)/profile.tsx`, `(tabs)/_layout.tsx`, `auth/callback.tsx`; 3 files at 2-up depth (`../../` → `../`): `gps-consent.tsx`, `index.tsx`, `reset-password.tsx`.
4. **Dead config entries removed:** `"components"`/`"constants"` from `app/tsconfig.json` `exclude` (the directories no longer exist; note `Colors.ts` is now INSIDE the compiled `src/` tree rather than reached through an excluded directory), and `'components/**'` from `app/eslint.config.js` ignores.

No color token values, exports, or any other line of any file changed — verify this by diff if you wish (`git diff HEAD -- app/`).

## Priority 1 — Verify No Behavior Change

- Confirm `Colors.ts` content is byte-identical to the old `app/constants/Colors.ts` (git shows it as `R` rename).
- Confirm every one of the 11 import-path changes resolves to the same module (the moved file), and no import was missed (`grep -rn "constants/Colors" app/src` should show only the 11 imports + the file's own docblock).

## Priority 2 — TypeScript Compilation Surface Change

Removing the `exclude` entries and moving `Colors.ts` into `src/` means the file is now typechecked as part of the main program (before, it was only pulled in transitively). Verify this strictness change is safe: `npm run typecheck` reports 0 errors.

## Priority 3 — Anything The Audit Missed

You have repo-wide context: is there any other file still referencing the deleted `app/components/` files, or any tooling (babel, jest, EAS/metro config) that referenced the old `app/constants/` or `app/components/` paths?

## Dependency Call Chains

`Colors.ts` is a leaf module (exports a `const` object, imports nothing). Its consumers are the 11 UI files listed in the review queue. No RPC, migration, policy, provider, hook, or navigation logic is touched. `tsconfig.json`/`eslint.config.js` changes only remove references to now-deleted directories.

## Runtime Boundary And Mock Audit

No runtime boundary is affected: this batch changes where a static token module lives on disk and how it is imported, not what any component renders or calls. No tests were added or modified — the existing 25 suites exercise the same screens through the same imports (now resolving to the moved file), and no mock references `constants/Colors` (verified: zero hits in `src/app/__tests__/` and `jest.setup.ts`), so no mock could mask a path-resolution failure; a broken import would fail module resolution loudly at test load time.

## Verification Already Run

- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors, 27 pre-existing BOM warnings (same count as before the change)
- `npx jest` — 25 suites, 200 tests, 0 failures

Return your verdict in the Antigravity format from `ANTIGRAVITY.md`, including a Runtime Boundary Check section. Save it to `.claude/antigravity-review-latest.md`.
