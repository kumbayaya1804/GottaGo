import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  UserLocation,
} from '@rnmapbox/maps';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useMapViewport } from '../../features/locations/useMapViewport';
import { useCurrentPosition } from '../../features/locations/useCurrentPosition';
import { useLocationsBbox } from '../../features/locations/useLocationsBbox';
import type { LocationFeatureCollection } from '../../features/locations/types';
import LocationDetailSheet from '../(components)/LocationDetailSheet';

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
const ZOOM_OUT_COPY = 'Zoom in to see individual locations';
const BANNER_COPY = "Couldn't load bathrooms here.";

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
  const { coords } = useCurrentPosition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // User-scoped is unnecessary here (public read); keyed on viewport + coords so
  // panning refetches and a new fix re-runs. Disabled past the zoom-out cutoff
  // (D-04) so a far-out viewport never fetches a misleadingly sparse subset.
  const bboxQuery = useQuery({
    queryKey: ['locationsBbox', viewport],
    queryFn: () => useLocationsBbox(viewport!),
    enabled: viewport !== null && !belowPinThreshold,
  });

  // On error, TanStack retains the last successful `data`, so previously-loaded
  // pins stay on the map under the banner (D-28) rather than clearing to empty.
  const featureCollection = bboxQuery.data ?? EMPTY_FC;

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

        {!belowPinThreshold && (
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
      </MapView>

      {belowPinThreshold && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <View style={[styles.card, { backgroundColor: colors.mapOverlay }]}>
            <Text style={[styles.cardText, { color: colors.textPrimary }]}>{ZOOM_OUT_COPY}</Text>
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
  card: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  cardText: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
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
