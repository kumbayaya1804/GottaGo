# GPS consent: handle a failed save and a rejected permission request

Created: 2026-10-09 from a Codex follow-up note (BOM/lint review `rv-20261009T205707Z-44996447`).

- `app/src/features/auth/gpsConsent.ts:23` ignores the RPC's resolved `error` and returns `granted` even when
  saving consent failed, so the app believes consent is stored when it is not (silent failure; User Advocacy gate).
- `app/src/app/gps-consent.tsx:35` navigates in `finally` without handling a rejected permission request.

Fix with TDD (Probity, `app/src`, full tier): return an error result when the RPC reports an error; show the
locked error copy with a retry instead of navigating on as if it succeeded; add tests for the error result and
the rejected promise.
