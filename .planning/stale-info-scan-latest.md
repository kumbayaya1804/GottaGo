# Stale Information Scan - 2026-07-31

Trigger: harness change — the review-gate hardening workstream converged and committed
(`d03bfe7`, 8 rounds) and the TDD Guard → Probity migration landed (queued, Antigravity
ADVISORY, awaiting Codex). `docs/stale-info-scan.md` requires a scan after harness/dependency
changes. **Scope note:** this is a harness-triggered scan focused on Agent Harness Drift and
Codex/Antigravity Prompt Drift per `docs/stale-info-scan.md`'s own categorization — it does not
re-run the full monthly scope (product/brand drift, Claude-model-ID drift, full security/privacy
sweep). Those were last covered 2026-07-15 or earlier and are unrelated to this trigger.
Branch: master
Commit: 0245cae (HEAD at scan time; review-gate d03bfe7 and Probity migration both post-date this)
Next review due: 2026-08-30 (30-day cadence) or the next harness/dependency change, whichever
comes first.

> **2026-09-07 follow-up:** both UPDATE REQUIRED items below were resolved (`a1b42c2`, `b45db29`)
> before this scan was committed. The 30-day cadence date above is now past — a fresh full-scope
> scan is overdue and should be run next.

## Commands Run

- `git status --short`, `git diff --name-only` — baseline.
- `rg` sweep for `Gemini|gemini-review|GEMINI\.md|TODO|TBD|deprecated|outdated|stale|drift|Last reviewed`
  across `AGENTS.md CLAUDE.md CODEX.md ANTIGRAVITY.md SPEC.md docs .claude/skills .claude/commands` —
  no leftover TODO/deprecated/Gemini markers found; all "stale" hits are the tooling's own
  self-referential vocabulary (skill/doc names, not actual drift markers).
- Read `docs/agent-harness.md` in full (179 lines) and diffed its claims against the actual current
  behavior of `.claude/hooks/check-review-artifacts.js` (post round-8, commit `d03bfe7`).
- Read `ANTIGRAVITY.md`'s `## Review Output` (169-218) and `### Calibration Exit Gate` (94-121)
  sections; read `CODEX.md`'s `## Review Output` (128-173) section. Compared both against the hook's
  `REQUIRED` array (headings + `requiredText` per reviewer/artifact type) and `validateCalibration()`.
- `cat .claude/antigravity-calibration-contract.json` — confirmed the live contract's actual fields.

## BLOCKING STALE INFO

- None found in this pass.

## UPDATE REQUIRED

- None outstanding. Both items this scan raised were resolved after it ran:
  - **`ANTIGRAVITY.md`'s `### Calibration Exit Gate` did not mention the `passingVerdicts` contract
    field** (hook-required since round 4; live contract declares `"passingVerdicts": ["ADVISORY"]`).
    A calibration author following only `ANTIGRAVITY.md` would not know the field is required or that
    an archived `VERDICT: BLOCK` would be rejected. **Resolved in commit `a1b42c2`** —
    "docs(harness): fix ANTIGRAVITY.md's Calibration Exit Gate to describe passingVerdicts".
  - **The two disclosed review-gate architectural gaps** (working-tree reads for
    policy/calibration/packets/verdicts instead of Git-index reads; self-asserted calibration truth —
    `passed`/`falseApprovals` are author-supplied) **were not disclosed in `docs/agent-harness.md`**,
    the canonical harness contract doc. **Resolved in commit `b45db29`** —
    "docs(harness): disclose 2 review-gate architectural gaps in agent-harness.md".

## WATCH

- `.claude/reviews/` growth: now spans 8 rounds' worth of archives (rounds 1-8) plus the
  `database.types.ts` and (pending) Probity-migration archives. Still small in absolute terms but the
  directory count is growing steadily; revisit if clone size becomes a real concern.
- `.claude/antigravity-review-policy.json` remains `mode: probation`, `calibrationStatus: not_run`. No
  calibration has been run yet — intended state, not drift. (The two doc gaps that would have made a
  calibration attempt work from an incomplete doc are now closed — see UPDATE REQUIRED, resolved
  `a1b42c2` / `b45db29`.)
- The dblink two-session concurrency-race harness (`phase5_discovery_cooldown_race.test.sql`) remains
  unproven — tracked separately in `.planning/STATE.md`, not a harness-doc drift issue.
- `docs/codex-model-routing.md` and the Codex contingency-orchestrator guidance were not re-verified in
  this pass (unrelated to this trigger); last confirmed 2026-07-09.
- Full monthly-scope items not covered by this harness-triggered pass: product/brand drift, Claude
  model-ID drift (`.planning/config.json` `model_profile_overrides` and any hardcoded model IDs),
  schema/Supabase live-drift beyond what today's Probity/dependency work touched, and the full
  security/privacy secret-leak sweep. Next full scan should cover these; due by the 30-day cadence
  regardless (2026-08-30) even if no further harness change triggers one sooner.

## CURRENT

- `.claude/hooks/check-review-artifacts.js`'s actual enforcement (post round-8): fixed-point percent +
  CommonMark/HTML5 character-reference decoding (41-entry verified table) for blind-review detection;
  blob-OID archive-vs-index comparison (correct under `core.autocrlf=true`); `passingVerdicts`-gated
  calibration archive value check; fail-closed missing-policy handling; `.beads/hooks/` protected as a
  review-required path; `probity` added alongside `tdd-guard` in the protected-path regex (2026-07-31,
  same-day as this scan). Suite: 54/54, 0 skipped, reproduced directly in this pass.
- `ANTIGRAVITY.md`'s and `CODEX.md`'s `## Review Output` format sections (headings + required fields)
  match exactly what the hook's `REQUIRED` array checks for both prompt and verdict artifacts — verified
  by direct line-by-line comparison, not spot-checked. Only the Calibration Exit Gate *prose* (not the
  format section) is stale, per UPDATE REQUIRED above.
- `docs/agent-harness.md`'s "Standard Flow," "Prompt Packet Requirements," "Minimum Commit Gate," and
  archive-retention description are all still accurate against current hook behavior — the OID-based
  index-membership check added in round 6 is an internal mechanism change underneath the doc's
  byte-identity *contract* (archive content must still byte-match the verdict; that didn't change), so
  this is not treated as drift.
- `probity.config.ts`, `package.json`/`package-lock.json`, `CLAUDE.md`, `docs/agent-harness.md`'s
  TDD-tool references, and `.metaswarm/project-profile.json` all correctly reference Probity as of the
  2026-07-31 migration — verified during that migration's own pre-queue sweep, not re-verified here.
- No leftover Gemini/`gemini-review`/`GEMINI.md` references found anywhere in active workflow docs.

## Blocked Checks

- Antigravity calibration receipts still cannot be verified against a real run — no calibration has
  been performed; the hook's enforcement is covered by synthetic-fixture tests only. Unchanged from the
  prior scan.
- Archive immutability remains commit-time-enforced only; filesystem-level immutability is not claimed
  or checked. Unchanged from the prior scan.
- Live Supabase schema/RLS drift checks require credentials/network access not exercised in this pass
  (out of scope for a harness-triggered scan; would be needed for the next full monthly scan).
