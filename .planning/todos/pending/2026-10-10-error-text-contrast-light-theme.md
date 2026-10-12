# Light-theme error text fails the 4.5:1 body-text minimum

Created: 2026-10-10 while fixing the ERR-12 contrast finding on the GPS consent screen.

`errorRed` in the light theme is `#EA4335` (`app/src/constants/Colors.ts`). Against the white `background` it
is 3.92:1, and against `primarySurface` 3.42:1; `docs/design/design-system.md` 18.1 requires 4.5:1 for body
text. The dark theme passes. Every screen that renders `errorRed` text at body size is affected: sign-in,
sign-up, forgot-password, reset-password, submit, `WithdrawConfirmModal`, `DeleteAccountModal`, and the
access-code error in `LocationDetailSheet`.

The consent screen was fixed locally (`textPrimary` text, `errorRed` edge). The general fix is a token change
(a darker light-theme error text color, or a separate `errorText` token) plus a row for it in the design-system
contrast table (Section 1.3), with a test that computes the ratio from the tokens. `app/src`, TDD, full tier.
