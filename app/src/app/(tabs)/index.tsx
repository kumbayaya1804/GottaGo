import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  UserLocation,
} from '@rnmapbox/maps';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useMapViewport } from '../../features/locations/useMapViewport';
import { useCurrentPosition } from '../../features/locations/useCurrentPosition';
import { fetchLocationsBbox } from '../../features/locations/useLocationsBbox';
import { useFiltersStore } from '../../features/filters/useFiltersStore';
import { useSession } from '../../features/auth/useSession';
import { fetchMyPendingSubmissions } from '../../features/submit/useMyPendingSubmissions';
import type { LocationFeatureCollection } from '../../features/locations/types';
import type {
  PendingSubmissionFeatureCollection,
  PendingSubmissionProperties,
} from '../../features/submit/types';
import LocationDetailSheet from '../(components)/LocationDetailSheet';
import PendingStatusSheet from '../(components)/PendingStatusSheet';
import FilterChipRow from '../(components)/FilterChipRow';

/**
 * MapScreen — the primary read surface (ROADMAP SC1). A Mapbox map with
 * bathroom pins clustered natively from `search_locations_bbox`, a distinct
 * user-location blue dot, a 400ms-debounced viewport refetch, a zoom-out cutoff
 * card, and an RPC-failure banner that preserves previously-loaded pins (D-28).
 *
 * This screen is a thin wrapper: all debounce/threshold logic lives in
 * `useMapViewport` (covered), and all detail logic lives in LocationDetailSheet.
 * The current user coordinates come from `useCurrentPosition` (03-02) — NOT
 * gpsConsent.ts, which records consent only and exposes no coordinates
 * (Codex MEDIUM). Those coords are forwarded into the sheet so the peek-tier
 * distance is the real, server-computed `distanceM` (D-22).
 */

// Public (embeddable) Mapbox token — set at build via app config / EAS secret.
// The @rnmapbox/maps config plugin's download token is separate (native SDK
// fetch only); the runtime map needs this public access token.
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

/** Dev-seed center (Eugene, OR — D-31) used only until the first GPS fix. */
const SEED_CENTER: [number, number] = [-123.09, 44.05];
const EMPTY_FC: LocationFeatureCollection = { type: 'FeatureCollection', features: [] };
const EMPTY_PENDING_FC: PendingSubmissionFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};
// '< Pending >' label on the submitter-only pin — status carried by color+text, never
// color-only (design-system §18.4). The dashed-outline visual is device-verified (checkpoint).
const PENDING_PIN_LABEL = '< Pending >';
const ZOOM_OUT_COPY = 'Zoom in to see individual locations';
const BANNER_COPY = "Couldn't load bathrooms here.";
// [LOCKED ERR-01] — verbatim, do not paraphrase (03-UI-SPEC.md).
const DENIED_COPY = "We can't find your location. Use search to browse bathrooms near an address.";
// [LOCKED ERR-06] truly-empty vs. the distinct filtered-empty state (D-10).
const EMPTY_HEADING = 'No bathrooms found nearby';
const EMPTY_BODY = "No bathrooms found nearby. Try 'Search this area' or adjust filters.";
const FILTERED_EMPTY_HEADING = 'No bathrooms match your filters';
const FILTERED_EMPTY_BODY = 'Try clearing filters or searching this area.';
const SEARCH_THIS_AREA = 'Search this area';
const CLEAR_FILTERS = 'Clear filters';
const LOCATION_UNAVAILABLE_COPY =
  "We couldn't get your location. Retry or search the visible map area.";

/** Shape of the ShapeSource press event we consume (single pin vs. cluster). */
interface ShapePressEvent {
  features: Array<{
    properties?: Record<string, unknown> | null;
    geometry?: { coordinates?: [number, number] } | null;
  }>;
}

export default function MapScreen() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const cameraRef = useRef<Camera>(null);

  const { viewport, belowPinThreshold, onRegionChange } = useMapViewport();
  const { coords, status: positionStatus, retry: retryPosition } = useCurrentPosition();
  const [manualBrowseEnabled, setManualBrowseEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPending, setSelectedPending] = useState<PendingSubmissionProperties | null>(null);
  const showManualSearch = positionStatus === 'denied';
  const positionUnavailable = positionStatus === 'unavailable';
  const manualSearchActive = (showManualSearch || positionUnavailable) && !manualBrowseEnabled;

  useEffect(() => {
    if (coords !== null) setManualBrowseEnabled(false);
  }, [coords]);

  // Signed-in submitter's own pending pins (SC9). Scoping is entirely server-side
  // (`submitter_id = auth.uid()`, T-04-20) — this is a SEPARATE authed-only query, never a
  // client-side "my rows" filter and never a JOIN into Phase 3's search RPCs.
  const session = useSession()?.session ?? null;
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ['pendingSubmissions', session?.user?.id],
    queryFn: () => fetchMyPendingSubmissions(),
    // Defense in depth: the RPC returns nothing for anon anyway, but never even fire it.
    enabled: !!session,
  });
  const pendingCollection = pendingQuery.data ?? EMPTY_PENDING_FC;

  const activeRpcFilters = useFiltersStore((s) => s.activeRpcFilters);
  const clearAllFilters = useFiltersStore((s) => s.clearAll);
  // Any chip active → filtered-empty copy instead of truly-empty (D-10).
  const hasActiveFilter = useFiltersStore(
    (s) => s.openNow || s.chillSpot || s.wheelchair || s.changing || s.highConf,
  );
  const filters = activeRpcFilters();

  // User-scoped is unnecessary here (public read); keyed on viewport + filters
  // so panning AND toggling a chip both refetch (D-07). Disabled past the
  // zoom-out cutoff (D-04) and while GPS is denied (search-only, D-34).
  const bboxQuery = useQuery({
    queryKey: ['locationsBbox', viewport, filters],
    // CR-01 (code review): defensive null guard — refetch() can be invoked imperatively
    // (bypassing the `enabled` gate below) before the first viewport commit lands.
    queryFn: () => (viewport !== null ? fetchLocationsBbox(viewport, filters) : EMPTY_FC),
    enabled: viewport !== null && !belowPinThreshold && !manualSearchActive,
  });

  // On error, TanStack retains the last successful `data`, so previously-loaded
  // pins stay on the map under the banner (D-28) rather than clearing to empty.
  const featureCollection = bboxQuery.data ?? EMPTY_FC;
  const isEmptyResult =
    bboxQuery.isSuccess && featureCollection.features.length === 0 && !manualSearchActive;

  const styleURL = colorScheme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Light;

  // Pin color is a Mapbox `match` on policy_tag — driven by data, not React
  // state (design-system.md §20 map-pin rule).
  const pinColor = [
    'match',
    ['get', 'policyTag'],
    'chill_spot',
    colors.pinChillSpot,
    'code_required',
    colors.pinCodeRequired,
    'public_facility',
    colors.pinPublicFacility,
    'purchase_required',
    colors.pinPurchaseRequired,
    colors.pinPending,
  ];

  const handleShapePress = useCallback((event: ShapePressEvent) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const isCluster = Boolean(feature.properties?.point_count);
    if (isCluster) {
      // Zoom toward the cluster so native clustering expands it.
      const coord = feature.geometry?.coordinates;
      if (coord) {
        cameraRef.current?.setCamera({
          centerCoordinate: coord,
          zoomLevel: 14,
          animationDuration: 300,
        });
      }
      return;
    }
    const id = feature.properties?.id;
    if (typeof id === 'string') setSelectedId(id);
  }, []);

  // Pending pins live in their OWN source, so they get their own handler — the published
  // branch above stays untouched. The tapped feature already carries confirmationCount /
  // expiresAt (get_my_pending_submissions), so the pending sheet needs no second fetch (D-27).
  const handlePendingPress = useCallback((event: ShapePressEvent) => {
    const props = event.features?.[0]?.properties;
    if (props && typeof props.id === 'string') {
      setSelectedPending(props as unknown as PendingSubmissionProperties);
    }
  }, []);

  return (
    <View style={styles.screen}>
      <MapView
        testID="map-view"
        style={StyleSheet.absoluteFill}
        styleURL={styleURL}
        onRegionDidChange={onRegionChange as never}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: coords ? [coords.userLng, coords.userLat] : SEED_CENTER,
            zoomLevel: 14,
          }}
        />
        <UserLocation visible />

        {!belowPinThreshold && !manualSearchActive && (
          <ShapeSource
            id="locations"
            shape={featureCollection as never}
            cluster
            clusterRadius={50}
            clusterMaxZoomLevel={14}
            onPress={handleShapePress as never}
          >
            <CircleLayer
              id="clusters"
              filter={['has', 'point_count']}
              style={{ circleColor: colors.primary, circleRadius: 18, circleOpacity: 0.9 }}
            />
            <SymbolLayer
              id="clusterCount"
              filter={['has', 'point_count']}
              style={{ textField: ['get', 'point_count'] as never, textSize: 12, textColor: colors.textInverse }}
            />
            <CircleLayer
              id="singlePin"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleColor: pinColor as never,
                circleRadius: 8,
                circleStrokeWidth: 2,
                circleStrokeColor: colors.background,
              }}
            />
          </ShapeSource>
        )}

        {/* SEPARATE submitter-only pending layer (RESEARCH Pattern 4) — NOT clustered with
            id="locations" and NOT a merged feature collection. Gated on an active session so
            anon never even mounts it; visibility is server-scoped, not client-filtered. */}
        {!belowPinThreshold && !manualSearchActive && !!session && (
          <ShapeSource
            id="pendingLocations"
            shape={pendingCollection as never}
            onPress={handlePendingPress as never}
          >
            <CircleLayer
              id="pendingPin"
              style={{
                circleColor: colors.pinPending,
                circleRadius: 8,
                circleStrokeWidth: 2,
                circleStrokeColor: colors.background,
              }}
            />
            <SymbolLayer
              id="pendingBadge"
              style={{
                textField: PENDING_PIN_LABEL,
                textSize: 10,
                textColor: colors.pinPending,
                textOffset: [0, 1.6] as never,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {!manualSearchActive && (
        <View style={styles.chipRowContainer}>
          <FilterChipRow />
        </View>
      )}

      {manualSearchActive && (
        <View style={styles.centerOverlay} pointerEvents="box-none">
          <View style={[styles.card, { backgroundColor: colors.mapOverlay }]}>
            <Text style={[styles.cardText, { color: colors.textPrimary }]}>
              {positionUnavailable ? LOCATION_UNAVAILABLE_COPY : DENIED_COPY}
            </Text>
            {positionUnavailable && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry getting location"
                onPress={retryPosition}
                style={styles.cardButton}
              >
                <Text style={[styles.cardButtonText, { color: colors.primary }]}>Retry</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SEARCH_THIS_AREA}
              onPress={() => setManualBrowseEnabled(true)}
              style={styles.cardButton}
            >
              <Text style={[styles.cardButtonText, { color: colors.primary }]}>
                {SEARCH_THIS_AREA}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {belowPinThreshold && !manualSearchActive && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <View style={[styles.card, { backgroundColor: colors.mapOverlay }]}>
            <Text style={[styles.cardText, { color: colors.textPrimary }]}>{ZOOM_OUT_COPY}</Text>
          </View>
        </View>
      )}

      {isEmptyResult && !belowPinThreshold && (
        <View style={styles.centerOverlay} pointerEvents="box-none">
          <View style={[styles.card, { backgroundColor: colors.mapOverlay }]}>
            <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
              {hasActiveFilter ? FILTERED_EMPTY_HEADING : EMPTY_HEADING}
            </Text>
            <Text style={[styles.cardText, { color: colors.textSecondary }]}>
              {hasActiveFilter ? FILTERED_EMPTY_BODY : EMPTY_BODY}
            </Text>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SEARCH_THIS_AREA}
              onPress={() => bboxQuery.refetch()}
              style={styles.cardButton}
            >
              <Text style={[styles.cardButtonText, { color: colors.primary }]}>
                {SEARCH_THIS_AREA}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {bboxQuery.isError && (
        <View style={[styles.banner, { backgroundColor: colors.offlineBanner }]}>
          <Text style={[styles.bannerText, { color: colors.offlineBannerText }]}>
            {BANNER_COPY}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading bathrooms"
            onPress={() => bboxQuery.refetch()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      )}

      <LocationDetailSheet
        locationId={selectedId}
        userLat={coords?.userLat ?? null}
        userLng={coords?.userLng ?? null}
        onDismiss={() => setSelectedId(null)}
      />

      <PendingStatusSheet
        submission={selectedPending}
        onDismiss={() => setSelectedPending(null)}
        onWithdrawn={() => {
          // Pin vanishes from the map entirely (D-29): drop the sheet + refetch the
          // now-shorter pending set for this submitter.
          queryClient.invalidateQueries({
            queryKey: ['pendingSubmissions', session?.user?.id],
          });
          setSelectedPending(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  chipRowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  card: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
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
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
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
});
