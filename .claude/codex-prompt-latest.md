# Codex Review Request - Gotta Go (Audit cleanup code batch, 2026-07-03)

<context>
A full project audit (2026-07-03) is in progress. This batch is its only code-tree change: removing dead Expo template scaffolding and relocating a stranded design-token module. Zero behavior change intended. Files in `.claude/review-queue.txt`:

- `app/src/constants/Colors.ts` (moved here from `app/constants/Colors.ts` via `git mv`, content unchanged)
- 11 importing files (3 `(auth)` screens, 2 `(components)` modals, `(tabs)/profile.tsx`, `(tabs)/_layout.tsx`, `auth/callback.tsx`, `gps-consent.tsx`, `index.tsx`, `reset-password.tsx`) — one-line import-path updates only
- `app/tsconfig.json` (removed dead `"components"`/`"constants"` exclude entries)
- `app/eslint.config.js` (removed dead `'components/**'` ignore)

Also deleted outright (git `D`, not in queue since they no longer exist): `app/components/` — 8 Expo-template files (EditScreenInfo, ExternalLink, StyledText, Themed, useClientOnlyValue×2, useColorScheme×2) verified unreferenced by any `src/` code.
</context>

<role>
Read `CODEX.md` for standing priorities. Nothing in this batch touches security, privacy, RLS, GPS, or trust surfaces — your focus here is: (1) confirming the change is actually behavior-neutral, (2) catching any missed reference to the moved/deleted paths, (3) config-change correctness.
</role>

<why_the_move>
The audit initially classified `app/constants/Colors.ts` as dead template code (it sat in a tsconfig-excluded directory). Verification showed it was live — 11 files import it relatively — and its own docblock prescribes `@/constants/Colors` (the `@/*` alias maps to `./src/*`), i.e. it was always intended to live in `src/constants/` alongside `spacing.ts`/`typography.ts`/`radius.ts`/`legal.ts` and got stranded at the Expo-template location. The move also means the design-token file is now inside the strict-typechecked `src/` tree instead of being reached through an excluded directory.
</why_the_move>

<verification_focus>
1. Diff `app/src/constants/Colors.ts` against the pre-move `app/constants/Colors.ts` (git tracks it as a rename — `git diff HEAD -- app/` or `git log --follow`): confirm content is unchanged.
2. For each of the 11 import edits: confirm the new relative path resolves to `src/constants/Colors.ts` from that file's location (8 files went `../../../` → `../../`; 3 files directly in `src/app/` went `../../` → `../`).
3. Search for any residual reference to the old locations: `grep -rn "constants/Colors" app/src` should yield exactly the 11 imports + the moved file's own docblock; nothing should reference `app/components/` (check babel.config.js, jest.setup.ts, metro/EAS config, app.config.ts too).
4. Confirm removing the tsconfig `exclude` entries is safe — the excluded dirs no longer exist, and `Colors.ts` now typechecks as part of the root program (`npm run typecheck` = 0 errors claimed).
5. Confirm no test or mock referenced `constants/Colors` by path (claimed: zero hits in `src/app/__tests__/` and `jest.setup.ts`).
</verification_focus>

## Runtime Boundary And Mock Audit

<runtime_boundary_and_mock_audit>
No runtime boundary changes: `Colors.ts` is a leaf `const` token module with no imports; consumers render the same values through the same components. No provider, hook, route guard, RPC, migration, or policy is touched. No tests were added or modified; no mock references the moved module's path, so nothing in the test suite could mask a broken import — a wrong path would fail module resolution loudly at test load. The tsconfig/eslint edits only delete references to directories that no longer exist.
</runtime_boundary_and_mock_audit>

<verification_already_run>
- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors, 27 pre-existing BOM warnings (identical count pre/post change)
- `npx jest` — 25 suites, 200 tests, 0 failures
</verification_already_run>

<output_format>
```md
## Codex Review - Audit cleanup code batch (2026-07-03)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, and required fix.

### Open Questions
...

### Verification
...

### Runtime Boundary Check
...

### Approved
...
```

Save your verdict to `.claude/codex-review-latest.md`.
</output_format>
