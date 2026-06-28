/**
 * Spacing scale — 9 numeric tokens.
 * Source: docs/design/design-system.md §3
 *
 * All spacing values in component StyleSheet MUST reference these tokens.
 * No magic numbers in StyleSheet.
 */

export const spacing = {
  /** 4 — icon padding, micro gaps */
  xs: 4,
  /** 8 — between label and icon, chip internal padding */
  sm: 8,
  /** 12 — between list items */
  md: 12,
  /** 16 — standard horizontal screen margin, card padding */
  base: 16,
  /** 20 — between card and next section */
  lg: 20,
  /** 24 — FAB safe-area inset from bottom, section gaps */
  xl: 24,
  /** 32 — between major screen sections */
  xxl: 32,
  /** 48 — full-screen modal top padding */
  xxxl: 48,
  /** 64 — FAB minimum touch target dimension */
  giant: 64,
} as const;
