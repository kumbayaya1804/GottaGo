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

import { updateProfile } from '../updateProfile';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateProfile', () => {
  it('calls the update_profile RPC with new_display_name', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await updateProfile('Alice');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('update_profile', { new_display_name: 'Alice' });
  });

  it('throws the original error for a non-display-name-taken failure', async () => {
    const rpcError = new Error('network error');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(updateProfile('Alice')).rejects.toThrow('network error');
  });

  it('throws a friendly "already taken" error on a display-name unique violation', async () => {
    const takenError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_display_name_lower_uniq"',
    };
    mockSupabase.rpc.mockResolvedValue({ data: null, error: takenError });

    await expect(updateProfile('Admin')).rejects.toThrow('That display name is already taken.');
  });
});
