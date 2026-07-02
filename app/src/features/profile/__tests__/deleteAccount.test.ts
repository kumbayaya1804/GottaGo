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

import { deleteAccount } from '../deleteAccount';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('deleteAccount', () => {
  it('calls the delete_account RPC', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await deleteAccount();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_account');
  });

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('not authenticated');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(deleteAccount()).rejects.toThrow('not authenticated');
  });
});
