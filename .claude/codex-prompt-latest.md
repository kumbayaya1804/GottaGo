# Codex Review Prompt — Phase 1 Fix Pass (2026-06-24)

## Scope

This is a focused re-review after Codex's prior REQUEST CHANGES verdict on Phase 1. All three MAJOR findings and all three MINOR findings have been addressed. Please confirm each fix is correct, flag any new issues introduced, and return a verdict.

Files in review scope (read each from disk):

**New migrations:**
- `supabase/migrations/20260624000001_phase1_fixes.sql`
- `supabase/migrations/20260624000002_ratings_privacy_fix.sql`

**Modified app files:**
- `app/src/app/(tabs)/index.tsx`
- `app/tsconfig.json`
- `app/tsconfig.test.json` (new)
- `app/.coverage-thresholds.json`

---

## What Was Fixed

### MAJOR-1 (resolved) — `shadowban_status = false` silently excluded NULL rows

**Prior finding:** `get_locations_in_radius` and `count_locations_within` filtered with `shadowban_status = false`, which excluded rows where `shadowban_status IS NULL`.

**Fix applied:** `supabase/migrations/20260624000001_phase1_fixes.sql`
- Backfills `locations.shadowban_status = false` where NULL, then adds `NOT NULL` constraint
- Same for `users.shadowban_status`
- Result: `= false` filter is now always safe; no function changes needed

### MAJOR-2 (resolved) — Stale Antigravity artifact

**Prior finding:** Antigravity artifact was stale relative to `20260624000000_block_fixes.sql`. Phase 1 could not be closed until Antigravity reviewed the current migration set.

**Fix applied:** Fresh Antigravity review completed on all Phase 1 migrations.
- First pass: REQUEST CHANGES (one MAJOR: missing `revoke authenticated` on ratings; two MINOR: implicit SRID)
- All findings addressed in `20260624000002_ratings_privacy_fix.sql`
- Re-review: **APPROVE** — see Antigravity verdict below

### MAJOR-3 (resolved) — `index.tsx` smoke check logs Supabase errors in dev

**Prior finding:** `useEffect` in `index.tsx` sent a live Supabase query on every dev mount and logged `error.message`, risking schema/RLS diagnostic exposure in logs.

**Fix applied:** `app/src/app/(tabs)/index.tsx` — useEffect smoke block removed entirely. Screen is now a plain placeholder.

### MINOR-1 (resolved) — `.coverage-thresholds.json` inconsistency

**Prior finding:** `jest.config.js` excludes `src/app/**` from coverage; `.coverage-thresholds.json` only listed `src/app/**/_layout.tsx`, creating a misleading false record.

**Fix applied:** `.coverage-thresholds.json` exclusion broadened to `"src/app/**"` — now matches `jest.config.js`.

### MINOR-2 (resolved) — Root `tsconfig.json` injects Jest globals into production files

**Prior finding:** `"types": ["jest"]` in root `tsconfig.json` contaminated production TS files with Jest globals.

**Fix applied:**
- `app/tsconfig.json` — `"types": ["jest"]` removed; `__tests__` and `src/**/__tests__` added to `exclude`
- `app/tsconfig.test.json` (new) — extends root, adds `"types": ["jest"]`, includes test file patterns only

### MINOR-3 (deferred, no change) — `respect_signal_90d` bigint/number type mismatch

Per prior Codex verdict, this is acknowledged but deferred. No current impact in Phase 1. Will be addressed when aggregate math is implemented.

---

## Previously Challenged Findings (do NOT re-open)

These were challenged by Codex in the prior review and confirmed as acceptable. Do not revisit unless you find new evidence specific to the current change set:

- **CR-01** (`availability_flags_public` view shadowing): Confirmed correct — PostgreSQL default views use view owner permissions for underlying table access. Not converting to SECURITY DEFINER.
- **CR-02** (`ratings_public` view anon access): Confirmed correct — same owner-context behavior. Not converting to SECURITY DEFINER.
- **CR-04** (Mapbox v10 npm / v11 native): Confirmed intentional. `@rnmapbox/maps@10.3.1` targets native SDK 11.x. Prior EAS build succeeded.
- **CR-05** (`jest.isolateModules` propagation): Confirmed — exceptions do propagate from the callback. Tests pass with 100% coverage.

---

## Antigravity Verdict (2026-06-24) — APPROVE

Antigravity reviewed `20260624000000_block_fixes.sql`, `20260624000001_phase1_fixes.sql`, and `20260624000002_ratings_privacy_fix.sql`.

**Key approvals:**
- `revoke select on ratings from authenticated` (line 14 of 000002): closes the rater-identity bypass
- Both radius functions recreated with `ST_SetSRID(ST_MakePoint(...), 4326)::geography` for SRID consistency
- Grants correctly re-applied after `create or replace function`
- `security definer`, `set search_path = public`, `stable` all retained
- Shadowban NOT NULL backfill in 000001: safe and correct
- No new issues introduced

Full artifact: `.claude/antigravity-review-latest.md`

---

## Verification Evidence

- `npm test` (from `app/`): **7/7 tests pass** — 2 suites (`appConfigSmoke`, `supabase`)
- All three migrations applied to live Supabase project `ebmzhjmmtmldhrojkdqw` via `supabase db push`
- Committed at: `10fd5fa` (fixes 1-3 + migration 000001), `5481549` (migration 000002)

---

## Review Instructions

1. Read this prompt in full
2. Read each file in scope from disk — do not rely on this prompt as a substitute for evidence
3. Run `npm test` and `npm run test:coverage` from `app/` if not already passing
4. Confirm each fix addresses the prior finding
5. Flag any new issues introduced
6. Return verdict using the standard Codex format

## Expected Output Format

```md
## Codex Review - Phase 1 Fix Pass (2026-06-24)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### Findings
- [CRITICAL/MAJOR/MINOR] file:line - Description, impact, required fix.

### Open Questions
- Questions only when the answer affects merge safety.

### Verification
- Commands run and results.

### Approved
- What is correct and ready.
```

Save your completed review to `.claude/codex-review-latest.md`.
