---
phase: 05-trust-engine-verification
plan: 03
subsystem: app
tags: [expo-router, react-query, gps, verification, accessibility, ionicons, tdd]

requires:
  - phase: 05-trust-engine-verification
    plan: 02
    provides: verify_location, search_pending_submissions_nearby, get_my_unseen_submission_publications, acknowledge_submission_publication
provides:
  - "Verify modal at /verify (file app/src/app/(modals)/verify.tsx): nearby pending list, then a GPS check of the chosen bathroom, in one route"
  - "features/verify: verifyLocation, useVerify, useVerifyCandidates, getVerifyGpsSample, distanceMeters"
  - "features/submit/useMySubmissionPublications: owner-scoped unseen-publication read and acknowledge"
  - "PendingStatusSheet Published! state, wired on the Map screen independently of the pending query"
  - "A Verify nearby entry on the Nearby screen"
  - "Icon package @react-native-vector-icons/ionicons, with a jest stub"
affects:
  - "05-04 (profile impact stat reads the profileStats cache this plan marks stale after a verification)"
  - "05-05 (push is an enhancement on top of the in-app Published! state built here)"

key-files:
  created:
    - app/src/app/(modals)/verify.tsx
    - app/src/features/verify/types.ts
    - app/src/features/verify/verifyLocation.ts
    - app/src/features/verify/useVerify.ts
    - app/src/features/verify/useVerifyCandidates.ts
    - app/src/features/verify/useVerifyGpsSample.ts
    - app/src/features/verify/distance.ts
    - app/src/features/submit/useMySubmissionPublications.ts
    - app/src/features/verify/__tests__/verifyLocation.test.ts
    - app/src/features/verify/__tests__/useVerify.test.ts
    - app/src/features/verify/__tests__/verifyFlow.test.tsx
    - app/src/features/submit/__tests__/useMySubmissionPublications.test.ts
    - .planning/todos/pending/2026-10-11-ionicons-on-earlier-screens.md
  modified:
    - app/src/app/_layout.tsx
    - app/src/app/(tabs)/nearby.tsx
    - app/src/app/(tabs)/index.tsx
    - app/src/app/(components)/PendingStatusSheet.tsx
    - app/src/app/(components)/WithdrawConfirmModal.tsx
    - app/src/features/submit/types.ts
    - app/src/app/(tabs)/submit.tsx
    - app/src/features/auth/redirect.ts
    - app/src/app/auth/callback.tsx
    - app/src/app/gps-consent.tsx
    - app/src/app/__tests__/_layout.test.tsx
    - app/src/app/__tests__/(tabs)/nearby.test.tsx
    - app/src/app/__tests__/(tabs)/MapScreen.test.tsx
    - app/src/app/__tests__/(components)/PendingStatusSheet.test.tsx
    - app/src/features/auth/__tests__/redirect.test.ts
    - app/src/app/__tests__/auth/callback.test.tsx
    - app/src/app/__tests__/gps-consent.test.tsx
    - app/jest.setup.ts
    - app/package.json
    - app/package-lock.json
    - docs/design/design-system.md
    - docs/design/wireframes.md
    - .planning/phases/05-trust-engine-verification/05-UI-SPEC.md
---

# Plan 05-03 Summary: VerifyFlow and the Published! resolution

Status: built and verified by automated tests on 2026-10-11; in review, not committed. Device
checks are carried forward (see below).

## What was built

1. **Verify modal.** One route with two modes. List mode reads one GPS fix, asks
   `search_pending_submissions_nearby`, and shows the rows in the server's order, with separate
   states for permission off, GPS failure, load failure (with Retry) and the legitimate empty
   answer. Picking a row switches the same route to the GPS check: a fresh fix, an accuracy and
   distance readout, and "I'm Here" enabled only at accuracy 50 m or better and distance 100 m or
   less. Signed-out users get the inline sign-in prompt and nothing else runs.
2. **One rejection sentence.** After the server is asked, a refusal, a refusal carrying a reason
   field, a server error and a network failure render the identical screen with the single ERR-09
   sentence. A test compares the whole rendered tree across the four cases.
3. **Published! for the creator.** `PendingStatusSheet` shows the state from a separate
   `publication` prop. The Map screen feeds it from `useMySubmissionPublications`, which does not
   depend on the pending query, and acknowledges it on Done or on swipe-away.
4. **Withdraw wording** now says the submission will not publish and verifications already given
   are kept, with "Withdraw" and "Keep it".
5. **Icons.** Real Ionicons on the screens this plan built or changed.

## Decisions made during execution

- **Icon package.** The plan said to add no dependencies and to use Ionicons. On 2026-10-11 the
  user approved real icons, and then, after Expo's documentation was found to mark
  `@expo/vector-icons` as due for deprecation, directed the use of
  `@react-native-vector-icons/ionicons` instead. `docs/design/design-system.md` §7 and
  `05-UI-SPEC.md` were updated to match.
- **Discovery cooldown.** Every discovery call restarts a server cooldown of about three seconds,
  and a call inside it returns no rows, even when an earlier call's response was lost. Four
  choices follow from that: the candidate query never retries automatically, including when the
  modal is reopened after a failed load; a manual Retry waits until four seconds after the failed
  call before asking again; the list's GPS fix is cached for ten seconds so reopening the modal
  reuses the fix and the list; and after an accepted verification the bathroom is removed from the
  cached list, which is not invalidated, so the filtered list counts as fresh for another ten
  seconds and is reused if the modal is reopened.
- **Published! while the Map stays open.** A submission is published by someone else's
  verification, which nothing in the creator's app session observes. Unless the creator's pending
  list has loaded and is empty, the Map re-asks for unseen publications every minute (a failed
  pending load keeps the refresh on), so "Published!"
  reaches them even if push never arrives (D-68). Acknowledging it also refreshes the pending
  pins, which drops the published one and ends the polling. A dismissed publication stays closed
  for the rest of the app session even if the acknowledgement failed and polling keeps returning
  it; it is shown again in a later session, which retries the acknowledgement. With several unseen
  publications, dismissing one presents the next in a re-opened sheet.
- **Resuming after sign-in (ERR-10).** A signed-out user who opens Verify and chooses Sign In
  or Create Account returns to Verify once signed in, by email or Google, instead of landing on
  the tabs. Verify records the return before opening sign-in; the root layout, the OAuth callback,
  and the GPS consent screen that new accounts pass through after sign-up return with `dismissTo`, which unwinds to the Verify modal still on the stack. Only
  allowlisted routes can be recorded, and the record is dropped if the user leaves sign-in
  without signing in.
- **Publication checks when nothing is pending.** An empty pending list slows the publication
  check to every five minutes rather than stopping it, so a submission made on another device
  while the Map stays open can still surface "Published!".
- **Account change.** The verify flow is keyed by the signed-in user, so a bathroom selected under
  one account is dropped if another account signs in while the modal is open.
- **Android announcements.** "Nothing to verify nearby" and the "Verified!" state are live regions,
  so TalkBack reads them without a focus change.
- **Stale reading.** If the reading is more than 60 seconds old when "I'm Here" is pressed, the
  screen reads GPS again instead of sending it, because the server would refuse it and a refusal
  costs the user a cooldown.
- **Try Again after a refusal** reads GPS again and waits for the user to confirm. It does not
  re-send by itself.
- **Status text colour.** Status sentences are drawn in the primary text colour with a coloured
  icon beside them. The spec's green and amber text does not reach 4.5:1 on a white background.
- **Native header.** The title "Verify Location" and the Cancel button are in the native stack
  header, which handles the safe area on both platforms.
- **iOS announcements.** Status that appears without a focus change is announced on iOS, where
  live regions do not exist.

## Deviations from the plan and the wireframes

| Item | Plan or wireframe | Built | Why |
|------|-------------------|-------|-----|
| Dependencies | "Do not add dependencies" | `@react-native-vector-icons/ionicons` added | User decision, 2026-10-11 |
| Files | Not listed | `app/src/app/_layout.tsx`, `_layout.test.tsx`, `jest.setup.ts`, `useVerify.test.ts`, two design documents, `submit.tsx` (one comment), one todo; `redirect.ts`, `auth/callback.tsx`, `gps-consent.tsx` and their three test files | Modal presentation must be declared on the root Stack; the icon files and documents follow from the icon decision and the route path; the auth and GPS-consent files carry the return to Verify after sign-in (ERR-10) |
| Distance readout | "updates live" | One reading, with Try Again to read again | The plan's GPS hook is a single sample; a live watch is not built |
| Done on success | "returns to the bottom sheet" | Closes the modal | The modal is opened from Nearby, not from a detail sheet |
| Success mark | Animation, static if reduced motion | Static only | The reduced-motion alternative is the only version built |
| Poor-accuracy icon | design-system §7 says `warning` | `warning-outline` | `05-UI-SPEC.md` names `warning-outline` for this readout |
| Route path in documents | `/modals/verify` | `/verify` | A route group is not part of the path; the documents were corrected |
| ERR-09 placement | design-system §15 put the message "below 'I'm Here'" | Above the 'I'm Here' button, with Try Again directly under the message | After a refusal 'I'm Here' is disabled until GPS is read again, so the recovery action sits with the message instead of below a disabled button; the design reference was updated to match |
| ERR-09 RPC name | design-system §15 named `submit_verification_event` | `verify_location` | The RPC that exists and that `verifyLocation.ts` calls; the design reference was corrected |

## Verification

- `cd app && npx jest --runInBand --watchman=false`: 50 suites, 487 tests, all pass.
  `npx tsc --noEmit` and `npx eslint src --quiet` exit 0.
- One warning remains in the suite output, from the existing MapScreen tests, tracked in
  `.planning/todos/pending/2026-10-09-mapscreen-act-warning.md`.
- Tests were written before the code they cover. Probity rejected new test files as "not observed
  failing", so with the user's approval for this plan the tests were written by shell, one at a
  time, each seen failing first; every production edit went through Probity. The review fixes
  (cooldown, account change, Android live regions, publication refresh) were also written test
  first, each test seen failing for its stated reason before the change; Probity had been
  uninstalled by then (2026-10-12).

## Carried forward (not verified here)

- A walk-through on a real device: accepted, refused, permission off, poor GPS, too far, dark mode,
  largest text size, VoiceOver and TalkBack. GPS, the server call and the router are mocked in
  every test.
- That the modal is presented as a modal under the name `(modals)/verify`, and that the icon font
  loads on the existing development build without a new native build.
- The live distance readout and the success animation, if they are still wanted.
- Icons on earlier screens: `.planning/todos/pending/2026-10-11-ionicons-on-earlier-screens.md`.
