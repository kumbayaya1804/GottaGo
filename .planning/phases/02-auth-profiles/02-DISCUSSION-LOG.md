---
phase: "02"
phase_name: "Auth & Profiles"
discuss_date: 2026-06-26
areas_covered: 7
status: complete
---

# Phase 2 Discussion Log

Raw record of decisions reached during the discuss-phase session. The authoritative decision record is `02-CONTEXT.md`.

---

## Area 1: Auth State Architecture

**Question:** Where does session state live and how do protected routes work?

| Question | Decision |
|----------|----------|
| SessionProvider pattern | React Context / `SessionProvider` in root `_layout.tsx` — wraps the entire app, subscribes to `onAuthStateChange` |
| Protected route mechanism | `useSegments + router.replace` inside root `_layout.tsx` effect |
| `users` table row fetch | Session only — users table row fetched lazily via TanStack Query, NOT in SessionProvider |
| Sign-out triggers | Settings button + `onAuthStateChange SIGNED_OUT` event |
| Cold-start UI | Blank splash until session resolves (loading=true until first onAuthStateChange event) |
| Email confirmation | Disabled in v1 — `signUp()` returns session immediately |
| Unauthenticated landing | Map tab — browse freely, sign-in prompted on protected action |

**Rationale:** Keeping `users` table row out of SessionProvider avoids blocking cold-start on a network request. Session resolution is fast (AsyncStorage read); profile data loads on demand.

---

## Area 2: Google OAuth Approach

**Question:** How is Google OAuth implemented, and what happens on iOS?

| Question | Decision |
|----------|----------|
| Implementation | `supabase.auth.signInWithOAuth` + `expo-web-browser` deep link |
| Callback scheme | `gottago://auth/callback` |
| iOS | Disabled Apple button + explanation text. No Google button on iOS. |

**Rationale:** `expo-web-browser` is the standard Expo approach for OAuth flows. `gottago://auth/callback` is consistent with the password reset deep link (same scheme). iOS gets a stub because Apple Developer account is not yet available; Google OAuth on iOS is also not implemented in Phase 2.

---

## Area 3: GPS Consent Placement

**Question:** When and how is GPS consent captured?

| Question | Decision |
|----------|----------|
| Timing | First launch after sign-in — dedicated GPS Consent screen before Map |
| Denial behavior | Skip for now, `gps_consent` stays false, manual-search mode |
| Re-prompt policy | Only from Settings — never automatically re-shown |
| Screen UX | Explanation screen first, then OS dialog on button tap |

**Rationale:** Showing an explanation screen before the OS dialog (rather than going straight to the OS prompt) follows UX best practice — users who understand why the permission is being requested are more likely to grant it. Denial is non-blocking; the app is still useful without GPS (manual search mode).

---

## Area 4: Sign-in UX Details

**Question:** What does the sign-in/sign-up experience look like?

| Question | Decision |
|----------|----------|
| Protected-action entry | Sign-in screen first, "Create account" link at bottom |
| Sign-up fields | Email + password + display name |
| Auth error copy | Generic: "Invalid email or password." |
| Password reset | Supabase magic link → `gottago://auth/callback` → in-app Reset Password screen |
| Validation timing | On submit only |
| TOS/Privacy | Below "Create Account" button — "By creating an account you agree to..." (links, no checkbox) |
| Welcome screen | YES — logo + tagline + Sign In / Create Account buttons before auth forms |

**Rationale:** Generic error copy prevents user enumeration (security). On-submit-only validation is appropriate for a 2–3 field form. Magic link reset keeps the user in-app rather than bouncing to a browser.

---

## Area 5: Display Name Constraints

**Question:** What are the rules for display names?

| Question | Decision |
|----------|----------|
| Length | 3–20 characters |
| Allowed characters | Letters, numbers, spaces, hyphens, underscores |
| Uniqueness | YES — unique (database constraint + RPC check) |

**Rationale:** 3–20 characters fits leaderboard display. Restricting to letters/numbers/spaces/hyphens/underscores avoids rendering issues in admin tools and CSV exports. Uniqueness chosen to keep the door open for @mention features in later phases.

---

## Area 6: Onboarding / TOS Links

**Question:** Where do Terms of Service and Privacy Policy appear, and is there a welcome screen?

| Question | Decision |
|----------|----------|
| Welcome screen | YES — app logo + tagline + Sign In / Create Account buttons |
| TOS placement | Below "Create Account" button — "By creating an account you agree to [TOS] and [Privacy Policy]" |
| Checkbox required | No — informational links only |

**Rationale:** Termly privacy policy and TOS are already created. Linking them on sign-up without requiring a checkbox is standard consumer app practice; it satisfies disclosure requirements without adding friction. The welcome screen provides a brand moment without a multi-step carousel.

---

## Area 7: Account Deletion

**Question:** How does account deletion work?

| Question | Decision |
|----------|----------|
| Timing | Immediate (no grace period) |
| Contributed data | Anonymized — submissions/ratings remain, `user_id` set to null |
| Trigger | Settings → "Delete Account" → type "DELETE" to confirm |

**Rationale:** Immediate deletion is simpler (no deactivated state machine, no scheduled purge job). Anonymizing rather than cascading-deleting preserves map quality — community contributions are community property. "Type DELETE" confirmation (vs. a simple modal) was chosen over the recommended confirmation modal to prevent accidental deletion, accepted as higher friction in exchange for stronger intent signal.
