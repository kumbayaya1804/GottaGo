import * as Location from 'expo-location';
import type { GpsDenied, GpsSample } from './types';

/**
 * Reads a single high-accuracy GPS sample for the SubmitFlow GPS-confirm step (SC1).
 *
 * Requests foreground-location permission and, on grant, takes one fix in
 * `Accuracy.BestForNavigation` mode (higher precision than the `Balanced` mode the
 * Phase 3 map uses — submission coordinates are the canonical location source, D-05).
 *
 * Returns the raw sample so the wizard can pre-check accuracy/freshness (advisory
 * only — the `submit_location` RPC re-validates and is the authority, RESEARCH
 * Pattern 2 / Pitfall 1). `mocked` is normalized with `?? false` because
 * `LocationObject.mocked` is Android-only (`undefined` on iOS, which does not permit
 * mock locations without a jailbreak).
 *
 * Never throws on a non-granted permission — it returns a `{denied:true}` sentinel so
 * the caller renders the ERR-01 "use search instead" state rather than a dead end.
 */
export async function getGpsSample(): Promise<GpsSample | GpsDenied> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    return { denied: true };
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.BestForNavigation,
  });

  return {
    coord: { lat: pos.coords.latitude, lng: pos.coords.longitude },
    accuracy: pos.coords.accuracy,
    mocked: pos.mocked ?? false,
    timestamp: pos.timestamp,
  };
}
