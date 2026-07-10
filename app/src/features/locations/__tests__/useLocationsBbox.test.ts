// Uses the profileStats.test.ts approach: mock the supabase singleton so the
// exact rpc() arguments and the row→GeoJSON transform can be asserted directly.
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { fetchLocationsBbox, toMapLocation } from '../useLocationsBbox';
import { bboxRows } from '../../../test/fixtures/locations';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

const viewport = { minLng: -123.1, minLat: 44.04, maxLng: -123.08, maxLat: 44.06 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('toMapLocation', () => {
  it('maps a fully-populated snake_case row to camelCase', () => {
    expect(toMapLocation(bboxRows[0])).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'High Confidence Cafe',
      lat: 44.0505,
      lng: -123.0905,
      policyTag: 'chill_spot',
      confidenceTier: 'High',
      verificationCount: 14,
      lastVerifiedAt: '2026-07-01T12:00:00Z',
      isOpenNow: true,
      chillSpot: true,
    });
  });

  it('applies null-safe defaults for a row with missing data (D-08)', () => {
    expect(toMapLocation(bboxRows[3])).toEqual({
      id: '44444444-4444-4444-4444-444444444444',
      name: 'Unknown Data Restroom',
      lat: 44.0521,
      lng: -123.0899,
      policyTag: null,
      confidenceTier: null,
      verificationCount: 0,
      lastVerifiedAt: null,
      isOpenNow: false,
      chillSpot: false,
    });
  });
});

describe('fetchLocationsBbox', () => {
  it('calls search_locations_bbox with snake_case viewport + filter args', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: bboxRows, error: null });

    await fetchLocationsBbox(viewport, {
      filter_open_now: true,
      filter_wheelchair: true,
      max_pins: 200,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations_bbox', {
      min_lng: -123.1,
      min_lat: 44.04,
      max_lng: -123.08,
      max_lat: 44.06,
      filter_open_now: true,
      filter_wheelchair: true,
      max_pins: 200,
    });
  });

  it('defaults to no filters when none are supplied', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: bboxRows, error: null });

    await fetchLocationsBbox(viewport);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations_bbox', {
      min_lng: -123.1,
      min_lat: 44.04,
      max_lng: -123.08,
      max_lat: 44.06,
    });
  });

  it('transforms rows into a GeoJSON FeatureCollection with [lng,lat] geometry', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: bboxRows, error: null });

    const fc = await fetchLocationsBbox(viewport);

    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(4);
    const first = fc.features[0];
    expect(first.type).toBe('Feature');
    expect(first.geometry).toEqual({
      type: 'Point',
      coordinates: [-123.0905, 44.0505],
    });
    expect(first.properties).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'High Confidence Cafe',
      policyTag: 'chill_spot',
      confidenceTier: 'High',
      verificationCount: 14,
      lastVerifiedAt: '2026-07-01T12:00:00Z',
      isOpenNow: true,
      chillSpot: true,
    });
  });

  it('returns an empty FeatureCollection when the RPC returns null data', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const fc = await fetchLocationsBbox(viewport);

    expect(fc).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('throws when the RPC returns an error', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error('bbox rpc failed'),
    });

    await expect(fetchLocationsBbox(viewport)).rejects.toThrow('bbox rpc failed');
  });
});
