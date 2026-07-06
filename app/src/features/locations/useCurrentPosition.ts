import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { CurrentPosition } from './types';

/** A GPS fix older than this (ms) is reported as stale. */
export const POSITION_FRESHNESS_MS = 60_000;

/** OS foreground-location permission state, normalized to three values. */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface CurrentPositionResult {
  /** Live coordinates, or null when unknown (denied/undetermined/pre-fix). */
  coords: CurrentPosition;
  /** Foreground-permission status. */
  status: PermissionStatus;
  /** True when the last fix is older than POSITION_FRESHNESS_MS. */
  isStale: boolean;
}

/**
 * The single shared live-coordinate source for Phase 3. Wraps expo-location:
 * requests foreground permission and, on grant, reads the current position.
 *
 * 03-03 (Map) and 03-04 (Nearby) MUST consume this hook for the userLat/userLng
 * they forward into `useLocationDetail(id, userLat, userLng)` / `useNearby(...)`
 * — `gpsConsent.ts` only requests permission + records consent and exposes NO
 * coordinates. This hook does NOT duplicate the consent DB write.
 *
 * Never throws on a denied/undetermined permission — it returns `coords: null`
 * so callers simply pass nulls into the distance-aware RPCs.
 */
export function useCurrentPosition(): CurrentPositionResult {
  const [state, setState] = useState<CurrentPositionResult>({
    coords: null,
    status: 'undetermined',
    isStale: false,
  });

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then((perm) => {
      if (perm.status !== 'granted') {
        setState({
          coords: null,
          status: perm.status === 'denied' ? 'denied' : 'undetermined',
          isStale: false,
        });
        return undefined;
      }
      return Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).then((pos) => {
        setState({
          coords: {
            userLat: pos.coords.latitude,
            userLng: pos.coords.longitude,
          },
          status: 'granted',
          isStale: Date.now() - pos.timestamp > POSITION_FRESHNESS_MS,
        });
      });
    });
  }, []);

  return state;
}
