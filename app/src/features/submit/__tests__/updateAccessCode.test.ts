// Mock the supabase singleton so rpc() calls can be intercepted
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

import { updateAccessCode, confirmAccessCode, getAccessCode } from '../updateAccessCode';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateAccessCode', () => {
  it('calls the update_access_code RPC with { p_location_id, p_code } (stage only)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await updateAccessCode('loc-1', '1234');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_access_code', {
      p_location_id: 'loc-1',
      p_code: '1234',
    });
  });

  it('rethrows the raw RPC error unchanged', async () => {
    const rpcError = new Error('update failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(updateAccessCode('loc-1', '1234')).rejects.toBe(rpcError);
  });
});

describe('confirmAccessCode', () => {
  it('calls the confirm_access_code RPC with { p_location_id }', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await confirmAccessCode('loc-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('confirm_access_code', {
      p_location_id: 'loc-1',
    });
  });

  it('rethrows the raw RPC error unchanged', async () => {
    const rpcError = new Error('confirm failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(confirmAccessCode('loc-1')).rejects.toBe(rpcError);
  });
});

describe('getAccessCode', () => {
  it('calls the get_access_code RPC with { p_location_id } and returns the code string', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: '4821', error: null });

    const code = await getAccessCode('loc-1');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_access_code', {
      p_location_id: 'loc-1',
    });
    expect(code).toBe('4821');
  });

  it('rethrows the raw RPC error unchanged', async () => {
    const rpcError = new Error('get failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(getAccessCode('loc-1')).rejects.toBe(rpcError);
  });
});
