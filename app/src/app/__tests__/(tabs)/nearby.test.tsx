/**
 * Thin render + behavior tests for app/src/app/(tabs)/nearby.tsx (NearbyScreen).
 *
 * src/app/** is excluded from coverage collection — these tests exist for TDD
 * Guard compliance and behavioral verification only, not coverage metrics.
 *
 * Contract under test (D-29 / UI-SPEC §Nearby):
 *  - Rows render from useNearby, whose coords come from useCurrentPosition (the
 *    SAME source MapScreen uses); sorting is delegated to the tested hook.
 *  - Every row exposes accessibilityRole/Label/Hint (WCAG 2.1 AA, D-27's
 *    accessible alternative to the visual-only map).
 *  - A row tap opens the shared LocationDetailSheet with the row id AND the
 *    current userLat/userLng — never the id alone (so the sheet's server-echoed
 *    distance stays consistent with the row's distance).
 *  - Truly-empty vs filtered-empty are DISTINCT states with the locked copy;
 *    RPC-failure shows a Retry banner; denied GPS is not a dead end.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Controllable live-coordinate source (the shared 03-02 hook).
const mockUseCurrentPosition = jest.fn();
jest.mock('../../../features/locations/useCurrentPosition', () => ({
  useCurrentPosition: () => mockUseCurrentPosition(),
  POSITION_FRESHNESS_MS: 60000,
}));

// --- Controllable nearby fetch.
const mockUseNearby = jest.fn();
jest.mock('../../../features/locations/useNearby', () => ({
  useNearby: (...args: unknown[]) => mockUseNearby(...args),
}));

// --- Controllable filters store (session-persisted; drives filtered-empty vs truly-empty).
let mockFilters: Record<string, unknown>;
jest.mock('../../../features/filters/useFiltersStore', () => ({
  useFiltersStore: () => mockFilters,
}));

// --- Locale-independent distance formatting.
jest.mock('../../../features/locations/formatDistance', () => ({
  formatDistance: (meters: number) => `FMT:${meters}`,
  usesMilesForLocale: () => true,
}));

const mockOpenSettings = jest.fn();
jest.mock('expo-linking', () => ({
  openSettings: (...args: unknown[]) => mockOpenSettings(...args),
}));

// --- Spy the shared sheet to assert the props NearbyScreen forwards into it.
const mockSheetSpy = jest.fn();
jest.mock('../../(components)/LocationDetailSheet', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockSheetSpy(props);
    return null;
  },
}));

import NearbyScreen from '../../(tabs)/nearby';

const COORDS = { userLat: 44.051, userLng: -123.092 };

const ROWS = [
  {
    id: 'a',
    name: 'High Confidence Cafe',
    lat: 44.0505,
    lng: -123.0905,
    policyTag: 'chill_spot',
    confidenceTier: 'High',
    verificationCount: 14,
    lastVerifiedAt: '2026-07-01T12:00:00Z',
    isOpenNow: true,
    chillSpot: true,
    distanceM: 120,
  },
  {
    id: 'b',
    name: 'Medium Confidence Library',
    lat: 44.0512,
    lng: -123.0888,
    policyTag: 'public_facility',
    confidenceTier: 'Medium',
    verificationCount: 5,
    lastVerifiedAt: '2026-06-20T09:30:00Z',
    isOpenNow: false,
    chillSpot: false,
    distanceM: 340,
  },
];

function emptyFilters(overrides: Record<string, unknown> = {}) {
  return {
    openNow: false,
    chillSpot: false,
    wheelchair: false,
    changing: false,
    highConf: false,
    toggle: jest.fn(),
    clearAll: jest.fn(),
    activeRpcFilters: () => ({}),
    ...overrides,
  };
}

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={client}>
      <NearbyScreen />
    </QueryClientProvider>,
  );
  // Flush the microtask on which the mocked queryFn resolves.
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseCurrentPosition.mockReturnValue({ coords: COORDS, status: 'granted', isStale: false });
  mockUseNearby.mockResolvedValue(ROWS);
  mockFilters = emptyFilters();
});

describe('NearbyScreen', () => {
  it('renders rows from useNearby fed by the current useCurrentPosition coords', async () => {
    const { findByText } = await renderScreen();
    expect(await findByText('High Confidence Cafe')).toBeTruthy();
    expect(await findByText('Medium Confidence Library')).toBeTruthy();
    // The coords passed to useNearby are the live ones from useCurrentPosition.
    expect(mockUseNearby).toHaveBeenCalledWith(
      COORDS.userLat,
      COORDS.userLng,
      expect.any(Object),
    );
  });

  it('gives every row a button role, a summarizing label, and an "Opens location details" hint', async () => {
    const { findByLabelText } = await renderScreen();
    const row = await findByLabelText(/High Confidence Cafe.*High confidence/);
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityHint).toBe('Opens location details');
  });

  it('tapping a row opens the shared sheet with the row id AND the current user coords', async () => {
    const { findByLabelText } = await renderScreen();
    fireEvent.press(await findByLabelText(/High Confidence Cafe/));
    const lastProps = mockSheetSpy.mock.calls.at(-1)?.[0];
    expect(lastProps).toMatchObject({
      locationId: 'a',
      userLat: COORDS.userLat,
      userLng: COORDS.userLng,
    });
  });

  it('shows the truly-empty state with the locked ERR-06 copy when no rows and no active filters', async () => {
    mockUseNearby.mockResolvedValue([]);
    const { findByText } = await renderScreen();
    expect(
      await findByText("No bathrooms found nearby. Try 'Search this area' or adjust filters."),
    ).toBeTruthy();
  });

  it('shows the DISTINCT filtered-empty state when a filter is active and no rows', async () => {
    mockUseNearby.mockResolvedValue([]);
    mockFilters = emptyFilters({ wheelchair: true });
    const { findByText } = await renderScreen();
    expect(await findByText('No bathrooms match your filters')).toBeTruthy();
  });

  it('tapping "Clear filters" in the filtered-empty state calls the store clearAll', async () => {
    mockUseNearby.mockResolvedValue([]);
    const clearAll = jest.fn();
    mockFilters = emptyFilters({ wheelchair: true, clearAll });
    const { findByText } = await renderScreen();
    fireEvent.press(await findByText('Clear filters'));
    expect(clearAll).toHaveBeenCalledTimes(1);
  });

  it('shows an error banner with Retry when the nearby fetch fails (D-28)', async () => {
    mockUseNearby.mockRejectedValue(new Error('rpc failed'));
    const { findByText } = await renderScreen();
    expect(await findByText('Retry')).toBeTruthy();
  });

  it('forwards null coords into the sheet and is not a dead end when GPS is denied', async () => {
    mockUseCurrentPosition.mockReturnValue({ coords: null, status: 'denied', isStale: false });
    const { findByText } = await renderScreen();
    expect(await findByText('Location needed')).toBeTruthy();
    const lastProps = mockSheetSpy.mock.calls.at(-1)?.[0];
    expect(lastProps).toMatchObject({ userLat: null, userLng: null });
    // Without coords, useNearby is never invoked (nothing to sort by).
    expect(mockUseNearby).not.toHaveBeenCalled();
  });
});
