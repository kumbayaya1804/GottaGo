/**
 * Thin render + behavior tests for app/src/app/(components)/LocationDetailSheet.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for TDD
 * Guard compliance and behavioral verification only, not coverage metrics.
 *
 * Contract under test (D-12..D-24):
 *  - The sheet FORWARDS its userLat/userLng props into useLocationDetail(id, lat, lng)
 *    (the current coords MapScreen sources from useCurrentPosition) — it never
 *    computes distance itself. distanceM is the RPC-echoed value.
 *  - Peek tier: name / distance / policy badge / confidence badge.
 *  - "Hours not yet available" when hours is null (D-18).
 *  - Only Get Directions renders (D-13); Verify/Rate/Report are absent.
 *  - No access-code text anywhere (D-24).
 */
import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Mock @gorhom/bottom-sheet: render children as plain Views so content is queryable.
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

// --- Mock the data hook: assert the exact forwarded args and control the returned shape.
const mockUseLocationDetail = jest.fn();
jest.mock('../../../features/locations/useLocationDetail', () => ({
  useLocationDetail: (...args: unknown[]) => mockUseLocationDetail(...args),
}));

// --- Mock distance formatting so the assertion is locale-independent.
jest.mock('../../../features/locations/formatDistance', () => ({
  formatDistance: (meters: number) => `FMT:${meters}`,
  usesMilesForLocale: () => true,
}));

import LocationDetailSheet from '../../(components)/LocationDetailSheet';

const ID = '11111111-1111-1111-1111-111111111111';
const USER_LAT = 44.051;
const USER_LNG = -123.092;

const baseDetail = {
  id: ID,
  name: 'High Confidence Cafe',
  lat: 44.0505,
  lng: -123.0905,
  policyTag: 'chill_spot',
  confidenceTier: 'High',
  verificationCount: 14,
  lastVerifiedAt: '2026-07-01T12:00:00Z',
  isOpenNow: true,
  chillSpot: true,
  address: '123 Willamette St, Eugene, OR',
  hours: { mon: '08:00-20:00' },
  distanceM: 1200,
};

function renderSheet(props: Partial<React.ComponentProps<typeof LocationDetailSheet>> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LocationDetailSheet
        locationId={ID}
        userLat={USER_LAT}
        userLng={USER_LNG}
        onDismiss={jest.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocationDetail.mockResolvedValue(baseDetail);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('LocationDetailSheet', () => {
  it('forwards its userLat/userLng props into useLocationDetail (not the id alone)', async () => {
    renderSheet();
    await waitFor(() =>
      expect(mockUseLocationDetail).toHaveBeenCalledWith(ID, USER_LAT, USER_LNG),
    );
  });

  it('renders the distance line from the RPC-echoed distanceM via formatDistance', async () => {
    const { findByText } = renderSheet();
    // formatDistance mock echoes FMT:<meters>; 1200 is the RPC-echoed distanceM.
    expect(await findByText('FMT:1200')).toBeTruthy();
  });

  it('omits the distance line entirely when the RPC returns a null distanceM', async () => {
    mockUseLocationDetail.mockResolvedValue({ ...baseDetail, distanceM: null });
    const { findByText, queryByText } = renderSheet({ userLat: null, userLng: null });
    // Wait for resolution via the always-present name, then assert no distance text.
    await findByText('High Confidence Cafe');
    expect(queryByText(/^FMT:/)).toBeNull();
  });

  it('renders name, policy-tag badge, and confidence badge from useLocationDetail', async () => {
    const { findByText, getByText } = renderSheet();
    expect(await findByText('High Confidence Cafe')).toBeTruthy();
    expect(getByText('Chill Spot')).toBeTruthy();
    expect(getByText('High — 14 GPS verifications')).toBeTruthy();
  });

  it('renders "Hours not yet available" when hours is null (D-18)', async () => {
    mockUseLocationDetail.mockResolvedValue({ ...baseDetail, hours: null });
    const { findByText } = renderSheet();
    expect(await findByText('Hours not yet available')).toBeTruthy();
  });

  it('Get Directions opens the native maps app with the location lat/lng', async () => {
    const { findByLabelText } = renderSheet();
    const button = await findByLabelText('Get Directions');
    fireEvent.press(button);
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    const url = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('44.0505');
    expect(url).toContain('-123.0905');
  });

  it('does NOT render Verify / Rate / Report this phase (D-13)', async () => {
    const { findByText, queryByText } = renderSheet();
    await findByText('High Confidence Cafe');
    expect(queryByText('GPS Verify')).toBeNull();
    expect(queryByText('Verify')).toBeNull();
    expect(queryByText('Rate')).toBeNull();
    expect(queryByText('Report')).toBeNull();
  });

  it('never renders any access-code text (D-24)', async () => {
    const { findByText, queryByText } = renderSheet();
    await findByText('High Confidence Cafe');
    expect(queryByText(/access code/i)).toBeNull();
    expect(queryByText(/access instructions/i)).toBeNull();
  });

  it('is dismissed by gesture only — no explicit close button (D-17)', async () => {
    const { findByText, queryByLabelText, queryByText } = renderSheet();
    await findByText('High Confidence Cafe');
    expect(queryByLabelText('Close')).toBeNull();
    expect(queryByText('Close')).toBeNull();
  });
});
