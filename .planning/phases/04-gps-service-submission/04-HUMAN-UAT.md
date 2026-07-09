---
status: partial
phase: 04-gps-service-submission
source: [04-VERIFICATION.md]
started: 2026-07-08T07:10:00Z
updated: 2026-07-09T22:23:06Z
---

## Current Test

[awaiting human testing]

## Status Note (2026-07-09)

Phase 4 code, static verification, and external review gate are closed at commit `bf93a37`; both Antigravity and Codex approve the 32-file queue. These two tests remain pending because they require real device/GPS/Mapbox behavior. Do not mark this UAT file `complete` or `resolved` until the walkthroughs below are actually performed.

## Tests

### 1. SubmitFlow wizard end-to-end device walkthrough
expected: Sign out → open Submit tab → confirm AuthRequiredModal blocks the form. Sign in → Step 1: enter name, tap "No address? Describe the location instead" and confirm free-text mode, pick a policy tag, toggle "Not suitable for kids" ON and read the effect explainer. Step 2: select Code Required and confirm the PIN field appears with the locked copy; switch policy and confirm it disappears; enter a timing tip. Step 3: confirm the live accuracy readout; indoors/low-accuracy keeps "I'm at This Location" disabled with ERR-02; move to an open area and confirm it enables. Because sensitivity is ON, confirm the D-15 dialog fires before submit; approve and confirm the Success screen appears with "Back to Map" returning to the map. Component Acceptance Checklist (design-system.md §20) passes for this screen. (Why human: real GPS accuracy readings, OS permission prompts, and Android mock-location detection cannot be exercised in jest; no physical device/simulator available in this environment.)
result: [pending]

### 2. Pending-pin map layer, PendingStatusSheet withdraw, and code-update device walkthrough
expected: As the submitter (after submitting via the wizard), confirm a gray dashed "Pending" pin appears on the map, and that it disappears when signed out / viewing as a different account. Tap the pending pin → confirm the PendingStatusSheet shows "Pending — 1 of 2 GPS verifications received…" with no Rate/Report/Directions row. Tap "Withdraw submission" → confirm the "Are you sure? This can't be undone" dialog → confirm → the pin disappears from the map entirely. On a published location's LocationDetailSheet, signed out: confirm "Update door code" routes to AuthRequiredModal. Signed in: propose a new code → confirm a pending-confirmation state (not "live now"). Component Acceptance Checklist (§20) walked before Codex review. (Why human: native Mapbox pin rendering, submitter-scoped visibility across accounts, and real-device withdraw/code-update flows cannot be exercised in jest; no physical device/simulator available in this environment.)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

None — both items are deferred device-UAT, not defects. All 10 ROADMAP success criteria and 6 requirement IDs are independently code-verified (see 04-VERIFICATION.md). Consistent with Phase 3's precedent of 7 similarly-deferred device-UAT items and this project's `workflow.human_verify_mode = end-of-phase` default.
