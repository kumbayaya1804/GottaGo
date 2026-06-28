/**
 * Border radius scale — 6 numeric tokens.
 * Source: docs/design/design-system.md §4
 */

export const radius = {
  /** 4 — small UI chips in non-prominent contexts */
  xs: 4,
  /** 8 — cards, input fields, secondary buttons */
  sm: 8,
  /** 12 — bottom sheet corners, primary buttons */
  md: 12,
  /** 16 — modals, large cards */
  lg: 16,
  /** 24 — FAB, large rounded containers */
  xl: 24,
  /** 9999 — confidence badges, filter chips, policy tag badges */
  pill: 9999,
} as const;
