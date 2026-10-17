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

// The unseen-publication hook is real; only its transport is mocked, so the test covers
// the Map screen's wiring down to the RPC names.
const mockRpc = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  PUBLICATIONS_IDLE_POLL_MS,
  PUBLICATIONS_POLL_MS,
} from '../../../features/submit/useMySubmissionPublications';
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

  it('shows a published submission to its owner from the unseen-publication query, though the pending query no longer returns it, and acknowledges it once seen', async () => {
    const PUBLICATION_ROW = {
      submission_id: 'sub-published',
      location_id: 'loc-new',
      name: 'Trailhead Port-a-Potty',
      published_at: '2026-10-11T12:00:00Z',
    };
    let acknowledged = false;
    mockRpc.mockImplementation((name: string) => {
      if (name === 'acknowledge_submission_publication') acknowledged = true;
      return Promise.resolve(
        name === 'get_my_unseen_submission_publications'
          ? { data: acknowledged ? [] : [PUBLICATION_ROW], error: null }
          : { data: null, error: null },
      );
    });
    mockSessionValue = { session: { user: { id: 'user-a' } } };
    // Publication removed the row from the pending-only query.
    mockUseMyPendingSubmissions.mockResolvedValue(EMPTY_FC);

    await renderScreen();

    await waitFor(() => {
      expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({
        submission: null,
        publication: {
          submissionId: 'sub-published',
          locationId: 'loc-new',
          name: 'Trailhead Port-a-Potty',
          publishedAt: '2026-10-11T12:00:00Z',
        },
      });
    });

    // The owner taps Done.
    await act(async () => {
      mockPendingSheetSpy.mock.calls.at(-1)?.[0].onPublicationSeen('sub-published');
    });

    expect(mockRpc).toHaveBeenCalledWith('acknowledge_submission_publication', {
      p_submission_id: 'sub-published',
    });
    await waitFor(() => {
      expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({ publication: null });
    });
  });

  it('finds a publication made while the Map stays open, then refreshes the pending pins once it is seen', async () => {
    // The creator's first look finds nothing; another user's verification publishes the
    // submission a minute later. Nothing in this session invalidates the query, so only
    // the Map's own refresh can surface "Published!" when push never arrives (D-68).
    jest.useFakeTimers();
    try {
      const PENDING_FC = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-123.09, 44.05] },
            properties: { id: 'sub-published', name: 'Trailhead Port-a-Potty', confirmation_count: 1 },
          },
        ],
      };
      let published = false;
      let acknowledged = false;
      mockRpc.mockImplementation((name: string) => {
        if (name === 'acknowledge_submission_publication') acknowledged = true;
        const row = { submission_id: 'sub-published', location_id: 'loc-new', name: 'Trailhead Port-a-Potty', published_at: '2026-10-11T12:00:00Z' };
        return Promise.resolve(
          name === 'get_my_unseen_submission_publications'
            ? { data: published && !acknowledged ? [row] : [], error: null }
            : { data: null, error: null },
        );
      });
      mockSessionValue = { session: { user: { id: 'user-a' } } };
      mockUseMyPendingSubmissions.mockResolvedValue(PENDING_FC);

      await renderScreen();
      await waitFor(() =>
        expect(mockRpc.mock.calls.filter(([name]) => name === 'get_my_unseen_submission_publications')).toHaveLength(1),
      );
      expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({ publication: null });

      // Published elsewhere; the Map stays open past one refresh interval.
      published = true;
      await act(async () => {
        jest.advanceTimersByTime(PUBLICATIONS_POLL_MS);
      });
      await waitFor(() => {
        expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({
          publication: { submissionId: 'sub-published' },
        });
      });

      // Once seen, the pending pins are refetched so the published one drops off.
      const pendingFetchesBefore = mockUseMyPendingSubmissions.mock.calls.length;
      mockUseMyPendingSubmissions.mockResolvedValue(EMPTY_FC);
      await act(async () => {
        mockPendingSheetSpy.mock.calls.at(-1)?.[0].onPublicationSeen('sub-published');
      });
      await waitFor(() => expect(mockUseMyPendingSubmissions.mock.calls.length).toBeGreaterThan(pendingFetchesBefore));
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps checking for publications when the pending list failed to load', async () => {
    // A failed pending fetch says nothing about whether the user has pending
    // submissions, so it must not switch off the only in-session publication refresh.
    jest.useFakeTimers();
    try {
      let published = false;
      mockRpc.mockImplementation((name: string) => {
        const row = { submission_id: 'sub-published', location_id: 'loc-new', name: 'Trailhead Port-a-Potty', published_at: '2026-10-11T12:00:00Z' };
        return Promise.resolve(
          name === 'get_my_unseen_submission_publications'
            ? { data: published ? [row] : [], error: null }
            : { data: null, error: null },
        );
      });
      mockSessionValue = { session: { user: { id: 'user-a' } } };
      mockUseMyPendingSubmissions.mockRejectedValue(new Error('offline'));

      await renderScreen();
      await waitFor(() =>
        expect(mockRpc.mock.calls.filter(([name]) => name === 'get_my_unseen_submission_publications')).toHaveLength(1),
      );

      published = true;
      await act(async () => {
        jest.advanceTimersByTime(PUBLICATIONS_POLL_MS);
      });
      await waitFor(() => {
        expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({
          publication: { submissionId: 'sub-published' },
        });
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a dismissed publication closed for the session when acknowledging it fails, even as polling continues', async () => {
    // The server keeps a failed acknowledgement unseen, so every poll returns the same
    // publication. Re-opening "Published!" on the Map every minute would interrupt the
    // emergency read surface; once dismissed it stays dismissed until the next session.
    jest.useFakeTimers();
    try {
      const PENDING_FC = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-123.09, 44.05] },
            properties: { id: 'sub-other', name: 'Other pending', confirmation_count: 1 },
          },
        ],
      };
      mockRpc.mockImplementation((name: string) =>
        Promise.resolve(
          name === 'get_my_unseen_submission_publications'
            ? {
                data: [{ submission_id: 'sub-published', location_id: 'loc-new', name: 'Trailhead', published_at: '2026-10-11T12:00:00Z' }],
                error: null,
              }
            : { data: null, error: { message: 'offline' } },
        ),
      );
      mockSessionValue = { session: { user: { id: 'user-a' } } };
      mockUseMyPendingSubmissions.mockResolvedValue(PENDING_FC);

      await renderScreen();
      await waitFor(() => {
        expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0].publication).not.toBeNull();
      });
      await act(async () => {
        mockPendingSheetSpy.mock.calls.at(-1)?.[0].onDismiss();
      });

      // Two more poll intervals, one at a time (each next timer is scheduled after the
      // previous fetch settles): the server still reports it unseen each time.
      for (let i = 0; i < 2; i++) {
        await act(async () => {
          jest.advanceTimersByTime(PUBLICATIONS_POLL_MS);
        });
      }
      await waitFor(() =>
        expect(mockRpc.mock.calls.filter(([name]) => name === 'get_my_unseen_submission_publications').length).toBeGreaterThanOrEqual(3),
      );
      expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({ publication: null });
    } finally {
      jest.useRealTimers();
    }
  });

  it('after an empty pending list, still checks for publications on a slower interval', async () => {
    // Empty now is not empty forever: the user can submit from another device while this
    // Map stays open, and that submission can be published by others. A slower check
    // keeps a way for "Published!" to arrive without polling every minute for nothing.
    jest.useFakeTimers();
    try {
      let published = false;
      mockRpc.mockImplementation((name: string) => {
        const row = { submission_id: 'sub-elsewhere', location_id: 'loc-new', name: 'Library Restroom', published_at: '2026-10-11T12:00:00Z' };
        return Promise.resolve(
          name === 'get_my_unseen_submission_publications'
            ? { data: published ? [row] : [], error: null }
            : { data: null, error: null },
        );
      });
      mockSessionValue = { session: { user: { id: 'user-a' } } };
      mockUseMyPendingSubmissions.mockResolvedValue(EMPTY_FC);

      await renderScreen();
      const publicationCalls = () =>
        mockRpc.mock.calls.filter(([name]) => name === 'get_my_unseen_submission_publications').length;
      await waitFor(() => expect(publicationCalls()).toBe(1));

      // Not every minute while nothing is pending...
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.advanceTimersByTime(PUBLICATIONS_POLL_MS);
        });
      }
      expect(publicationCalls()).toBe(1);

      // ...but within the idle interval a publication made elsewhere is found.
      published = true;
      await act(async () => {
        jest.advanceTimersByTime(PUBLICATIONS_IDLE_POLL_MS - PUBLICATIONS_POLL_MS * 3);
      });
      await waitFor(() => {
        expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({
          publication: { submissionId: 'sub-elsewhere' },
        });
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('asks for unseen publications only when signed in (guard)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await renderScreen();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({ publication: null });
  });

  it('closes the Published state at once even if the acknowledgement fails, and does not ask again in a loop (guard)', async () => {
    mockRpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'get_my_unseen_submission_publications'
          ? {
              data: [{ submission_id: 'sub-published', location_id: 'loc-new', name: 'Trailhead', published_at: '2026-10-11T12:00:00Z' }],
              error: null,
            }
          : { data: null, error: { message: 'offline' } },
      ),
    );
    mockSessionValue = { session: { user: { id: 'user-a' } } };
    await renderScreen();
    await waitFor(() => {
      expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0].publication).not.toBeNull();
    });

    // Swiping the sheet away counts as seen, the same as Done.
    await act(async () => {
      mockPendingSheetSpy.mock.calls.at(-1)?.[0].onDismiss();
    });

    expect(mockPendingSheetSpy.mock.calls.at(-1)?.[0]).toMatchObject({ publication: null });
    expect(mockRpc.mock.calls.filter(([name]) => name === 'get_my_unseen_submission_publications')).toHaveLength(1);
    expect(mockRpc.mock.calls.filter(([name]) => name === 'acknowledge_submission_publication')).toHaveLength(1);
  });
});
