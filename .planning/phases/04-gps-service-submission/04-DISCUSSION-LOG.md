# Phase 4: GPS Service & Submission - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 04-gps-service-submission
**Areas discussed:** Non-building locations, access_sensitivity submission UX, Access code (PIN) field framing, Pending-pin tap behavior

---

## Non-building locations

*(Completed in a prior session — 2026-07-07 earlier checkpoint.)*

| Question | Selected |
|---|---|
| What should the submitter enter instead of a street address? | Free-text location description replaces the address field |
| Does this need a distinct "location type" dimension? | No new field — "Public Facility" policy tag covers it |
| Distinct map pin/icon styling? | No, same styling for now |
| Autocomplete behavior? | Explicit "No address? Describe the location instead" skip affordance |
| Should the address ever be geocoded? | No — GPS fix from Step 3 is always canonical |

---

## access_sensitivity submission UX

| Option | Description | Selected |
|--------|-------------|----------|
| Binary flag | Matches existing 'sensitive' sentinel | ✓ |
| Multi-tier scale | More nuance, but filter only checks one string | |
| You decide | | |

**User's choice:** Binary flag (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Adult/nightlife venues | Matches family_mode name's intent | ✓ |
| Broader discretion | Vaguer, harder to word | |
| You decide | | |

**User's choice:** Adult/nightlife venues (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Required question, defaults unselected | Conscious choice, matches policy_tag | ✓ |
| Optional, defaults to not-sensitive | Lower friction, risks under-flagging | |
| You decide | | |

**User's choice:** Required question, defaults unselected (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Via existing Report flow | No new UI surface | ✓ |
| Dedicated correction UI now | More UI work now | |
| You decide | | |

**User's choice:** Via existing Report flow (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| NULL | Matches D-08 null-include convention | ✓ |
| Explicit 'standard' string | New convention, not used elsewhere | |
| You decide | | |

**User's choice:** NULL (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| "Adult/nightlife venue — hide from Family mode" | Community-reported framing | |
| "Not suitable for kids" | Shorter, more declarative/judgmental | ✓ |
| You decide | | |

**User's choice:** "Not suitable for kids" — **diverged from recommended option.**
**Notes:** Flagged as more declarative than the project's usual community-reported liability framing (policy_tag precedent), but this was the user's explicit, deliberate choice. Not re-litigated.

| Option | Description | Selected |
|--------|-------------|----------|
| Submission-only, corrections via Report | Consistent with community-correctable requirement | ✓ |
| Submitter can edit their own listing later | Bigger scope, new UI | |
| You decide | | |

**User's choice:** Submission-only, corrections via Report (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Short explainer text | Reduces mis-tagging | ✓ |
| Label only, no explainer | Terser | |
| You decide | | |

**User's choice:** Short explainer text (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Step 1, next to policy tag | Groups classification fields | ✓ |
| Step 2, next to access/hours | Splits classification fields | |
| You decide | | |

**User's choice:** Step 1, next to policy tag (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Available for any policy tag | No conditional logic | ✓ |
| Only shown for certain tags | Adds conditional field logic | |
| You decide | | |

**User's choice:** Available for any policy tag (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse 'inaccurate_information' | No schema change | |
| Add a new report_type value | More precise, needs migration | ✓ |
| You decide | | |

**User's choice:** Add a new report_type value — **diverged from recommended option.**
**Notes:** Tracked as a Phase 7 requirement (schema gap), same class as existing RC-02.

| Option | Description | Selected |
|--------|-------------|----------|
| No extra confirmation | Consistent with other Step 1 fields | |
| Confirmation dialog before final submit | Ensures submitter can't miss the consequence | ✓ |
| You decide | | |

**User's choice:** Confirmation dialog before final submit — **diverged from recommended option.**

| Option | Description | Selected |
|--------|-------------|----------|
| Switch/toggle | Standard binary control | ✓ |
| Segmented Yes/No (matches policy_tag style) | Visual consistency | |
| You decide | | |

**User's choice:** Switch/toggle (Recommended)

---

## Access code (PIN) field framing

| Option | Description | Selected |
|--------|-------------|----------|
| Only when Code Required | Field tied to code-locked doors | ✓ |
| Always visible, optional for all tags | More flexible, less focused | |
| You decide | | |

**User's choice:** Only when Code Required (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Sign-in required for entire SubmitFlow | Matches existing no-anonymous-submissions decision | ✓ |
| Sign-in only required at PIN field | Contradicts existing decision | |
| You decide | | |

**User's choice:** Sign-in required for entire SubmitFlow (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| "Door code (optional) — only shown to signed-in users" | States privacy guarantee | ✓ |
| "Access code (if applicable)" with no privacy note | Shorter, less reassuring | |
| You decide | | |

**User's choice:** "Door code (optional) — only shown to signed-in users" (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Freeform text, generous max length | Covers all real-world code formats | ✓ |
| Numeric-only, fixed length | Would reject valid non-numeric codes | |
| You decide | | |

**User's choice:** Freeform text, generous max length (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Not in Phase 4 scope | Keeps scope tight to roadmap SC | |
| Add it to Phase 4 | Distinct update_access_code RPC + UI now | ✓ |
| You decide | | |

**User's choice:** Add it to Phase 4 — **diverged from recommended option.**
**Notes:** Scope expansion within Phase 4, implementing PROJECT.md's existing "submit/update" requirement more fully — not new capability.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add a timestamp column now | Avoids future backfill migration | ✓ |
| No, defer entirely | Keeps scope minimal, risks future backfill problem | |
| You decide | | |

**User's choice:** Yes, add a timestamp column now (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Button on LocationDetail sheet | Reuses existing screen | ✓ |
| Separate screen/flow entirely | More isolated, new nav path | |
| You decide | | |

**User's choice:** Button on LocationDetail sheet (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate overwrite, trust-score weighted | Matches existing trust-weighting pattern | |
| Requires 1 confirming verification before it replaces the old code | Mirrors publish-confirmation pattern | ✓ |
| You decide | | |

**User's choice:** Requires 1 confirming verification before it replaces the old code — **diverged from recommended option.**

| Option | Description | Selected |
|--------|-------------|----------|
| Reset timestamp, overwrite value, no history kept | Consistent with other correctable fields | ✓ |
| Keep a history log of prior codes | New mechanism, more defensible | |
| You decide | | |

**User's choice:** Reset timestamp, overwrite value, no history kept (Recommended)

---

## Pending-pin tap behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Opens a pending-status sheet | Reuses LocationDetailSheet pattern | ✓ |
| Opens the normal LocationDetailSheet as-is | Shows fields that don't make sense yet | |
| You decide | | |

**User's choice:** Opens a pending-status sheet (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Verification progress + what's needed | Reduces "did this even save?" anxiety | ✓ |
| Just the submitted details, no progress info | Simpler, less reassuring | |
| You decide | | |

**User's choice:** Verification progress + what's needed (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| No cancel action in Phase 4 | Keeps scope tight | |
| Add a "withdraw submission" action | New capability, useful for mistakes | ✓ |
| You decide | | |

**User's choice:** Add a "withdraw submission" action — **diverged from recommended option.**
**Notes:** Scope expansion within Phase 4 — natural corollary of showing the submitter their own pending state.

| Option | Description | Selected |
|--------|-------------|----------|
| Disappears entirely | No lingering state to manage | ✓ |
| Stays visible as 'withdrawn', greyed out | More state to track, unclear value | |
| You decide | | |

**User's choice:** Disappears entirely (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, confirmation dialog | Consistent with sensitivity-toggle confirm pattern | ✓ |
| No confirmation, immediate withdraw | Faster but inconsistent | |
| You decide | | |

**User's choice:** Yes, confirmation dialog (Recommended)

---

## Claude's Discretion

None — every gray area reached an explicit user decision.

## Deferred Ideas

None. Two decisions (update-code flow, withdraw-submission action) expanded Phase 4's scope to more fully implement existing PROJECT.md requirements rather than introducing new capabilities; one decision (new `report_type` value) was tracked as a Phase 7 schema-gap requirement rather than deferred as a feature idea.
