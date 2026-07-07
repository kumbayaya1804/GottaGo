import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useFiltersStore, type FilterKey } from '../../features/filters/useFiltersStore';

/**
 * FilterChipRow — a horizontal, scrollable row of the five data-dependent filter
 * chips bound to the 03-02 Zustand `useFiltersStore`. Presentational only: an
 * active chip uses the `primary` fill; toggling a chip drives the store, and the
 * map re-queries the bbox via `activeRpcFilters()`. AND logic (D-07) and
 * null-include (D-08) are enforced server-side by the RPC — this row encodes no
 * filter logic and holds no local filter state.
 *
 * Narrowed scope (D-34, approved 2026-07-05): no persistent search-bar component
 * exists in Phase 3. This chip row anchors to the top of the map screen; the
 * denied-GPS state (ERR-01) renders its own manual-search entry, not a shared
 * always-present search bar. Filter chips are hidden while in the denied state.
 */

interface ChipDef {
  key: FilterKey;
  label: string;
}

/** UI-SPEC order: [Changing Table] [Wheelchair] [Chill Spot] [Open Now] [Clean: 4+]. */
const CHIPS: readonly ChipDef[] = [
  { key: 'changing', label: 'Changing Table' },
  { key: 'wheelchair', label: 'Wheelchair' },
  { key: 'chillSpot', label: 'Chill Spot' },
  { key: 'openNow', label: 'Open Now' },
  { key: 'highConf', label: 'Clean: 4+' },
];

type ColorPalette = (typeof Colors)[keyof typeof Colors];

function FilterChip({ chip, colors }: { chip: ChipDef; colors: ColorPalette }) {
  const selected = useFiltersStore((s) => s[chip.key]);
  const toggle = useFiltersStore((s) => s.toggle);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={chip.label}
      accessibilityState={{ selected }}
      onPress={() => toggle(chip.key)}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? colors.textInverse : colors.textPrimary },
        ]}
      >
        {chip.label}
      </Text>
    </Pressable>
  );
}

export default function FilterChipRow() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {CHIPS.map((chip) => (
        <FilterChip key={chip.key} chip={chip} colors={colors} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    lineHeight: typography.label.lineHeight,
  },
});
