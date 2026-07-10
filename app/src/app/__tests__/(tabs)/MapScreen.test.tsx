/**
 * Thin render + behavior tests for app/src/app/(tabs)/index.tsx (MapScreen).
 *
 * src/app/** is excluded from coverage collection — these tests exist for TDD
 * Guard compliance and behavioral verification only, not coverage metrics.
 * Native Mapbox rendering (clustering, user dot, animation) is device-verified
 * in the Task 3 checkpoint; here we lock the wiring logic:
 *  - the map tile mounts,
 *  - MapScreen forwards the current useCurrentPosition coords into the sheet,
 *  - the zoom-out cutoff card replaces pins (D-04),
 *  - the RPC-failure banner + Retry appears (D-28).
 */
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useFiltersStore, EMPTY_FILTERS } from '../../../features/filters/useFiltersStore';

const mockPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPosition = Location.getCurrentPositionAsync as jest.Mock;

// --- Controllable viewport hook.
const mockUseMapViewport = jest.fn();
jest.mock('../../../features/locations/useMapViewport', () => ({
  useMapViewport: () => mockUseMapViewport(),
  PIN_ZOOM_CUTOFF: 11,
  VIEWPORT_DEBOUNCE_MS: 400,
}));

// --- Controllable bbox fetch.
const mockUseLocationsBbox = jest.fn();
jest.mock('../../../features/locations/useLocationsBbox', () => ({
  fetchLocationsBbox: (...args: unknown[]) => mockUseLocationsBbox(...args),
}));

// --- Spy the sheet to assert the props MapScreen forwards into it.
const mockSheetSpy = jest.fn();
jest.mock('../../(components)/LocationDetailSheet', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockSheetSpy(props);
    return null;
  },
}));

// --- Spy the pending sheet too (it pulls in @gorhom/bottom-sheet; MapScreen only wires it).
const mockPendingSheetSpy = jest.fn();
jest.mock('../../(components)/PendingStatusSheet', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockPendingSheetSpy(props);
    return null;
  },
}));

// --- Controllable auth session (the pending layer is submitter-only, enabled: !!session).
let mockSessionValue: { session: { user: { id: string } } | null } | null;
jest.mock('../../../features/auth/useSession', () => ({
  useSession: () => mockSessionValue,
}));

// --- The authed-only pending-submissions fetch (separate source, server-scoped).
const mockUseMyPendingSubmissions = jest.fn();
jest.mock('../../../features/submit/useMyPendingSubmissions', () => ({
  fetchMyPendingSubmissions: (...args: unknown[]) => mockUseMyPendingSubmissions(...args),
}));

import MapScreen from '../../(tabs)/index';

const VIEWPORT = { minLng: -123.1, minLat: 44.04, maxLng: -123.08, maxLat: 44.06 };
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

function baseViewport(overrides: Record<string, unknown> = {}) {
  return {
    viewport: VIEWPORT,
    zoom: 14,
    belowPinThreshold: false,
    onRegionChange: jest.fn(),
    ...overrides,
  };
}

// Awaits the initial bbox/pending-submissions microtask flush inside act() so the
// resulting MapScreen state update is never reported as outside a test's act(...)
// (the same pattern submit.test.tsx's renderWizard() uses).
async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={client}>
      <MapScreen />
    </QueryClientProvider>,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMapViewport.mockReturnValue(baseViewport());
  mockPermission.mockResolvedValue({ status: 'granted' });
  mockPosition.mockResolvedValue({
    coords: { latitude: 44.05, longitude: -123.09 },
    timestamp: Date.now(),
  });
  mockUseLocationsBbox.mockResolvedValue(EMPTY_FC);
  // Default: signed out — the pending layer must stay dark for anon (T-04-20).
  mockSessionValue = null;
  mockUseMyPendingSubmissions.mockResolvedValue(EMPTY_FC);
  useFiltersStore.setState({ ...EMPTY_FILTERS });
});

describe('MapScreen', () => {
  it('mounts the Mapbox map tile', async () => {
    const { getByTestId } = await renderScreen();
    expect(getByTestId('map-view')).toBeTruthy();
  });

  it('forwards the current useCurrentPosition coords into the detail sheet', async () => {
    await renderScreen();
    await waitFor(() => {
      const lastProps = mockSheetSpy.mock.calls.at(-1)?.[0];
      expect(lastProps).toMatchObject({
        locationId: null,
        userLat: 44.05,
        userLng: -123.09,
      });
    });
  });

  it('passes null coords into the sheet when no GPS fix is available', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });
    const { findByText } = await renderScreen();
    expect(
      await findByText("We can't find your location. Use search to browse bathrooms near an address."),
    ).toBeTruthy();
    const lastProps = mockSheetSpy.mock.calls.at(-1)?.[0];
    expect(lastProps).toMatchObject({ userLat: null, userLng: null });
  });

  it('shows the zoom-out cutoff card instead of pins when belowPinThreshold (D-04)', async () => {
    mockUseMapViewport.mockReturnValue(baseViewport({ belowPinThreshold: true }));
    const { getByText } = await renderScreen();
    expect(getByText('Zoom in to see individual locations')).toBeTruthy();
  });

  it('shows an error banner with Retry when the bbox fetch fails, without crashing (D-28)', async () => {
    mockUseLocationsBbox.mockRejectedValue(new Error('rpc failed'));
    const { findByText } = await renderScreen();
    expect(await findByText('Retry')).toBeTruthy();
  });

  it('renders the filter chip row when GPS permission is granted', async () => {
    const { getByLabelText } = await renderScreen();
    expect(getByLabelText('Chill Spot')).toBeTruthy();
  });

  it('toggling a filter chip re-queries the bbox RPC with the active filter (D-07)', async () => {
    const { getByLabelText } = await renderScreen();
    fireEvent.press(getByLabelText('Chill Spot'));
    await waitFor(() => {
      const lastCall = mockUseLocationsBbox.mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({ filter_chill_spot: true });
    });
  });

  it('hides the filter chip row and shows the ERR-01 manual-search fallback when GPS is denied, with no dead end (D-34)', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });
    const { queryByLabelText, findByText } = await renderScreen();
    expect(
      await findByText("We can't find your location. Use search to browse bathrooms near an address."),
    ).toBeTruthy();
    expect(queryByLabelText('Chill Spot')).toBeNull();
    expect(await findByText('Search this area')).toBeTruthy();
  });

  it('uses the real position hook to recover from provider rejection with retry and manual map browsing', async () => {
    mockPermission.mockRejectedValue(new Error('permission provider unavailable'));

    const { findByText, getByLabelText, queryByText } = await renderScreen();

    expect(
      await findByText("We couldn't get your location. Retry or search the visible map area."),
    ).toBeTruthy();
    fireEvent.press(getByLabelText('Retry getting location'));
    await waitFor(() => expect(mockPermission).toHaveBeenCalledTimes(2));

    mockUseLocationsBbox.mockClear();
    fireEvent.press(getByLabelText('Search this area'));
    await waitFor(() => expect(mockUseLocationsBbox).toHaveBeenCalled());
    expect(await findByText('No bathrooms found nearby')).toBeTruthy();
    expect(queryByText("We couldn't get your location. Retry or search the visible map area.")).toBeNull();
  });

  it('shows the truly-empty state with Search this area when no filters are active and results are empty (D-10)', async () => {
    const { findByText, queryByText } = await renderScreen();
    expect(await findByText('No bathrooms found nearby')).toBeTruthy();
    expect(await findByText('Search this area')).toBeTruthy();
    expect(queryByText('Clear filters')).toBeNull();
  });

  it('shows the distinct filtered-empty state with Clear filters when a filter is active and results are empty (D-10)', async () => {
    useFiltersStore.setState({ ...EMPTY_FILTERS, chillSpot: true });
    const { findByText } = await renderScreen();
    expect(await findByText('No bathrooms match your filters')).toBeTruthy();
    expect(await findByText('Clear filters')).toBeTruthy();
  });

  it('"Search this area" re-runs the bbox query for the current viewport (D-09)', async () => {
    const { findByText } = await renderScreen();
    const button = await findByText('Search this area');
    mockUseLocationsBbox.mockClear();
    fireEvent.press(button);
    await waitFor(() => expect(mockUseLocationsBbox).toHaveBeenCalled());
  });

  it('"Clear filters" resets the filters store', async () => {
    useFiltersStore.setState({ ...EMPTY_FILTERS, chillSpot: true });
    const { findByText } = await renderScreen();
    const button = await findByText('Clear filters');
    fireEvent.press(button);
    expect(useFiltersStore.getState().chillSpot).toBe(false);
  });

  it('does NOT fetch pending submissions when signed out (enabled: !!session, T-04-20)', async () => {
    mockSessionValue = null;
    await renderScreen();
    // Give any (incorrectly) enabled query a tick to fire.
    await waitFor(() => expect(mockSheetSpy).toHaveBeenCalled());
    expect(mockUseMyPendingSubmissions).not.toHaveBeenCalled();
  });

  it('fetches the submitter-only pending submissions when signed in', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    await renderScreen();
    await waitFor(() => expect(mockUseMyPendingSubmissions).toHaveBeenCalled());
  });

  it('mounts the PendingStatusSheet with no submission selected initially', async () => {
    mockSessionValue = { session: { user: { id: 'user-1' } } };
    await renderScreen();
    const lastProps = mockPendingSheetSpy.mock.calls.at(-1)?.[0];
    expect(lastProps).toMatchObject({ submission: null });
  });
});
