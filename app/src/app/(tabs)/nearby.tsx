import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useCurrentPosition } from '../../features/locations/useCurrentPosition';
import { fetchNearby } from '../../features/locations/useNearby';
import { useFiltersStore } from '../../features/filters/useFiltersStore';
import { formatDistance, usesMilesForLocale } from '../../features/locations/formatDistance';
import type { NearbyLocation } from '../../features/locations/types';
import LocationDetailSheet from '../(components)/LocationDetailSheet';

/**
 * NearbyScreen — the accessible, distance-sorted alternative to the Map tab
 * (D-29, WCAG 2.1 AA — the map canvas is visual-only per D-27). Reuses the same
 * `useCurrentPosition` live-coordinate source and `search_locations_nearby`
 * ordering as MapScreen, and opens the SAME `LocationDetailSheet`, forwarding
 * the current user coords so the sheet's distance stays consistent with the
 * row's (the row does not hand its own locally-known distance to the sheet —
 * per 03-03-SUMMARY.md's design, the sheet re-fetches its own server-echoed
 * distanceM). No Mapbox dependency in this file.
 *
 * Also the entry point to the Verify modal (plan 05-03): pending bathrooms are not in
 * the published list below, so a separate "Verify nearby" row opens them.
 */

// [LOCKED ERR-06] truly-empty vs. the distinct filtered-empty state (D-10).
const EMPTY_BODY = "No bathrooms found nearby. Try 'Search this area' or adjust filters.";
const FILTERED_EMPTY_HEADING = 'No bathrooms match your filters';
const CLEAR_FILTERS = 'Clear filters';
const RETRY = 'Retry';
const LOCATION_NEEDED = 'Location needed';
const LOCATION_UNAVAILABLE = 'Location unavailable';
const FINDING_LOCATION = 'Finding your location';
const LOCATION_UNAVAILABLE_COPY =
  "We couldn't get your location. Check your connection and try again.";
const LOCATION_DENIED_COPY =
  'Location permission is off. Open settings to enable it and see nearby bathrooms.';
const VERIFY_NEARBY = 'Verify nearby';

const VERIFY_ICON_SIZE = 22; // design-system §7, "GPS Verify action"

function confidenceLabel(row: NearbyLocation): string {
  return `${row.confidenceTier ?? 'Unrated'} confidence`;
}

function rowAccessibilityLabel(row: NearbyLocation, usesMiles: boolean): string {
  const dist = formatDistance(row.distanceM, usesMiles);
  return `${row.name}. ${dist}. ${confidenceLabel(row)}.`;
}

export default function NearbyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const { coords, status: positionStatus, retry: retryPosition } = useCurrentPosition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtersStore = useFiltersStore();
  const clearAllFilters = filtersStore.clearAll;
  const hasActiveFilter =
    filtersStore.openNow ||
    filtersStore.chillSpot ||
    filtersStore.wheelchair ||
    filtersStore.changing ||
    filtersStore.highConf;
  const filters = filtersStore.activeRpcFilters();
  const usesMiles = usesMilesForLocale();

  const nearbyQuery = useQuery({
    queryKey: ['nearby', coords?.userLat, coords?.userLng, filters],
    queryFn: () => fetchNearby(coords!.userLat, coords!.userLng, filters),
    enabled: coords !== null,
  });

  const rows = nearbyQuery.data ?? [];
  const isEmptyResult = coords !== null && nearbyQuery.isSuccess && rows.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Shown in every state: the verify modal reads GPS itself, so it does not depend
          on this screen having a position. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={VERIFY_NEARBY}
        accessibilityHint="Lists nearby bathrooms waiting to be verified"
        onPress={() => router.push('/verify')}
        style={[styles.verifyEntry, { borderBottomColor: colors.divider }]}
      >
        <Ionicons
          name="location-outline"
          size={VERIFY_ICON_SIZE}
          color={colors.primary}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={[styles.verifyEntryText, { color: colors.primary }]}>{VERIFY_NEARBY}</Text>
      </Pressable>

      {coords === null && (
        <View style={styles.centerOverlay}>
          <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
            {positionStatus === 'unavailable'
              ? LOCATION_UNAVAILABLE
              : positionStatus === 'denied'
                ? LOCATION_NEEDED
                : FINDING_LOCATION}
          </Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>
            {positionStatus === 'unavailable'
              ? LOCATION_UNAVAILABLE_COPY
              : positionStatus === 'denied'
                ? LOCATION_DENIED_COPY
                : 'Requesting location permission…'}
          </Text>
          {positionStatus === 'unavailable' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry getting location"
              onPress={retryPosition}
              style={styles.cardButton}
            >
              <Text style={[styles.cardButtonText, { color: colors.primary }]}>Retry</Text>
            </Pressable>
          )}
          {positionStatus === 'denied' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open location settings"
              onPress={() => void Linking.openSettings()}
              style={styles.cardButton}
            >
              <Text style={[styles.cardButtonText, { color: colors.primary }]}>Open settings</Text>
            </Pressable>
          )}
        </View>
      )}

      {coords !== null && nearbyQuery.isError && (
        <View style={[styles.banner, { backgroundColor: colors.offlineBanner }]}>
          <Text style={[styles.bannerText, { color: colors.offlineBannerText }]}>
            Couldn&apos;t load bathrooms here.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${RETRY} loading bathrooms`}
            onPress={() => nearbyQuery.refetch()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>{RETRY}</Text>
          </Pressable>
        </View>
      )}

      {isEmptyResult && (
        <View style={styles.centerOverlay}>
          <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
            {hasActiveFilter ? FILTERED_EMPTY_HEADING : 'No bathrooms found nearby'}
          </Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>{EMPTY_BODY}</Text>
          {hasActiveFilter && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CLEAR_FILTERS}
              onPress={clearAllFilters}
              style={styles.cardButton}
            >
              <Text style={[styles.cardButtonText, { color: colors.primary }]}>
                {CLEAR_FILTERS}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {coords !== null && rows.length > 0 && (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={rowAccessibilityLabel(item, usesMiles)}
              accessibilityHint="Opens location details"
              onPress={() => setSelectedId(item.id)}
              style={[styles.row, { borderBottomColor: colors.divider }]}
            >
              <Text style={[styles.rowName, { color: colors.textPrimary }]}>{item.name}</Text>
              <Text style={[styles.rowSubhead, { color: colors.textSecondary }]}>
                {formatDistance(item.distanceM, usesMiles)}
                {item.lastVerifiedAt
                  ? ` · Verified ${formatDistanceToNow(new Date(item.lastVerifiedAt), { addSuffix: true })}`
                  : ''}
              </Text>
              <Text style={[styles.rowSubhead, { color: colors.textSecondary }]}>
                {confidenceLabel(item)}
              </Text>
            </Pressable>
          )}
        />
      )}

      <LocationDetailSheet
        locationId={selectedId}
        userLat={coords?.userLat ?? null}
        userLng={coords?.userLng ?? null}
        onDismiss={() => setSelectedId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  verifyEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  verifyEntryText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  centerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  cardHeading: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
    textAlign: 'center',
  },
  cardText: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  cardButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  cardButtonText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    margin: spacing.base,
  },
  bannerText: {
    flex: 1,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  retryText: {
    marginLeft: spacing.base,
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  listContent: {
    paddingHorizontal: spacing.base,
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: 2,
  },
  rowName: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  rowSubhead: {
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
});
