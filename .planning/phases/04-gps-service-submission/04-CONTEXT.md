# Phase 4: GPS Service & Submission - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users physically present at a bathroom can submit it. A GPS sample is validated server-side (accuracy, freshness, mock-detection). Submitted locations enter a pending state awaiting verification (Phase 5 builds the verification/publish gate itself). Access codes (PINs) and timing tips are writable in this phase — before Phase 8 attempts to display them. This phase also covers non-building submissions (no street address), the `access_sensitivity` flag submitters set (feeds Phase 3's already-shipped `family_mode` RPC filter), and the submitter-facing pending-pin experience on the map.

</domain>

<decisions>
## Implementation Decisions

### Non-building locations
- **D-01:** No street address → free-text location description replaces the address field entirely (e.g. "North parking lot restroom, Alton Baker Park").
- **D-02:** No new `location_type` field — the existing "Public Facility" policy tag already covers parks/trailheads/port-a-potties adequately.
- **D-03:** No distinct pin/icon styling for non-building locations — same marker as everything else, for now.
- **D-04:** Explicit "No address? Describe the location instead" skip-autocomplete affordance — not autocomplete-always-active. Toggles the address field from Google Places autocomplete mode to plain free-text.
- **D-05:** GPS is always canonical for coordinates. The address/description field is a human-readable label only, never geocoded — the real lat/lng always comes from the submitter's live GPS fix at Step 3.

### access_sensitivity submission UX
- **D-06:** `access_sensitivity` is a binary flag, not a multi-tier scale — matches the exact `'sensitive'` sentinel Phase 3's `family_mode` RPC filter already checks for (`access_sensitivity IS DISTINCT FROM 'sensitive'`).
- **D-07:** Intended meaning: adult/nightlife venues (bars, adult stores, nightclubs) — matches the `family_mode` name's intent.
- **D-08:** Required question in SubmitFlow Step 1 (grouped with policy tag and accessibility tags), defaults unselected. Submitter must consciously toggle it on; it does not default to sensitive.
- **D-09:** When left off (default), `submit_location` writes **NULL** to `access_sensitivity` — matches Phase 3's D-08 null-include convention (a null value is never treated as sensitive, consistent with how nulls pass every other filter in this schema).
- **D-10:** Toggle copy: **"Not suitable for kids"** — user's explicit choice, made directly over the recommended alternative ("Adult/nightlife venue — hide from Family mode"). ⚠ Note for planner/researcher: this phrasing is more declarative than the project's usual community-reported liability framing (compare `policy_tag`'s "community-reported, not declarative" principle in PROJECT.md). This was a deliberate user choice, not an oversight — do not re-litigate, but the copy may benefit from a supporting explainer line to keep the overall framing consistent (see D-12).
- **D-11:** Set once at submission only. Corrections/disputes go through the Report flow (`report_location`), not a separate edit-your-own-submission UI in Phase 4.
- **D-12:** Short explainer microcopy appears under the toggle, stating the concrete effect (hides the location from users with Family mode enabled).
- **D-13:** UI component: a switch/toggle (standard binary on/off control) — visually distinct from `policy_tag`'s segmented picker, signaling "this is a flag" not "pick a category."
- **D-14:** Toggle is available regardless of `policy_tag` — no conditional field logic based on which policy tag is selected.
- **D-15:** Submitting with the toggle ON requires a confirmation dialog before final submit ("This location will be hidden from Family mode users").
- **D-16 (schema gap, tracked for Phase 7):** The live `reports.report_type` CHECK constraint has no value for disputing a sensitivity tag. Do **NOT** reuse `'inaccurate_information'`. A new value (e.g. `'wrong_sensitivity_tag'`) must be added via a future migration — same pattern as the existing RC-02 (`'duplicate_location'` missing from the same constraint). This is a Phase 7 requirement, not Phase 4's to fix, but Phase 4's Report-flow-based correction decision (D-11) depends on it eventually landing.

### Access code (PIN) field framing
- **D-17:** PIN field only appears in SubmitFlow when `policy_tag = 'Code Required'` — conditionally shown, not present for other policy tags.
- **D-18:** The entire SubmitFlow wizard requires sign-in from the start (consistent with the existing "no anonymous submissions" out-of-scope decision in PROJECT.md) — not just at the PIN field.
- **D-19:** PIN field copy: **"Door code (optional) — only shown to signed-in users"** — states the privacy guarantee directly.
- **D-20:** Freeform text input, generous max length (e.g. 100 chars) — covers numeric keypad codes, alphanumeric codes, and free-text instructions ("ask barista"). No numeric-only or fixed-length validation.
- **D-21 (scope expansion within Phase 4):** Phase 4 also builds an **update-code flow** for already-published locations — a distinct `update_access_code` RPC + UI — not deferred to Phase 5/7. This directly implements PROJECT.md's existing "submit/update the access code" requirement; it is a HOW decision, not new scope.
- **D-22:** `submit_location` (and the new update path) records a **"code last confirmed at" timestamp** now, even though no UI surfaces it until a later phase. Defaults to `created_at` on insert; resets to `now()` on update. Avoids a future backfill migration once code-freshness UI is built (matches the project's core "codes degrade over time" value prop).
- **D-23:** The "Update door code" action lives as a signed-in-only button on the existing LocationDetail sheet — not a separate screen/flow.
- **D-24:** Overwriting an existing code is **not** immediate — it requires 1 confirming verification before it replaces the old value. Mirrors the location-publish confirmation pattern rather than trusting a single submitter's overwrite outright (abuse-resistance: a malicious update could break a working code for everyone).
- **D-25:** On update, the timestamp resets and the old code value is simply overwritten — no history/audit log kept. Consistent with how `policy_tag`/`access_sensitivity` are handled (no versioning of correctable fields anywhere else in this schema).

### Pending-pin tap behavior
- **D-26:** Tapping the submitter's own pending pin (the distinct `pinPending` color from Phase 3, visible only to the submitter) opens a **pending-status sheet** — reuses the LocationDetailSheet pattern but with pending-specific content, not the normal published-location detail.
- **D-27:** The sheet shows **verification progress + what's needed** (e.g. "0 of 2 verifications" or an estimated publish timeline), sourced from the `submissions` row's `confirmation_count`/`expires_at`.
- **D-28 (scope expansion within Phase 4):** Add a **"withdraw submission"** action on the pending-status sheet — lets the submitter cancel their own pending row directly. This goes beyond the roadmap's literal success criteria but was chosen deliberately as a natural corollary of showing the submitter their own pending state.
- **D-29:** Withdrawing makes the pin **disappear from the map entirely** (as if never submitted) — no lingering "withdrawn" state to display or manage.
- **D-30:** Withdrawing requires a confirmation dialog first ("Are you sure? This can't be undone") — consistent with the confirm-before-destructive-action pattern established for the sensitivity toggle (D-15).

### Claude's Discretion
None outstanding — every gray area in this discussion reached an explicit user decision (several diverged from the recommended option; see D-10, D-21, D-28 above).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Submissions requirement block (access_sensitivity, non-building location note, "submit/update access code" requirement), Policy Tags & Accessibility section, "no anonymous submissions" out-of-scope decision
- `.planning/ROADMAP.md` §"Phase 4: GPS Service & Submission" — goal, depends-on, requirements, success criteria (10 items), planned plans (04-01, 04-02)

### Design system & wizard spec
- `.planning/phases/01.5-ux-foundation-design-system/01-5-CONTEXT.md` — original 3-step Submit Flow wizard spec (Step 1 name/address/policy tag/accessibility tags; Step 2 access/hours; Step 3 GPS confirm), Google Places autocomplete on the address field
- `docs/design/wireframes.md` — Submit flow wireframes (for exact field layout/placement within Step 1/2)
- `docs/design/design-system.md` §20 — Component Acceptance Checklist, required for all new screens this phase builds

### Schema & RPC contracts
- `docs/schema-contract.md` — `locations.access_sensitivity`, `locations.access_instructions` columns; `reports.report_type` CHECK constraint values (no sensitivity-dispute value exists yet — D-16); `submissions` table shape referenced at line 96 ("client inserts must go through submissions + verification gate")
- `app/src/lib/database.types.ts` — live `submissions` Row/Insert types (`id`, `location_id` nullable, `submitter_id`, `status`, `confirmation_count`, `expires_at`, `created_at`, `updated_at`) — the exact mechanism for pending-location storage (does `submit_location` write directly to `locations` with a pending flag, or does `locations` only get created on first verification?) is still open and is Phase 4 **research's** job to resolve, not decided here.
- `.planning/phases/03-read-path-map/03-RESEARCH.md` — A2 finding: `access_sensitivity = 'sensitive'` is the exact sentinel string the `family_mode` filter checks (`(not v_family or l.access_sensitivity is distinct from 'sensitive')`); confirms null values pass through un-filtered (D-09 depends on this).
- `.planning/phases/03-read-path-map/03-01-SUMMARY.md` — seed fixture identity for the existing `'sensitive'` sentinel test row (row `05`, "A2 sentinel" tag)
- `.planning/phases/03-read-path-map/03-PATTERNS.md` — the exact `family_mode`/`access_sensitivity` SQL filter pattern already shipped, for consistency if Phase 4's new RPCs need to read the same flag

### Known future-phase gaps referenced by this discussion
- `reports.report_type` needs a new CHECK constraint value for sensitivity-tag disputes (D-16) — same class of gap as RC-02 (`'duplicate_location'` missing), tracked in `04-CONTEXT.md` here for Phase 7 to pick up.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/app/(components)/LocationDetailSheet.tsx` — existing sheet component with policy-tag-driven styling (`pinChillSpot`, `pinCodeRequired`, etc.); the pending-status sheet (D-26) and the "Update door code" button (D-23) should extend/reuse this rather than building a new sheet from scratch.
- `app/src/app/(tabs)/index.tsx` — already defines a `pinPending` color and Mapbox `match`-expression pin coloring (data-driven, not React state) from Phase 3; the pending pin's tap handler (`handleShapePress`) already exists and needs to be extended to route to the new pending-status sheet content for the submitter's own pending pins.
- `app/src/app/(tabs)/submit.tsx` — currently a placeholder (`<Text>Submit (Phase 3)</Text>`); this is where the full 3-step SubmitFlow wizard (RHF + Zod per roadmap SC8) gets built.

### Established Patterns
- Community-reported, non-declarative liability framing for `policy_tag` — see PROJECT.md — is the precedent D-10's copy diverges from (noted, not enforced).
- D-08 null-include filter convention (nullable columns use `IS DISTINCT FROM` / `IS NOT FALSE`, never bare equality) — applies to D-09's NULL default and should apply to any new filter Phase 4 writes touching `access_sensitivity` or the new code-timestamp column.
- Trust-score-weighted verification (existing pattern for location publish) — D-24 extends this same pattern to code-update confirmation rather than inventing a new gate.
- No versioning/history on correctable fields (`policy_tag`, `access_sensitivity`) — D-25 keeps code updates consistent with this: overwrite, no audit trail.

### Integration Points
- New `update_access_code` RPC (D-21) needs the same SECURITY DEFINER + auth-gated pattern as existing RPCs (`update_profile`, `delete_account`, Phase 3's search RPCs).
- The pending-status sheet (D-26) needs a way to distinguish "my own pending submission" from any other pin — likely via `submitter_id = auth.uid()` in whatever RPC/query backs the map's pending-pin layer; exact mechanism is research's job (see `canonical_refs` note on `submissions` table).

</code_context>

<specifics>
## Specific Ideas

- Toggle copy for access_sensitivity is literally **"Not suitable for kids"** — user's specific wording choice, not a placeholder (D-10).
- PIN field copy is literally **"Door code (optional) — only shown to signed-in users"** (D-19).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. D-21 and D-28 are scope *clarifications/expansions* within Phase 4 (implementing existing PROJECT.md requirements more fully), not new capabilities deferred elsewhere. D-16 is a tracked future-phase (7) schema gap, not a deferred feature idea.

</deferred>

---

*Phase: 4-gps-service-submission*
*Context gathered: 2026-07-07*
