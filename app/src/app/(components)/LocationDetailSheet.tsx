import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useColorScheme,
  Linking,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useLocationDetail } from '../../features/locations/useLocationDetail';
import { formatDistance, usesMilesForLocale } from '../../features/locations/formatDistance';

/**
 * LocationDetail bottom sheet (peek / half / full) — the primary read-detail
 * surface (D-12). Built complete now so later phases add Verify/Rate/Report
 * without a rebuild; those actions are HIDDEN entirely this phase (D-13).
 *
 * Distance contract (T-03-11 / D-22): the sheet does NOT compute distance. It
 * forwards the `userLat`/`userLng` it receives (MapScreen sources them from
 * `useCurrentPosition`, 03-02) into `useLocationDetail(id, userLat, userLng)`;
 * the server echoes `distanceM` (ST_Distance) which is rendered as-is, and is
 * simply absent when no coords were forwarded — never a client-side guess.
 *
 * Dismiss is gesture-only: swipe-down or tap-outside scrim, no close button
 * (D-17). No access code is ever shown (D-24) — the RPC omits it entirely.
 */

/** Either the light or dark palette from the design-token table. */
type ColorPalette = (typeof Colors)[keyof typeof Colors];

export interface LocationDetailSheetProps {
  /** The tapped location's id, or null when the sheet is closed. */
  locationId: string | null;
  /** Current user latitude (from useCurrentPosition), or null when no fix. */
  userLat: number | null;
  /** Current user longitude (from useCurrentPosition), or null when no fix. */
  userLng: number | null;
  /** Called when the sheet is dismissed by gesture (index returns to -1). */
  onDismiss: () => void;
}

const MISSING_HOURS_COPY = 'Hours not yet available';

/** Human display label + policy-tag token color for a raw policy_tag value. */
function policyTagPresentation(
  policyTag: string | null,
  colors: ColorPalette,
): { label: string; color: string } | null {
  switch (policyTag) {
    case 'chill_spot':
      return { label: 'Chill Spot', color: colors.pinChillSpot };
    case 'code_required':
      return { label: 'Code Required', color: colors.pinCodeRequired };
    case 'public_facility':
      return { label: 'Public Facility', color: colors.pinPublicFacility };
    case 'purchase_required':
      return { label: 'Purchase Required', color: colors.pinPurchaseRequired };
    default:
      return null;
  }
}

/** Confidence pill fill color for a tier label. */
function confidenceColor(tier: string | null, colors: ColorPalette): string | null {
  switch (tier) {
    case 'High':
      return colors.confidenceHigh;
    case 'Medium':
      return colors.confidenceMedium;
    case 'Low':
      return colors.confidenceLow;
    default:
      return null;
  }
}

/** "High — 14 GPS verifications" (D-15), singular for a count of 1. */
function confidenceCopy(tier: string, count: number): string {
  const noun = count === 1 ? 'GPS verification' : 'GPS verifications';
  return `${tier} — ${count} ${noun}`;
}

/**
 * Builds a native-maps deep link for the destination (D-19). iOS `maps:`,
 * Android `geo:`, web fallback to Google Maps. Coords only — no PII logged.
 */
function directionsUrl(lat: number, lng: number, label: string): string {
  const enc = encodeURIComponent(label);
  return Platform.select({
    ios: `maps:0,0?q=${enc}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${enc})`,
    default: `https://maps.google.com/?q=${lat},${lng}`,
  }) as string;
}

/** Normalizes the `unknown` hours payload into printable "key: value" lines. */
function hoursLines(hours: unknown): string[] {
  if (hours === null || hours === undefined) return [];
  if (typeof hours === 'string') return hours.length > 0 ? [hours] : [];
  if (typeof hours === 'object') {
    return Object.entries(hours as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => `${k}: ${v as string}`);
  }
  return [];
}

export default function LocationDetailSheet({
  locationId,
  userLat,
  userLng,
  onDismiss,
}: LocationDetailSheetProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%', '55%', '90%'], []);

  const detailQuery = useQuery({
    // Keyed on the forwarded coords so a new fix refreshes the RPC-echoed distance.
    queryKey: ['locationDetail', locationId, userLat, userLng],
    queryFn: () =>
      useLocationDetail(locationId as string, userLat ?? undefined, userLng ?? undefined),
    enabled: locationId !== null,
  });

  // Open to peek when a location is selected; close (animate out) when cleared.
  useEffect(() => {
    if (locationId !== null) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [locationId]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1) onDismiss();
    },
    [onDismiss],
  );

  const handleDirections = useCallback(() => {
    const detail = detailQuery.data;
    if (!detail) return;
    Linking.openURL(directionsUrl(detail.lat, detail.lng, detail.name));
  }, [detailQuery.data]);

  if (locationId === null) return null;

  const detail = detailQuery.data;
  const policy = detail ? policyTagPresentation(detail.policyTag, colors) : null;
  const confColor = detail ? confidenceColor(detail.confidenceTier, colors) : null;
  const lines = detail ? hoursLines(detail.hours) : [];

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleChange}
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.md }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={styles.content}>
        {detail === undefined ? (
          // On open: animated skeleton bars until the detail resolves (<300ms).
          <View accessibilityLabel="Loading location details">
            <View style={[styles.skeletonTitle, { backgroundColor: colors.skeletonBase }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.skeletonBase }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.skeletonBase }]} />
          </View>
        ) : detailQuery.isError ? (
          <Text
            accessibilityLiveRegion="assertive"
            style={[styles.body, { color: colors.textSecondary }]}
          >
            Couldn&apos;t load this location. Close and try again.
          </Text>
        ) : (
          <View accessibilityRole="summary" accessibilityLabel={`Details for ${detail.name}`}>
            {/* Peek tier: name / distance / policy badge / confidence badge */}
            <Text style={[styles.name, { color: colors.textPrimary }]}>{detail.name}</Text>

            {detail.distanceM !== null && (
              <Text style={[styles.distance, { color: colors.textSecondary }]}>
                {formatDistance(detail.distanceM, usesMilesForLocale())}
              </Text>
            )}

            <View style={styles.badgeRow}>
              {policy && (
                <View style={[styles.badge, { backgroundColor: policy.color }]}>
                  <Text style={[styles.badgeText, { color: colors.textInverse }]}>
                    {policy.label}
                  </Text>
                </View>
              )}
              {confColor && detail.confidenceTier !== null && (
                <View style={[styles.badge, { backgroundColor: confColor }]}>
                  <Text style={[styles.badgeText, { color: colors.textPrimary }]}>
                    {confidenceCopy(detail.confidenceTier, detail.verificationCount)}
                  </Text>
                </View>
              )}
            </View>

            {detail.lastVerifiedAt !== null && (
              <Text style={[styles.subhead, { color: colors.textSecondary }]}>
                Verified {formatDistanceToNow(new Date(detail.lastVerifiedAt), { addSuffix: true })}
              </Text>
            )}

            {/* Half tier: hours (or explicit missing copy, D-18) */}
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Hours</Text>
            {lines.length > 0 ? (
              lines.map((line) => (
                <Text key={line} style={[styles.body, { color: colors.textPrimary }]}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={[styles.caption, { color: colors.textDisabled }]}>
                {MISSING_HOURS_COPY}
              </Text>
            )}

            {detail.address !== null && (
              <Text style={[styles.body, { color: colors.textSecondary }]}>{detail.address}</Text>
            )}

            {/* Action row: only Get Directions this phase (D-13/D-20) */}
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Get Directions"
                accessibilityHint="Opens the native maps app to this location"
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleDirections}
              >
                <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>
                  Get Directions
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  name: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    lineHeight: typography.h2.lineHeight,
  },
  distance: {
    marginTop: spacing.xs,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  subhead: {
    marginTop: spacing.sm,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  badgeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
  },
  body: {
    marginTop: spacing.xs,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  caption: {
    marginTop: spacing.xs,
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
  },
  actionRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  skeletonTitle: {
    height: 24,
    width: '70%',
    borderRadius: radius.xs,
  },
  skeletonLine: {
    marginTop: spacing.sm,
    height: 16,
    width: '45%',
    borderRadius: radius.xs,
  },
});
