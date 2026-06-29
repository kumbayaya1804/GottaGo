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

import { checkDisplayNameAvailable, isDisplayNameTakenError } from '../displayName';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('checkDisplayNameAvailable', () => {
  it('returns true when the display name is available', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

    const result = await checkDisplayNameAvailable('Alice');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_display_name_available', { name: 'Alice' });
    expect(result).toBe(true);
  });

  it('returns false when the display name is taken', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

    const result = await checkDisplayNameAvailable('Admin');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('check_display_name_available', { name: 'Admin' });
    expect(result).toBe(false);
  });

  it('throws when the RPC returns an error', async () => {
    const rpcError = new Error('RPC failed');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(checkDisplayNameAvailable('Alice')).rejects.toThrow('RPC failed');
  });
});

describe('isDisplayNameTakenError', () => {
  it('returns true for a Postgres unique-violation (code 23505) on the display_name index', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_display_name_lower_uniq"',
    };
    expect(isDisplayNameTakenError(error)).toBe(true);
  });

  it('returns false for a 23505 error on a different constraint', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "some_other_constraint"',
    };
    expect(isDisplayNameTakenError(error)).toBe(false);
  });

  it('returns false for a non-23505 error code', () => {
    const error = {
      code: '42601',
      message: 'syntax error',
    };
    expect(isDisplayNameTakenError(error)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isDisplayNameTakenError(null)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isDisplayNameTakenError('some error')).toBe(false);
  });

  it('returns false for an Error instance without a code', () => {
    expect(isDisplayNameTakenError(new Error('something went wrong'))).toBe(false);
  });
});
