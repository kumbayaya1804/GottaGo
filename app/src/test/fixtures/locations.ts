/**
 * Shared location fixtures for Phase 3 data-layer tests.
 *
 * These mirror what the Phase 3 RPCs actually return — i.e. the CLIENT-visible,
 * already-moderated set. Suppressed / shadowbanned / deleted / family-mode
 * rows are excluded server-side, so they never appear here: the client must
 * never re-filter, and these fixtures encode that contract by omission.
 *
 * Coordinates sit near the 03-01 dev-seed center (Eugene, OR ~44.05, -123.09).
 */
import type {
  BboxRpcRow,
  NearbyRpcRow,
  LocationDetailRpcRow,
} from '../../features/locations/types';

/** bbox rows across confidence tiers, including one null-data row (D-08). */
export const bboxRows: BboxRpcRow[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'High Confidence Cafe',
    lat: 44.0505,
    lng: -123.0905,
    policy_tag: 'chill_spot',
    confidence_tier: 'High',
    verification_count: 14,
    last_verified_at: '2026-07-01T12:00:00Z',
    is_open_now: true,
    chill_spot: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Medium Confidence Library',
    lat: 44.0512,
    lng: -123.0888,
    policy_tag: 'public_facility',
    confidence_tier: 'Medium',
    verification_count: 5,
    last_verified_at: '2026-06-20T09:30:00Z',
    is_open_now: false,
    chill_spot: false,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Low Confidence Gas Station',
    lat: 44.0489,
    lng: -123.0921,
    policy_tag: 'code_required',
    confidence_tier: 'Low',
    verification_count: 1,
    last_verified_at: '2026-05-10T18:45:00Z',
    is_open_now: true,
    chill_spot: false,
  },
  {
    // D-08: a row with missing underlying data — must still be INCLUDED.
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Unknown Data Restroom',
    lat: 44.0521,
    lng: -123.0899,
    policy_tag: null,
    confidence_tier: null,
    verification_count: null,
    last_verified_at: null,
    is_open_now: null,
    chill_spot: null,
  },
];

/**
 * Nearby rows: same locations with server distances, returned in ascending
 * distance order (as the RPC's `<->` KNN ordering guarantees).
 */
export const nearbyRows: NearbyRpcRow[] = [
  { ...bboxRows[0], distance_m: 120 },
  { ...bboxRows[1], distance_m: 340 },
  { ...bboxRows[3], distance_m: 810 },
  { ...bboxRows[2], distance_m: 1500 },
];

/** Detail row WITH a server-computed distance (caller supplied coords). */
export const detailRowWithDistance: LocationDetailRpcRow = {
  ...bboxRows[0],
  address: '123 Willamette St, Eugene, OR',
  hours: { mon: '08:00-20:00', tue: '08:00-20:00' },
  distance_m: 120,
};

/** Detail row WITHOUT a distance (caller omitted coords → null). */
export const detailRowWithoutDistance: LocationDetailRpcRow = {
  ...bboxRows[1],
  address: '456 Broadway, Eugene, OR',
  hours: null,
  distance_m: null,
};
