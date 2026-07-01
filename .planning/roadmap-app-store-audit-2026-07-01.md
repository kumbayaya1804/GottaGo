# Roadmap App Store Success Audit - 2026-07-01

Reviewer: Claude (Sonnet 5)
Scope: `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `SPEC.md`, and supporting research (`.planning/research/FEATURES.md`, `PITFALLS.md`), against App Store / Play Store submission and post-launch success criteria.

**Not in scope for this audit** (already covered elsewhere, not re-litigated here):
- Per-phase execution readiness / GSD articulation depth — see `.planning/phase-articulation-qa.md`
- Technical/doc drift (schema, harness, dependencies) — see `.planning/stale-info-scan-latest.md`

**Question this audit answers:** does the current 10-phase sequence (1 → 1.5 → 2 → 3 → 4 → 5 → 6 → 7 → 7.5 → 8 → 9) still lead to an app that will do well once released — not "will it pass code review," but "will it pass store review and earn organic growth once live."

## Severity Legend

- **LAUNCH-BLOCKING GAP**: not yet in any phase's scope, and its absence would likely cause store rejection or a launch-killing failure mode (cold start, trust collapse) if not folded in before the relevant phase closes.
- **SHOULD ADD TO ROADMAP**: a valuable, low-to-medium-cost item identified by the project's own research but never triaged into either "Active" requirements or "Out of Scope" — currently in limbo, not a deliberate decision.
- **WATCH**: not urgent, but worth recording now so a downstream phase doesn't have to re-derive context that already exists.
- **STRENGTHS**: already well-handled — confirmed, not reopened.

---

## LAUNCH-BLOCKING GAP

### 1. No user-facing "report a user" or "block a user" mechanism (Apple 1.2 / Play UGC policy)

Gotta Go has user-generated content beyond location facts: free-text `timing_tips`, ratings, and access codes are all authored by identifiable accounts and shown to other users. Apple App Review Guideline 1.2 (User Generated Content) requires apps with UGC to provide, at minimum: (a) a method to filter objectionable content, (b) a mechanism for users to report objectionable content with a commitment to timely action, (c) the ability to block abusive users, and (d) published contact information. Google Play's User Generated Content policy imposes the same substantive requirements.

What currently exists (`.planning/ROADMAP.md` Phase 7, `SPEC.md` "Report A Problem" / "Moderation") is entirely **location**-scoped: `report_location` accepts 5 types (`permanently_closed`, `currently_locked`, `inaccurate_information`, `dirty_unsafe`, `moved_relocated`), and moderation is admin-side only (shadowban via Supabase Studio in v1 — no in-app admin UI). There is no `report_user` action, no in-app "block this contributor" affordance, and no published support contact commitment recorded in the roadmap.

**Why this belongs in the roadmap now, not discovered at Phase 9 submission:** the reports/moderation RPC surface, RLS policies, and admin functions are all being designed in Phase 7. Adding a `report_user` RPC and a client-side content filter (same enforcement point as shadowban filtering — exclude content from blocked user IDs) is a natural extension of that phase's existing work. Retrofitting it after Phase 8 (Client UX) has shipped detail screens and after Phase 9 is already assembling the store submission would mean redesigning RLS and re-touching every screen that renders user-authored text.

**Recommendation:** extend Phase 7's scope (or add a 7.1) to include: `report_user` RPC, a `blocked_users` join table enforced at the same query boundary as shadowban filtering, and confirm a support contact address is committed in Settings + store listing metadata (already tracked loosely under Phase 9's "App Store metadata" line — make the contact-info requirement explicit there too).

---

## SHOULD ADD TO ROADMAP

### 2. Save / favorite a location — identified as a retention lever, never triaged

`.planning/research/FEATURES.md:101` names this explicitly: *"Save / favorite locations — Standard expectation that competitors miss; high retention lever for the parent segment ('my home base bathroom is at...')"* — low complexity, one join table (`user_favorites`), no new trust/verification logic. It does not appear in `PROJECT.md` Active requirements, any `ROADMAP.md` phase, or Out of Scope. It fell through the gap between research and roadmap rather than being deliberately deferred.

**Recommendation:** either add to Phase 8 (Client UX & Emergency Modes) scope — it fits naturally alongside the rating UI and LocationDetail polish already planned there — or move it to `PROJECT.md` Out of Scope with a stated reason if the decision is to defer to v2. Either is fine; leaving it unrecorded is the problem.

### 3. "Family Mode" — defined in the glossary, absent from every requirement and phase

`CONTEXT.md:42` defines Family Mode at length ("A user setting that filters results to locations appropriate for children. Removes locations where adult or sensitive context might apply.") but the term does not appear anywhere in `PROJECT.md` Active requirements, `ROADMAP.md`, or `SPEC.md`. Given that Chill Spots explicitly include bars (`CONTEXT.md:25`, `PROJECT.md:73`) and parents-with-infants are named as a primary acquisition segment, this is either a genuinely valuable, currently-unscoped filter dimension, or stale vocabulary from an earlier product iteration that should be removed so it doesn't get treated as current scope by a future contributor or agent reading the glossary at face value.

**Recommendation:** make an explicit call — fold into the Phase 3/8 filter set (it composes naturally with the existing Chill Spot / accessibility filter chips), or strike it from `CONTEXT.md`. Don't leave a glossary entry describing a feature that isn't anywhere in the plan.

### 4. ASO / store-listing strategy is a checklist line, not a plan

Phase 9's only touchpoint on this is one bullet in plan `09-03`: *"App Store + Play Store submission prep"*, and one success criterion: *"App Store metadata, screenshots, privacy policy URL (Termly), and age rating complete."* Meanwhile `.planning/research/FEATURES.md` already contains real competitive analysis (Flush, SitOrSquat, Refuge Restrooms, Toilet Finder, GoHere, Diaper Changing Table Finder) that identified the exact complaint clusters driving 1-star reviews across the category ("pins aren't real," "I can't fix it / report it" — `FEATURES.md:10-17`) and named `report_location` as the differentiating "moat" feature. That synthesis is exactly the input a strong App Store title/subtitle/screenshot narrative needs, but nothing in the roadmap connects it to Phase 9's listing work — as written, Phase 9 could produce generic, category-boilerplate metadata despite the project already having done the hard part of figuring out what makes Gotta Go different.

**Recommendation:** when Phase 9 reaches its discuss/plan stage, explicitly carry `FEATURES.md`'s competitive synthesis into the store-listing copy decisions (e.g., leading with "report what's wrong and see it fixed" as the differentiator, since that's the documented #1 gap in every competitor). No roadmap change needed today — just don't let this get planned in isolation from research that already exists.

### 5. Zero re-engagement infrastructure, and the omission is undocumented

`.planning/research/FEATURES.md:109,132` evaluated push notifications twice and reached a considered, non-spammy recommendation (scope to "your contribution was verified" / "your reported location was fixed" — reward loops, not interruption) but that conclusion never landed anywhere: it's not in `PROJECT.md` Active, and not in Out of Scope either. Given the privacy/abuse concerns are real and documented, deferring all notification infrastructure from v1 is a defensible call — but right now it reads as an oversight rather than a decision, and whoever plans Phase 8/9 next will either re-litigate it from scratch or ship v1 with no answer to "why would a user open this app on day 3" beyond organic need.

**Recommendation:** add a line to `PROJECT.md` Out of Scope (v1) recording the decision and the `FEATURES.md` reasoning, so it's a closed decision instead of an open gap.

---

## WATCH

### 6. Confidence-decay constants exist in research but aren't yet cited in Phase 6's success criteria

`SPEC.md` lists "Confidence decay formula" as an open product decision, and `.planning/research/PITFALLS.md` (HIGH-1) already proposes concrete, attribute-specific half-lives (PIN codes: 7-day; hours: 30-day; physical existence: 180-day). `ROADMAP.md` Phase 6's success criteria only say "confidence decay function applies... floor enforced" without citing these numbers. Low risk today — Phase 6 is four phases out and will get its own `CONTEXT`/`RESEARCH` pass before execution — but worth flagging now so those specific constants get pulled forward instead of re-derived (or forgotten) when Phase 6 planning starts.

### 7. Phase 7.5's success criteria measure supply (seeded locations) but not demand (did it work)

Phase 7.5 (Growth & Seed Operations) success criteria are entirely supply-side: coverage targets, idempotent import, verified starter clusters. `.planning/research/PITFALLS.md` CRITICAL-7 ("Cold Start") already defines the demand-side detection signals that determine whether seeding actually worked: *"Sessions per user per week in promoted regions < 1.5 = cold start failing. Empty-result-rate > 20% in promoted regions = density insufficient."* Those thresholds currently live only in a research doc's "Detection" footnote, not as a Phase 7.5 or Phase 8 launch-readiness gate.

**Recommendation:** when Phase 7.5 is planned, promote the CRITICAL-7 thresholds into its success criteria (or Phase 8's) as an explicit go/no-go gate before public launch — not just a thing to notice after the fact.

### 8. No monetization means no obvious answer to "how does this grow beyond organic," and that's fine — just naming it

`PROJECT.md` correctly defers monetization to post-validation (Out of Scope v1). This isn't a defect — validating the core loop before adding revenue pressure is the right sequencing — but it means v1's entire growth story rests on Phase 7.5's marketing/seeding execution and word-of-mouth in parent/accessibility communities. Purely informational: don't mistake the absence of a monetization/paid-acquisition lever for an oversight when evaluating post-launch traction.

---

## STRENGTHS

Confirmed, not reopened — these are already correctly handled and don't need rework:

- **Browsing is not gated behind sign-in.** Per `docs/design/design-system.md` ERR-10/ERR-11, only Submit/Verify/Rate/Report/access-code-reveal require auth; map discovery is open. This is exactly right for App Store reviewer first impressions and organic conversion — a forced signup wall before showing any value is one of the most common indie-app churn and rejection-adjacent complaints, and Gotta Go already avoids it.
- **Apple Sign-In / Google OAuth sequencing already threads Guideline 4.8** (`ROADMAP.md` Phase 2 success criteria) — Android-only Google with an iOS Apple-Sign-In stub is the correct interim answer, not an afterthought.
- **Account deletion (5.1.1), background-location avoidance (5.1.5), and denied-permission fallback** are named pitfalls (`PITFALLS.md` HIGH-4, HIGH-5) with concrete prevention already written into Phase 2/3 success criteria — these are handled as designed requirements, not hoped-for outcomes.
- **Legal docs already exist** (`docs/legal/privacy-policy.md`, `terms-of-service.md`) and are wired into Phase 2 onboarding requirements — this is often a last-minute scramble for indie/solo-founder apps, and Gotta Go has it lined up early.
- **Competitive research actually steered the roadmap.** `FEATURES.md` identified "report a problem" as the #1 weakness across every comparable app and named it the product's "moat" — Phase 7 exists because of that finding. This is a rare case of research output changing what got built, not just filed away.
- **Cold start is named and answered.** `PITFALLS.md` CRITICAL-7 identifies the single most likely cause of a crowdsourced app collapsing to low ratings in its first month (global availability with no local density), and Phase 7.5 exists specifically to prevent it. Most solo-founder crowdsourced apps skip this step entirely and launch to an empty map.

---

## Summary Table

| # | Finding | Severity | Recommended landing phase |
|---|---|---|---|
| 1 | No report/block-user mechanism (Apple 1.2 / Play UGC) | LAUNCH-BLOCKING GAP | Phase 7 (extend scope) |
| 2 | Save/favorite locations never triaged | SHOULD ADD TO ROADMAP | Phase 8, or explicit Out of Scope |
| 3 | "Family Mode" orphaned in glossary | SHOULD ADD TO ROADMAP | Phase 3/8, or strike from CONTEXT.md |
| 4 | ASO strategy disconnected from existing competitive research | SHOULD ADD TO ROADMAP | Phase 9 discuss stage |
| 5 | Push notification deferral undocumented | SHOULD ADD TO ROADMAP | PROJECT.md Out of Scope (record decision) |
| 6 | Decay half-life constants not yet in Phase 6 criteria | WATCH | Phase 6 planning |
| 7 | Cold-start detection thresholds not in launch gate | WATCH | Phase 7.5 / Phase 8 planning |
| 8 | No monetization = organic-only growth (informational) | WATCH | N/A |

**Next review:** fold items 1-5 into the relevant phase's `CONTEXT.md` when that phase is next discussed/planned, or explicitly move to Out of Scope with a reason. This audit does not require code changes, Antigravity/Codex review, or a `PROJECT.md` edit by itself — it's a decision-forcing input for the next planning session on each named phase.
