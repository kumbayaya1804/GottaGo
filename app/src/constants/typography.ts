/**
 * Typography scale — 9 named entries.
 * Source: docs/design/design-system.md §2
 *
 * System font only — SF Pro Display/Text on iOS, Roboto on Android.
 * No fontFamily declaration needed; React Native uses the system font automatically.
 *
 * All fontSize values in component StyleSheet MUST reference these constants.
 * No inline raw fontSize numbers (e.g. fontSize: 14) in component files.
 */

export const typography = {
  display: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 41,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 17,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
} as const;
