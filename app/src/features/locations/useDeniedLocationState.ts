import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { PermissionStatus } from './useCurrentPosition';

/**
 * useDeniedLocationState — the foreground-GPS PERMISSION-STATE hook that drives
 * the denied-location no-dead-end fallback (ERR-01). It is complementary to
 * `useCurrentPosition` (03-02, the single live-coordinate source): this hook
 * reports ONLY the permission decision, not coordinates, and reuses that hook's
 * `PermissionStatus` enum rather than inventing a parallel shape. Both follow the
 * Phase 2 `gpsConsent.ts` foreground-permission convention
 * (`requestForegroundPermissionsAsync`); this hook never records consent.
 *
 * When permission is `denied`, `showManualSearch` is true and the caller must
 * render the manual-search entry + "Search this area" affordance instead of a
 * GPS-centered dead end. Per approved decision D-34 (2026-07-05) the Phase 3
 * scope is map recenter + pan + "Search this area" (bbox re-query) with NO
 * external geocoding provider — so this hook adds no network/API surface.
 */
export interface DeniedLocationState {
  /** Foreground-permission decision, normalized to three values. */
  permission: PermissionStatus;
  /**
   * True only when permission is `denied` — the signal to render the ERR-01
   * manual-search fallback (recenter + "Search this area") in place of a
   * GPS-centered view. `undetermined` keeps this false (not yet a dead end).
   */
  showManualSearch: boolean;
}

export function useDeniedLocationState(): DeniedLocationState {
  const [permission, setPermission] = useState<PermissionStatus>('undetermined');

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then((perm) => {
      if (perm.status === 'granted') setPermission('granted');
      else if (perm.status === 'denied') setPermission('denied');
      else setPermission('undetermined');
    });
  }, []);

  return { permission, showManualSearch: permission === 'denied' };
}
