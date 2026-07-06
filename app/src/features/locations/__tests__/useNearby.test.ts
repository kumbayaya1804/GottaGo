// Mocks the supabase singleton (profileStats.test.ts pattern) to assert rpc args
// and that the mapped result stays distance-sorted (ascending) as the RPC returns.
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { useNearby } from '../useNearby';
import { nearbyRows } from '../../../test/fixtures/locations';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNearby', () => {
  it('calls search_locations_nearby with user coords + filters', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: nearbyRows, error: null });

    await useNearby(44.05, -123.09, { result_limit: 20, filter_chill_spot: true });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations_nearby', {
      user_lat: 44.05,
      user_lng: -123.09,
      result_limit: 20,
      filter_chill_spot: true,
    });
  });

  it('defaults to no filters when none supplied', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: nearbyRows, error: null });

    await useNearby(44.05, -123.09);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_locations_nearby', {
      user_lat: 44.05,
      user_lng: -123.09,
    });
  });

  it('maps rows to camelCase NearbyLocation with distanceM', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: nearbyRows, error: null });

    const result = await useNearby(44.05, -123.09);

    expect(result[0]).toEqual({
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
      distanceM: 120,
    });
  });

  it('returns a result that is non-decreasing by distanceM', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: nearbyRows, error: null });

    const result = await useNearby(44.05, -123.09);

    const distances = result.map((r) => r.distanceM);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
    for (let i = 1; i < distances.length; i += 1) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });

  it('returns an empty array when the RPC returns null data', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const result = await useNearby(44.05, -123.09);

    expect(result).toEqual([]);
  });

  it('throws when the RPC returns an error', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error('nearby rpc failed'),
    });

    await expect(useNearby(44.05, -123.09)).rejects.toThrow('nearby rpc failed');
  });
});
