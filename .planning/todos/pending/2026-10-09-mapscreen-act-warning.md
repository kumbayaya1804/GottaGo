# MapScreen tests emit a React act(...) warning

Created: 2026-10-09 from a Codex follow-up note. The warning surfaces through `app/jest.setup.ts:9` on master
and on later branches. Wrap the async state updates in the MapScreen tests (`await waitFor` / `act`) so the
suite output is clean. Test-only, `app/src`, full tier.
