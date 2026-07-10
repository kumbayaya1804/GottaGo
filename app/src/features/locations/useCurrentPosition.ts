import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { CurrentPosition } from './types';

/** A GPS fix older than this (ms) is reported as stale. */
export const POSITION_FRESHNESS_MS = 60_000;

/** OS foreground-location permission state, normalized to three values. */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface CurrentPositionResult {
  /** Live coordinates, or null when unknown (denied/undetermined/pre-fix). */
  coords: CurrentPosition;
  /** Foreground-permission status. */
  status: PermissionStatus;
  /** True when the last fix is older than POSITION_FRESHNESS_MS. */
  isStale: boolean;
  /** Retries permission lookup and GPS acquisition after a provider failure. */
  retry: () => void;
}

/**
 * The single shared live-coordinate source for Phase 3. Wraps expo-location:
 * requests foreground permission and, on grant, reads the current position.
 *
 * 03-03 (Map) and 03-04 (Nearby) MUST consume this hook for the userLat/userLng
 * they forward into `fetchLocationDetail(id, userLat, userLng)` / `fetchNearby(...)`
 * — `gpsConsent.ts` only requests permission + records consent and exposes NO
 * coordinates. This hook does NOT duplicate the consent DB write.
 *
 * Never throws on a denied/undetermined permission — it returns `coords: null`
 * so callers simply pass nulls into the distance-aware RPCs.
 */
export function useCurrentPosition(): CurrentPositionResult {
  const [state, setState] = useState<Omit<CurrentPositionResult, 'retry'>>({
    coords: null,
    status: 'undetermined',
    isStale: false,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;

    async function resolvePosition() {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!active) return;

        if (perm.status !== 'granted') {
          setState({
            coords: null,
            status: perm.status === 'denied' ? 'denied' : 'undetermined',
            isStale: false,
          });
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;

        setState({
          coords: {
            userLat: pos.coords.latitude,
            userLng: pos.coords.longitude,
          },
          status: 'granted',
          isStale: Date.now() - pos.timestamp > POSITION_FRESHNESS_MS,
        });
      } catch {
        if (!active) return;
        setState({
          coords: null,
          status: 'unavailable',
          isStale: false,
        });
      }
    }

    void resolvePosition();
    return () => {
      active = false;
    };
  }, [attempt]);

  return { ...state, retry };
}
