/**
 * Behavior tests for the Phase 4 "Update door code" extension of
 * app/src/app/(components)/LocationDetailSheet.tsx (D-21 / D-23 / D-24).
 *
 * src/app/** is excluded from coverage collection — these tests exist for TDD
 * Guard compliance and behavioral verification only, not coverage metrics.
 *
 * Contract under test:
 *  - The 'Update door code' action is signed-in-only: tapping it while signed OUT opens
 *    AuthRequiredModal (action='see access code') and reveals NO code input; it never
 *    displays any current/live code to anon (T-04-23).
 *  - Signed IN, tapping it opens a freeform code input (no numeric-only validation, D-20).
 *  - Submitting a new code calls updateAccessCode(locationId, code) and then shows a
 *    pending-confirmation state (D-24) — NOT an immediate "code is live" message.
 *  - Get Directions and the existing published detail remain intact (no regression).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@gorhom/bottom-sheet', () => {
  const RealReact = require('react');
  const { View } = require('react-native');
  const BottomSheet = RealReact.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      RealReact.useImperativeHandle(ref, () => ({
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
      }));
      return RealReact.createElement(View, { testID: 'location-detail-sheet' }, children);
    },
  );
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children }: { children: React.ReactNode }) =>
      RealReact.createElement(View, null, children),
    BottomSheetBackdrop: () => null,
  };
});

const mockUseLocationDetail = jest.fn();
jest.mock('../../../features/locations/useLocationDetail', () => ({
  useLocationDetail: (...args: unknown[]) => mockUseLocationDetail(...args),
}));

jest.mock('../../../features/locations/formatDistance', () => ({
  formatDistance: (meters: number) => `FMT:${meters}`,
  usesMilesForLocale: () => true,
}));

// Controllable auth session — the update-code action is signed-in-only.
let mockSessionValue: { session: { user: { id: string } } | null } | null;
jest.mock('../../../features/auth/useSession', () => ({
  useSession: () => mockSessionValue,
}));

// The stage-only update wrapper (never promotes; the different-user gate is server-side).
const mockUpdateAccessCode = jest.fn();
jest.mock('../../../features/submit/updateAccessCode', () => ({
  updateAccessCode: (...args: unknown[]) => mockUpdateAccessCode(...args),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

import LocationDetailSheet from '../../(components)/LocationDetailSheet';

const ID = '11111111-1111-1111-1111-111111111111';

const baseDetail = {
  id: ID,
  name: 'Code Cafe',
  lat: 44.0505,
  lng: -123.0905,
  policyTag: 'code_required',
  confidenceTier: 'High',
  verificationCount: 5,
  lastVerifiedAt: '2026-07-01T12:00:00Z',
  isOpenNow: true,
  chillSpot: false,
  address: '123 Willamette St',
  hours: { mon: '08:00-20:00' },
  distanceM: 500,
};

const PENDING_COPY =
  'New code proposed. It needs one confirming verification from another user before it goes live.';

function renderSheet() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LocationDetailSheet locationId={ID} userLat={null} userLng={null} onDismiss={jest.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocationDetail.mockResolvedValue(baseDetail);
  mockUpdateAccessCode.mockResolvedValue(undefined);
  mockSessionValue = null;
});

describe('LocationDetailSheet — Update door code (D-23/D-24)', () => {
  it('renders the "Update door code" action', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByLabelText } = renderSheet();
    expect(await findByLabelText('Update door code')).toBeTruthy();
  });

  it('keeps Get Directions intact (no regression)', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByLabelText } = renderSheet();
    expect(await findByLabelText('Get Directions')).toBeTruthy();
  });

  it('signed OUT: tapping Update door code opens AuthRequiredModal and shows no code input', async () => {
    mockSessionValue = { session: null };
    const { findByLabelText, getByText, queryByLabelText } = renderSheet();
    fireEvent.press(await findByLabelText('Update door code'));
    expect(getByText('Sign in to see access code')).toBeTruthy();
    expect(queryByLabelText('New door code')).toBeNull();
  });

  it('signed IN: tapping Update door code opens the freeform code input, not the auth modal', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByLabelText, queryByText } = renderSheet();
    fireEvent.press(await findByLabelText('Update door code'));
    expect(await findByLabelText('New door code')).toBeTruthy();
    expect(queryByText('Sign in to see access code')).toBeNull();
  });

  it('the code input has no numeric-only keyboard (freeform, D-20)', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByLabelText } = renderSheet();
    fireEvent.press(await findByLabelText('Update door code'));
    const input = await findByLabelText('New door code');
    expect(['default', undefined]).toContain(input.props.keyboardType);
  });

  it('submitting a new alphanumeric code calls updateAccessCode(locationId, code)', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByLabelText } = renderSheet();
    fireEvent.press(await findByLabelText('Update door code'));
    fireEvent.changeText(await findByLabelText('New door code'), 'A1b2#');
    fireEvent.press(await findByLabelText('Propose new code'));
    await waitFor(() => {
      expect(mockUpdateAccessCode).toHaveBeenCalledWith(ID, 'A1b2#');
    });
  });

  it('after submit shows a pending-confirmation state, NOT a "code is live" message', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByLabelText, findByText, queryByText } = renderSheet();
    fireEvent.press(await findByLabelText('Update door code'));
    fireEvent.changeText(await findByLabelText('New door code'), '4242');
    fireEvent.press(await findByLabelText('Propose new code'));
    expect(await findByText(PENDING_COPY)).toBeTruthy();
    expect(queryByText(/code is now live/i)).toBeNull();
    expect(queryByText(/code updated/i)).toBeNull();
    expect(queryByText(/now active/i)).toBeNull();
  });

  it('never reveals the current/live code value anywhere in the sheet (T-04-23)', async () => {
    // getAccessCode is never called by this UI — the update flow only STAGES a new code.
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByText, queryByText } = renderSheet();
    await findByText('Code Cafe');
    expect(queryByText(/current code/i)).toBeNull();
    expect(queryByText(/access code/i)).toBeNull();
  });

  it('on updateAccessCode failure shows an inline error and no pending-confirmation state', async () => {
    mockUpdateAccessCode.mockRejectedValue(new Error('network down'));
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    const { findByLabelText, findByText, queryByText } = renderSheet();
    fireEvent.press(await findByLabelText('Update door code'));
    fireEvent.changeText(await findByLabelText('New door code'), '4242');
    fireEvent.press(await findByLabelText('Propose new code'));
    await findByText("Couldn't submit the new code. Check your connection and try again.");
    expect(queryByText(PENDING_COPY)).toBeNull();
  });
});
