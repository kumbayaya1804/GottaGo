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
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Controllable viewport hook.
const mockUseMapViewport = jest.fn();
jest.mock('../../../features/locations/useMapViewport', () => ({
  useMapViewport: () => mockUseMapViewport(),
  PIN_ZOOM_CUTOFF: 11,
  VIEWPORT_DEBOUNCE_MS: 400,
}));

// --- Controllable live-coordinate source.
const mockUseCurrentPosition = jest.fn();
jest.mock('../../../features/locations/useCurrentPosition', () => ({
  useCurrentPosition: () => mockUseCurrentPosition(),
  POSITION_FRESHNESS_MS: 60000,
}));

// --- Controllable bbox fetch.
const mockUseLocationsBbox = jest.fn();
jest.mock('../../../features/locations/useLocationsBbox', () => ({
  useLocationsBbox: (...args: unknown[]) => mockUseLocationsBbox(...args),
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

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MapScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseMapViewport.mockReturnValue(baseViewport());
  mockUseCurrentPosition.mockReturnValue({
    coords: { userLat: 44.05, userLng: -123.09 },
    status: 'granted',
    isStale: false,
  });
  mockUseLocationsBbox.mockResolvedValue(EMPTY_FC);
});

describe('MapScreen', () => {
  it('mounts the Mapbox map tile', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('map-view')).toBeTruthy();
  });

  it('forwards the current useCurrentPosition coords into the detail sheet', () => {
    renderScreen();
    const lastProps = mockSheetSpy.mock.calls.at(-1)?.[0];
    expect(lastProps).toMatchObject({
      locationId: null,
      userLat: 44.05,
      userLng: -123.09,
    });
  });

  it('passes null coords into the sheet when no GPS fix is available', () => {
    mockUseCurrentPosition.mockReturnValue({ coords: null, status: 'denied', isStale: false });
    renderScreen();
    const lastProps = mockSheetSpy.mock.calls.at(-1)?.[0];
    expect(lastProps).toMatchObject({ userLat: null, userLng: null });
  });

  it('shows the zoom-out cutoff card instead of pins when belowPinThreshold (D-04)', () => {
    mockUseMapViewport.mockReturnValue(baseViewport({ belowPinThreshold: true }));
    const { getByText } = renderScreen();
    expect(getByText('Zoom in to see individual locations')).toBeTruthy();
  });

  it('shows an error banner with Retry when the bbox fetch fails, without crashing (D-28)', async () => {
    mockUseLocationsBbox.mockRejectedValue(new Error('rpc failed'));
    const { findByText } = renderScreen();
    expect(await findByText('Retry')).toBeTruthy();
  });
});
