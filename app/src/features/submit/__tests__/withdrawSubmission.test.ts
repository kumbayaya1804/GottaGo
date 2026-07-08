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

import { withdrawSubmission } from '../withdrawSubmission';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('withdrawSubmission', () => {
  it('calls the withdraw_submission RPC with the p_submission_id arg', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await withdrawSubmission('sub-123');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('withdraw_submission', {
      p_submission_id: 'sub-123',
    });
  });

  it('resolves void on success (does not navigate or refetch)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    await expect(withdrawSubmission('sub-123')).resolves.toBeUndefined();
  });

  it('rethrows the raw RPC error unchanged', async () => {
    const rpcError = new Error('withdraw failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(withdrawSubmission('sub-123')).rejects.toBe(rpcError);
  });
});
