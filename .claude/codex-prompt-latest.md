# Codex Review Prompt — Roadmap & Phase Audit (2026-06-24)

## Scope

This is a roadmap and phase-plan audit, not a code review. Review the Gotta Go project roadmap and phase definitions for:
- Completeness — does the build order cover everything needed for v1.0 launch?
- Correctness — are the success criteria testable and meaningful?
- Gaps — what is missing or under-specified?
- UI/UX — the product owner flagged that there is no dedicated UI/UX design phase. Assess this and recommend where/how design work should be incorporated.

## Files to Read

Read all of these from disk:

- `.planning/ROADMAP.md` — the full 9-phase roadmap
- `.planning/PROJECT.md` — requirements, constraints, key decisions, out-of-scope list
- `SPEC.md` — product spec (user flows, GPS, privacy, trust, shadowban, gamification)
- `docs/schema-contract.md` — database contract and RLS rules

## The UI/UX Gap

The product owner specifically raised: **there is no dedicated UI/UX design phase in the roadmap.**

Currently, UI is distributed across phases:
- Phase 2: sign-in / sign-up screens
- Phase 3: MapScreen + LocationDetail modal
- Phase 4: SubmitFlow screen
- Phase 5: VerifyFlow screen
- Phase 6: flag UI
- Phase 7: report UI
- Phase 8: Emergency Mode, ratings, UX polish, all error/empty/offline states

There is no upfront design phase that establishes: visual identity, design system, component library, navigation patterns, accessibility standards, or screen flows before implementation begins.

Assess:
1. Is the current "distribute UI across phases" approach appropriate for this app and team, or does it risk inconsistent UX and rework?
2. Should a dedicated UI/UX design phase be added — and if so, where in the sequence (before Phase 2, between phases, as a parallel track)?
3. What specifically should a UI/UX phase deliver? (wireframes, design tokens, component library, Figma file, etc.)
4. Are there UI/UX concerns specific to this app's emergency-use context (urgency UX, one-handed use, stress states, accessibility) that need upfront design decisions rather than phase-by-phase bolt-on?

## Roadmap Review Questions

Beyond UI/UX, assess:

1. **Build order**: Is the dependency chain correct? Any phase that needs something from a later phase?
2. **Missing phases or plans**: Any significant feature in PROJECT.md requirements that has no corresponding phase plan?
3. **Success criteria quality**: Are the listed success criteria for each phase actually verifiable, or are any vague/untestable?
4. **Phase sizing**: Any phases that are too large (risk of stalling) or too small (could be merged)?
5. **v1.0 completeness**: Does completing Phases 1–9 actually deliver the Eugene seed launch? Is anything missing?
6. **Apple Developer blocker**: Phase 9 includes iOS App Store submission. Apple Sign-In is required by App Store rules when Google OAuth is offered. Does the current roadmap handle this dependency correctly?
7. **Data seeding**: The Eugene launch requires 50+ verified locations. There is no phase for seeding/importing initial location data. Is this a gap?

## Context

- App is for people with acute urgency needs (IBS/Crohn's, wheelchair users, parents with infants) — UX failures during emergency mode are a BLOCK-level concern, not a polish concern
- Android-first for now; iOS blocked pending Apple Developer enrollment
- Tech stack: Expo SDK 55, Supabase + PostGIS, Mapbox, React Native
- Multi-agent review: Claude (implementation), Antigravity (PostGIS/RLS/architecture), Codex (quality/security/UX)
- No designers on team — all UI work done in-house

## Output Format

```md
## Codex Roadmap Review - Gotta Go v1.0 (2026-06-24)

**VERDICT: APPROVE / REQUEST CHANGES / BLOCK**

### UI/UX Assessment
[Detailed assessment of the UI/UX gap and recommendation]

### Roadmap Findings
- [CRITICAL/MAJOR/MINOR] - Description and required change

### Missing or Mis-sequenced Items
[List anything absent from the roadmap that should be there]

### Approved
[What is well-structured and ready to execute]
```

Save your completed review to `.claude/codex-review-latest.md`.
