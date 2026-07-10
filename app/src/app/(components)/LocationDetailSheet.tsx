import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  useColorScheme,
  Linking,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { fetchLocationDetail } from '../../features/locations/useLocationDetail';
import { formatDistance, usesMilesForLocale } from '../../features/locations/formatDistance';
import { useSession } from '../../features/auth/useSession';
import { updateAccessCode } from '../../features/submit/updateAccessCode';
import AuthRequiredModal from './AuthRequiredModal';

/**
 * LocationDetail bottom sheet (peek / half / full) — the primary read-detail
 * surface (D-12). Built complete now so later phases add Verify/Rate/Report
 * without a rebuild; those actions are HIDDEN entirely this phase (D-13).
 *
 * Distance contract (T-03-11 / D-22): the sheet does NOT compute distance. It
 * forwards the `userLat`/`userLng` it receives (MapScreen sources them from
 * `useCurrentPosition`, 03-02) into `fetchLocationDetail(id, userLat, userLng)`;
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

// [LOCKED — 04-UI-SPEC.md Copywriting Contract] 'Update door code' is verbatim (D-23).
const UPDATE_CODE_CTA = 'Update door code';
const CODE_INPUT_LABEL = 'New door code';
const CODE_SUBMIT_LABEL = 'Propose new code';
// D-24 stage-then-confirm: the proposed code is NEVER presented as live — it needs one
// confirming verification from a DIFFERENT user (server-side gate, 04-02) before it replaces
// the old value. This copy states that pending-confirmation contract explicitly.
const CODE_PENDING_COPY =
  'New code proposed. It needs one confirming verification from another user before it goes live.';
const CODE_FAILURE_COPY = "Couldn't submit the new code. Check your connection and try again.";

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

  // The 'Update door code' action is signed-in-only (D-23). Signed-out taps route to the
  // AuthRequiredModal (action='see access code') — this sheet never shows the current/live
  // code to anon (T-04-23), so no getAccessCode call and no code display exist here at all.
  const session = useSession()?.session ?? null;
  const router = useRouter();
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [codeUpdateOpen, setCodeUpdateOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [codeProposed, setCodeProposed] = useState(false);
  // Synchronous re-entrancy guard (see DeleteAccountModal): stops a double-tap from staging twice.
  const codeSubmittingRef = useRef(false);

  const detailQuery = useQuery({
    // Keyed on the forwarded coords so a new fix refreshes the RPC-echoed distance.
    queryKey: ['locationDetail', locationId, userLat, userLng],
    queryFn: () =>
      fetchLocationDetail(locationId as string, userLat ?? undefined, userLng ?? undefined),
    enabled: locationId !== null,
  });

  // Open to peek when a location is selected; close (animate out) when cleared.
  useEffect(() => {
    if (locationId !== null) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
    // Reset the code-update UI whenever the selected location changes (or clears) so a
    // proposed-code confirmation never bleeds across two different locations.
    setAuthModalVisible(false);
    setCodeUpdateOpen(false);
    setCodeInput('');
    setCodeSubmitting(false);
    setCodeError(false);
    setCodeProposed(false);
    codeSubmittingRef.current = false;
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

  const handleUpdateCodePress = useCallback(() => {
    // Signed-in-only (D-23): anon is routed to the auth gate, never shown a code UI.
    if (session === null) {
      setAuthModalVisible(true);
      return;
    }
    setCodeUpdateOpen(true);
  }, [session]);

  async function handleSubmitCode() {
    if (codeSubmittingRef.current || locationId === null) return;
    const trimmed = codeInput.trim();
    if (trimmed.length === 0) return;
    codeSubmittingRef.current = true;
    setCodeSubmitting(true);
    setCodeError(false);
    try {
      // updateAccessCode STAGES only — the different-user promotion gate is server-side (D-24).
      await updateAccessCode(locationId, trimmed);
      setCodeProposed(true);
      setCodeUpdateOpen(false);
    } catch {
      setCodeError(true);
    } finally {
      codeSubmittingRef.current = false;
      setCodeSubmitting(false);
    }
  }

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
        {detailQuery.isError ? (
          <View accessibilityLiveRegion="assertive">
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Couldn&apos;t load this location. Check your connection and try again.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading location details"
              onPress={() => void detailQuery.refetch()}
              style={[
                styles.primaryButton,
                styles.errorRetryButton,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>Retry</Text>
            </Pressable>
          </View>
        ) : detail === undefined ? (
          // On open: animated skeleton bars until the detail resolves (<300ms).
          <View accessibilityLabel="Loading location details">
            <View style={[styles.skeletonTitle, { backgroundColor: colors.skeletonBase }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.skeletonBase }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.skeletonBase }]} />
          </View>
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

            {/* Action row: Get Directions (D-13) + signed-in-gated Update door code (D-23) */}
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

            <View style={styles.secondaryActionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={UPDATE_CODE_CTA}
                accessibilityHint="Propose a new door code for community confirmation"
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleUpdateCodePress}
              >
                <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>
                  {UPDATE_CODE_CTA}
                </Text>
              </Pressable>
            </View>

            {codeProposed ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.codePending, { color: colors.textSecondary }]}
              >
                {CODE_PENDING_COPY}
              </Text>
            ) : codeUpdateOpen ? (
              <View style={styles.codePanel}>
                <TextInput
                  style={[styles.codeInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder={CODE_INPUT_LABEL}
                  placeholderTextColor={colors.textDisabled}
                  accessibilityLabel={CODE_INPUT_LABEL}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={100}
                  value={codeInput}
                  onChangeText={setCodeInput}
                />
                {codeError && (
                  <Text
                    accessibilityLiveRegion="assertive"
                    style={[styles.codeError, { color: colors.errorRed }]}
                  >
                    {CODE_FAILURE_COPY}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CODE_SUBMIT_LABEL}
                  accessibilityState={{ disabled: codeSubmitting }}
                  disabled={codeSubmitting}
                  style={[
                    styles.primaryButton,
                    styles.codeSubmitButton,
                    { backgroundColor: codeSubmitting ? colors.border : colors.primary },
                  ]}
                  onPress={handleSubmitCode}
                >
                  <Text
                    style={[
                      styles.primaryButtonLabel,
                      { color: codeSubmitting ? colors.textDisabled : colors.textInverse },
                    ]}
                  >
                    {CODE_SUBMIT_LABEL}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </BottomSheetView>

      {authModalVisible && (
        <AuthRequiredModal
          visible
          action="see access code"
          onSignIn={() => router.push('/(auth)/sign-in')}
          onCreateAccount={() => router.push('/(auth)/sign-up')}
          onCancel={() => setAuthModalVisible(false)}
        />
      )}
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
  secondaryActionRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codePanel: {
    marginTop: spacing.md,
  },
  codeInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.base,
    fontSize: typography.body.fontSize,
  },
  codeError: {
    marginTop: spacing.sm,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  codeSubmitButton: {
    marginTop: spacing.md,
  },
  codePending: {
    marginTop: spacing.md,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  errorRetryButton: {
    marginTop: spacing.md,
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
