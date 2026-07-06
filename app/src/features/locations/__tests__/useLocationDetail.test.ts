// Mocks the supabase singleton (profileStats.test.ts pattern) to assert the
// exact rpc() args (including optional user coords) and the distance_m mapping.
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: jest.fn() },
}));

import { useLocationDetail } from '../useLocationDetail';
import {
  detailRowWithDistance,
  detailRowWithoutDistance,
} from '../../../test/fixtures/locations';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

const ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useLocationDetail', () => {
  it('forwards user coords as user_lat/user_lng and maps distance_m → distanceM', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [detailRowWithDistance], error: null });

    const detail = await useLocationDetail(ID, 44.05, -123.09);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_location_detail', {
      location_id: ID,
      user_lat: 44.05,
      user_lng: -123.09,
    });
    expect(detail.distanceM).toBe(120);
    expect(detail.address).toBe('123 Willamette St, Eugene, OR');
    expect(detail.name).toBe('High Confidence Cafe');
  });

  it('omits user coords from the RPC call and yields null distanceM when not supplied', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [detailRowWithoutDistance], error: null });

    const detail = await useLocationDetail(ID);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_location_detail', {
      location_id: ID,
    });
    expect(detail.distanceM).toBeNull();
  });

  it('never exposes a door-code / access-code field on the result', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [detailRowWithDistance], error: null });

    const detail = await useLocationDetail(ID, 44.05, -123.09);

    expect(detail).not.toHaveProperty('accessCode');
    expect(detail).not.toHaveProperty('access_code');
    expect(detail).not.toHaveProperty('accessInstructions');
    expect(detail).not.toHaveProperty('access_instructions');
  });

  it('throws when the RPC returns an error', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error('detail rpc failed'),
    });

    await expect(useLocationDetail(ID, 44.05, -123.09)).rejects.toThrow('detail rpc failed');
  });

  it('throws a not-found error when the RPC returns no row', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(useLocationDetail(ID)).rejects.toThrow('Location not found');
  });
});
