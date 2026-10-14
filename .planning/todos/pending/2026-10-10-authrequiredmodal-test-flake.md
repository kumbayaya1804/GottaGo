# AuthRequiredModal reduced-motion test can flake

Created: 2026-10-10 from a review follow-up note on the GPS consent batch (scope `sha256:28dd52a3…`). The
file is outside that batch.

`app/src/app/__tests__/(components)/AuthRequiredModal.test.tsx` ("uses instant appear (animationType "none")
when reduced motion is enabled", around lines 78-83) asserts `modal.props.animationType` right after
`findByTestId`. The modal mounts with `reducedMotion = false` and switches after the mocked
`isReduceMotionEnabled` resolves, so the assertion can run before the re-render and see `"slide"`.

Wrap the assertion in `await waitFor(...)`. Test-only, `app/src`, full tier.
