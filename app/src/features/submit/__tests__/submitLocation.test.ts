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

import { submitLocation } from '../submitLocation';
import type { SubmitInput } from '../types';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  rpc: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

function baseInput(overrides: Partial<SubmitInput> = {}): SubmitInput {
  return {
    name: 'Alton Baker Park restroom',
    lat: 44.05,
    lng: -123.08,
    accuracy: 12,
    mocked: false,
    timestamp: 1799999999000,
    policyTag: 'public_facility',
    address: 'North parking lot',
    sensitive: false,
    hours: undefined,
    accessCode: undefined,
    timingTip: undefined,
    changingTable: false,
    wheelchair: false,
    ...overrides,
  };
}

describe('submitLocation', () => {
  it('calls the submit_location RPC with the full p_* mapping', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'submission-id-123', error: null });

    await submitLocation(baseInput());

    expect(mockSupabase.rpc).toHaveBeenCalledWith('submit_location', {
      p_name: 'Alton Baker Park restroom',
      p_lat: 44.05,
      p_lng: -123.08,
      p_accuracy_m: 12,
      p_mocked: false,
      p_captured_at: new Date(1799999999000).toISOString(),
      p_policy_tag: 'public_facility',
      p_address: 'North parking lot',
      p_access_sensitivity: undefined,
      p_hours: undefined,
      p_access_code: undefined,
      p_timing_tip: undefined,
      p_changing_table: false,
      p_wheelchair: false,
    });
  });

  it('maps sensitive:true to p_access_sensitivity "sensitive" (D-09)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ sensitive: true }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_access_sensitivity: 'sensitive' })
    );
  });

  it('maps sensitive:false to p_access_sensitivity undefined — omits the key so the RPC default (null) applies (D-09)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ sensitive: false }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_access_sensitivity: undefined })
    );
  });

  it('sends p_access_code undefined when policyTag is code_required but accessCode is absent (D-19 optional)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ policyTag: 'code_required', accessCode: undefined }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_access_code: undefined })
    );
  });

  it('sends p_access_code when policyTag is code_required (D-17)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ policyTag: 'code_required', accessCode: '1234' }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_access_code: '1234' })
    );
  });

  it('omits p_access_code (undefined) when policyTag is not code_required, even if accessCode is present (D-17)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ policyTag: 'public_facility', accessCode: '1234' }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_access_code: undefined })
    );
  });

  it('rethrows the raw RPC error unchanged (including the generic "gps rejected" error)', async () => {
    const rpcError = new Error('gps rejected');
    mockSupabase.rpc.mockResolvedValue({ data: null, error: rpcError });

    await expect(submitLocation(baseInput())).rejects.toBe(rpcError);
  });

  it('returns the submission id string on success', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'submission-id-456', error: null });

    await expect(submitLocation(baseInput())).resolves.toBe('submission-id-456');
  });

  it('maps a missing address to p_address undefined (D-04 free-text-only submissions)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ address: undefined }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_address: undefined })
    );
  });

  it('forwards a provided hours description as p_hours', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });
    const hours = 'Open 7am-10pm';

    await submitLocation(baseInput({ hours }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_hours: hours })
    );
  });

  it('forwards a provided timing tip as p_timing_tip', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ timingTip: 'Busiest around lunch' }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_timing_tip: 'Busiest around lunch' })
    );
  });

  // ---------------------------------------------------------------------------
  // Phase 5 (D-62/D-63): the two accessibility selections are finally FORWARDED.
  // Through Phase 4 these were rendered in SubmitFlow, toggled by the user, and then
  // silently discarded at buildInput because the RPC exposed no parameters for them.
  // These assertions are the regression guard against that reappearing.
  // ---------------------------------------------------------------------------
  it('forwards changingTable:true as p_changing_table (D-62)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ changingTable: true }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_changing_table: true })
    );
  });

  it('forwards wheelchair:true as p_wheelchair (D-62)', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ wheelchair: true }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_wheelchair: true })
    );
  });

  it('sends explicit false (never undefined) for unselected accessibility options', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ changingTable: false, wheelchair: false }));

    // Explicit `false` rather than `?? undefined`: an omitted key would fall through
    // to the RPC's DEFAULT false and produce the same row, but sending the value the
    // user actually chose keeps the client payload an honest record of the selection
    // and makes a future default change a non-event.
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_changing_table: false, p_wheelchair: false })
    );
  });

  it('forwards both accessibility selections independently', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null });

    await submitLocation(baseInput({ changingTable: true, wheelchair: false }));

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'submit_location',
      expect.objectContaining({ p_changing_table: true, p_wheelchair: false })
    );
  });
});
