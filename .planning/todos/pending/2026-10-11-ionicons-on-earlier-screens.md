# Replace text glyphs with Ionicons on screens built before plan 05-03

Created: 2026-10-11 during plan 05-03. The user decided that day to use real icons from
`@react-native-vector-icons/ionicons` (design-system §7) and that nothing deprecated may be used.
Plan 05-03 applied it to the screens it built or changed (verify modal, Published state, the
"Verify nearby" row). Screens built earlier still use text characters or no icon at all:

- `app/src/app/(tabs)/submit.tsx`: five text marks (`✓`, `⚠`) in the GPS step, the checkbox tick
  and the success state.
- `app/src/app/gps-consent.tsx`: one `⚠` in the save-failure box, added by the
  `fix/gps-consent-silent-failure` batch. Convert it only after that batch merges; touching it
  earlier restarts its review.
- `app/src/app/(tabs)/_layout.tsx`: the tab bar has titles and no icons; design-system §7 lists
  one per tab.
- Other §7 rows not yet drawn (filter chips, detail sheet actions, badges): convert as each screen
  is next touched.

Follow the pattern in `app/src/app/(modals)/verify.tsx`: the icon sits beside the words, takes its
colour from a token, and is hidden from screen readers. `app/jest.setup.ts` already stubs the
package for tests. `app/src`, full tier, test-first.

Not verified yet: that the icon font loads on a real device build without a new native build.
The package documents runtime loading through `expo-font` for its default import; confirm it at
the next device check.
