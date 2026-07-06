import * as Localization from 'expo-localization';

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

/** Regions that conventionally display distances in miles/feet. */
const MILE_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

/**
 * Resolves the device's ISO region code, preferring expo-localization and
 * falling back to the Intl locale's trailing region segment. Returns null when
 * no 2-letter region can be determined.
 */
function currentRegion(): string | null {
  const fromLocale = Localization.getLocales()[0]?.regionCode;
  if (fromLocale) return fromLocale;

  const intlLocale = new Intl.NumberFormat().resolvedOptions().locale;
  const segments = intlLocale.split('-');
  const candidate = segments[segments.length - 1];
  return candidate.length === 2 ? candidate.toUpperCase() : null;
}

/**
 * True when the device locale uses miles (US/UK/Liberia/Myanmar), false for
 * metric locales. Callers pass the result to `formatDistance`'s `usesMiles`.
 */
export function usesMilesForLocale(): boolean {
  const region = currentRegion();
  return region !== null && MILE_REGIONS.has(region);
}

/**
 * Formats a server-provided straight-line distance in meters (D-22) into a
 * locale-appropriate label (D-23).
 *
 * Imperial: below 0.1 mi renders as feet, otherwise miles to one decimal.
 * Metric: below 1000 m renders as meters, otherwise kilometers to one decimal.
 *
 * NOTE: the plan's illustrative "(500, usesMiles=true) → feet" example is
 * arithmetically inconsistent (500 m ≈ 0.31 mi). The 0.1-mi feet threshold used
 * here matches the RESEARCH code example and the acceptance criterion's
 * "sub-0.1mi feet branch"; 500 m therefore renders as "0.3 mi".
 */
export function formatDistance(meters: number, usesMiles: boolean): string {
  if (usesMiles) {
    const miles = meters / METERS_PER_MILE;
    if (miles < 0.1) {
      return `${Math.round(meters / METERS_PER_FOOT)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
