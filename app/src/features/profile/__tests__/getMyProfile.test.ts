// Mocks supabase's fluent query builder. `users_select_own` RLS restricts rows to
// auth.uid() = id server-side, so the client-passed userId is not itself a security
// boundary — it just tells Postgres which row to look at.
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { getMyProfile } from '../getMyProfile';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getMyProfile', () => {
  it('queries public.users for the given userId', async () => {
    mockSingle.mockResolvedValue({ data: { display_name: 'Jamie' }, error: null });

    await getMyProfile('user-1');

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockSelect).toHaveBeenCalledWith('display_name');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns displayName from the row', async () => {
    mockSingle.mockResolvedValue({ data: { display_name: 'Jamie' }, error: null });

    const result = await getMyProfile('user-1');

    expect(result).toEqual({ displayName: 'Jamie' });
  });

  it('returns null displayName when the row value is null', async () => {
    mockSingle.mockResolvedValue({ data: { display_name: null }, error: null });

    const result = await getMyProfile('user-1');

    expect(result).toEqual({ displayName: null });
  });

  it('throws when the query returns an error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(getMyProfile('user-1')).rejects.toThrow('network down');
  });
});
