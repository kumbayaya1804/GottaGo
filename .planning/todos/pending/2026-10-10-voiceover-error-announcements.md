# Error messages are not announced to VoiceOver on iOS

Created: 2026-10-10 while fixing the ERR-12 announcement finding on the GPS consent screen.

`accessibilityLiveRegion` is Android-only in React Native (0.83 `ViewAccessibility.d.ts` marks it
`@platform android`). The consent screen now posts an explicit `AccessibilityInfo.announceForAccessibility`
on iOS, but the other screens that rely on the live region alone do not: sign-in, sign-up, forgot-password,
reset-password, submit, `WithdrawConfirmModal`, `DeleteAccountModal`, `SensitivityConfirmModal`, and
`LocationDetailSheet`.

Fix once, not per screen: a small shared helper or component that announces on iOS and uses the live region
on Android, with platform-aware tests, then a VoiceOver pass on a device. `app/src`, TDD, full tier. Add the
consent screen's VoiceOver and TalkBack check to the device UAT list when it is done.
