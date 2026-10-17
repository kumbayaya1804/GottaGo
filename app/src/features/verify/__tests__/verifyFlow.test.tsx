/**
 * Screen tests for the Verify modal, app/src/app/(modals)/verify.tsx (plan 05-03 Task 2).
 *
 * Contract under test (05-UI-SPEC.md, design-system §15 ERR-09):
 *  - One route, two modes: a list of nearby pending bathrooms, then GPS verification of
 *    the one the user picks. Selecting never navigates.
 *  - "I'm Here" is an advisory client gate: accuracy <= 50 m and distance <= 100 m.
 *  - Once the server is asked, every refusal and every thrown error shows the same
 *    sentence. Nothing on screen tells a mock-location refusal from any other (SC7).
 *  - No state is a dead end: denied permission, a failed GPS read, a failed list load and
 *    a refusal each offer a way forward, and Cancel is always there.
 *
 * The GPS, the server call and the router are mocked. These tests prove the screen's
 * decisions, not that a real device fix or a real verify_location call behaves this way.
 */
import React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';

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

let mockUserId: string | undefined;
jest.mock('../../auth/useSession', () => ({
  useSession: () => ({
    session: mockUserId ? { user: { id: mockUserId } } : null,
    loading: false,
  }),
}));

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => {
  const RealReact = require('react');
  const { View, Text } = require('react-native');
  return {
    useRouter: () => mockRouter,
    // Renders the native header's title and right-hand button inline so tests can
    // read and press them.
    Stack: {
      Screen: ({ options }: { options?: { title?: string; headerRight?: () => unknown } }) =>
        RealReact.createElement(
          View,
          null,
          RealReact.createElement(Text, null, options?.title),
          options?.headerRight ? options.headerRight() : null,
        ),
    },
  };
});

const mockOpenSettings = jest.fn();
jest.mock('expo-linking', () => ({
  openSettings: (...args: unknown[]) => mockOpenSettings(...args),
}));

// Locale-independent distance text for list rows.
jest.mock('../../locations/formatDistance', () => ({
  formatDistance: (meters: number) => `FMT:${meters}`,
  usesMilesForLocale: () => true,
}));

import VerifyScreen from '../../../app/(modals)/verify';
import { forgetPostAuthReturn, takePostAuthReturn } from '../../auth/redirect';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as { rpc: jest.Mock };
// expo-location is mocked in jest.setup.ts.
const mockPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockPos = Location.getCurrentPositionAsync as jest.Mock;

// The user stands here; CAFE is about 14 m away, PARK about 240 m away.
const HERE = { lat: 40.7128, lng: -74.006 };
const CAFE = { id: 'sub-cafe', name: 'Riverside Cafe', lat: 40.71292, lng: -74.00605, policy_tag: 'customers_only', distance_m: 14 };
const PARK = { id: 'sub-park', name: 'Park Pavilion', lat: 40.71496, lng: -74.006, policy_tag: 'public', distance_m: 240 };

function fix(overrides: { accuracy?: number | null; timestamp?: number; mocked?: boolean } = {}) {
  return {
    coords: { latitude: HERE.lat, longitude: HERE.lng, accuracy: 'accuracy' in overrides ? overrides.accuracy : 12 },
    timestamp: overrides.timestamp ?? Date.now(),
    ...(overrides.mocked === undefined ? {} : { mocked: overrides.mocked }),
  };
}

type RpcReply = { data: unknown; error: unknown } | Error;
function serveRpc(replies: { candidates?: RpcReply; verify?: RpcReply }) {
  mockSupabase.rpc.mockImplementation((name: string) => {
    const reply =
      name === 'search_pending_submissions_nearby'
        ? (replies.candidates ?? { data: [], error: null })
        : (replies.verify ?? { data: { accepted: true }, error: null });
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  });
}

// Models search_pending_submissions_nearby's D-36 cooldown instead of always returning
// rows: every call claims the cooldown first (even one whose response is then lost), and
// a call made within 3 s of the previous one gets zero rows. `failFirst` loses the first
// response after the server has already recorded the claim.
const SERVER_COOLDOWN_MS = 3_000;
function serveWithCooldown(rows: unknown[], options: { failFirst?: boolean } = {}) {
  let lastClaim = -Infinity;
  let calls = 0;
  mockSupabase.rpc.mockImplementation((name: string) => {
    if (name !== 'search_pending_submissions_nearby') {
      return Promise.resolve({ data: { accepted: true }, error: null });
    }
    calls += 1;
    const now = Date.now();
    const insideCooldown = now - lastClaim < SERVER_COOLDOWN_MS;
    lastClaim = now;
    if (options.failFirst && calls === 1) return Promise.reject(new Error('response lost'));
    return Promise.resolve({ data: insideCooldown ? [] : rows, error: null });
  });
}

/** True when the element, or a view around it, is an Android live region. */
function inLiveRegion(element: { props: Record<string, unknown>; parent: unknown } | null): boolean {
  for (let node = element; node; node = node.parent as typeof element) {
    if (node.props.accessibilityLiveRegion === 'polite' || node.props.accessibilityLiveRegion === 'assertive') {
      return true;
    }
  }
  return false;
}

function discoveryCalls() {
  return mockSupabase.rpc.mock.calls.filter(([name]) => name === 'search_pending_submissions_nearby');
}
function verifyCalls() {
  return mockSupabase.rpc.mock.calls.filter(([name]) => name === 'verify_location');
}

function makeClient() {
  // gcTime Infinity: no garbage-collection timer is left running to keep jest alive.
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
}

function renderScreen(client: QueryClient = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <VerifyScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'user-a';
  mockPerm.mockResolvedValue({ status: 'granted' });
  mockPos.mockResolvedValue(fix());
  serveRpc({ candidates: { data: [CAFE, PARK], error: null } });
});

// Output must stay pristine: a state update outside act() means the test asserted on a
// screen that was still changing. Collected across the file because the warning can
// arrive on a timer after the test that caused it.
const actWarnings: string[] = [];
let consoleError: jest.SpyInstance;
beforeAll(() => {
  const realError = console.error;
  consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes('not wrapped in act')) actWarnings.push(String(args[0]).split('\n')[0]);
    else realError(...args);
  });
});
afterAll(() => {
  consoleError.mockRestore();
});

describe('Verify modal: sign-in gate', () => {
  it('asks a signed-out user to sign in and reads neither GPS nor the server', async () => {
    mockUserId = undefined;
    renderScreen();

    expect(screen.getByText('Sign in to verify')).toBeTruthy();
    await act(async () => {});
    expect(mockPerm).not.toHaveBeenCalled();
    expect(mockSupabase.rpc).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Cancel — dismiss sign-in prompt'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });
});

describe('Verify modal: resuming after sign-in (ERR-10)', () => {
  afterEach(() => forgetPostAuthReturn());

  it.each([
    ['Sign In', '/(auth)/sign-in'],
    ['Create Account', '/(auth)/sign-up'],
  ])('remembers to come back to Verify when the user chooses %s', (label, route) => {
    mockUserId = undefined;
    renderScreen();

    fireEvent.press(screen.getByLabelText(label));

    expect(mockRouter.push).toHaveBeenCalledWith(route);
    expect(takePostAuthReturn()).toBe('/verify');
  });
});

describe('Verify modal: nearby list', () => {
  it('lists nearby pending bathrooms in the server’s order, found from one GPS fix', async () => {
    renderScreen();

    expect(await screen.findByText('Riverside Cafe')).toBeTruthy();
    expect(screen.getByText('Verify Location')).toBeTruthy();
    expect(screen.getByText('Verify a bathroom nearby')).toBeTruthy();
    expect(screen.getAllByText(/Riverside Cafe|Park Pavilion/).map((n) => n.props.children)).toEqual([
      'Riverside Cafe',
      'Park Pavilion',
    ]);
    expect(discoveryCalls()).toEqual([
      ['search_pending_submissions_nearby', { user_lat: HERE.lat, user_lng: HERE.lng }],
    ]);

    const row = screen.getByLabelText('Riverside Cafe. FMT:14. Pending verification.');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row.props.accessibilityHint).toBe('Checks your location against this bathroom');
  });

  it('shows the locked empty state when the server finds nothing to verify', async () => {
    serveRpc({ candidates: { data: [], error: null } });
    renderScreen();

    expect(await screen.findByText('Nothing to verify nearby')).toBeTruthy();
    expect(
      screen.getByText(
        "There are no pending bathrooms within walking distance right now. When you're near a newly submitted spot, it'll show up here to verify.",
      ),
    ).toBeTruthy();
  });

  it('shows a retry state, not the empty state, when the list cannot be loaded', async () => {
    serveRpc({ candidates: new Error('network down') });
    renderScreen();

    expect(await screen.findByText("Couldn't load bathrooms to verify.")).toBeTruthy();
    expect(screen.queryByText('Nothing to verify nearby')).toBeNull();
  });

  it('waits out the server cooldown before retrying, so a retry cannot come back falsely empty', async () => {
    // The failed call may have reached the server and claimed the cooldown before its
    // response was lost; an immediate retry would land inside it and get zero rows.
    jest.useFakeTimers();
    try {
      serveWithCooldown([CAFE, PARK], { failFirst: true });
      renderScreen();
      expect(await screen.findByText("Couldn't load bathrooms to verify.")).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Retry loading bathrooms to verify'));
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });

      expect(await screen.findByText('Riverside Cafe')).toBeTruthy();
      expect(screen.queryByText('Nothing to verify nearby')).toBeNull();
      expect(discoveryCalls()).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reopening right after a failed load keeps the retry state instead of calling again inside the cooldown', async () => {
    // Closing and reopening must not bypass the Retry wait: a mount-time retry would land
    // inside the cooldown the failed call already claimed and come back falsely empty.
    jest.useFakeTimers();
    try {
      serveWithCooldown([CAFE, PARK], { failFirst: true });
      const client = makeClient();
      const first = renderScreen(client);
      expect(await screen.findByText("Couldn't load bathrooms to verify.")).toBeTruthy();
      first.unmount();

      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      renderScreen(client);

      expect(await screen.findByText("Couldn't load bathrooms to verify.")).toBeTruthy();
      expect(screen.queryByText('Nothing to verify nearby')).toBeNull();
      expect(discoveryCalls()).toHaveLength(1);

      // Retry still works, after waiting out the cooldown.
      fireEvent.press(screen.getByLabelText('Retry loading bathrooms to verify'));
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      expect(await screen.findByText('Riverside Cafe')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers settings and a re-check when location permission is off, and asks the server nothing', async () => {
    mockPerm.mockResolvedValue({ status: 'denied' });
    renderScreen();

    expect(
      await screen.findByText("Location access is off. Turn on location so we can confirm you're here."),
    ).toBeTruthy();
    expect(discoveryCalls()).toEqual([]);

    fireEvent.press(screen.getByLabelText('Open location settings'));
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);

    // Back from settings with permission granted: Try Again re-reads GPS and loads the list.
    mockPerm.mockResolvedValue({ status: 'granted' });
    fireEvent.press(screen.getByLabelText('Try Again'));
    expect(await screen.findByText('Riverside Cafe')).toBeTruthy();
  });

  it('offers Try Again when the GPS read itself fails', async () => {
    mockPos.mockRejectedValueOnce(new Error('location services off'));
    renderScreen();

    expect(
      await screen.findByText("We couldn't get your location. Check your connection and try again."),
    ).toBeTruthy();
    expect(discoveryCalls()).toEqual([]);

    fireEvent.press(screen.getByLabelText('Try Again'));
    expect(await screen.findByText('Riverside Cafe')).toBeTruthy();
    expect(
      screen.queryByText("We couldn't get your location. Check your connection and try again."),
    ).toBeNull();
  });

  it('closes from the header Cancel button (guard)', async () => {
    renderScreen();
    await screen.findByText('Riverside Cafe');

    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('reuses the fix and the list when the modal is reopened straight away (guard)', async () => {
    // A second discovery call inside the server cooldown would come back empty and show
    // a false "Nothing to verify nearby".
    const client = makeClient();
    const first = renderScreen(client);
    await screen.findByText('Riverside Cafe');
    first.unmount();

    renderScreen(client);
    expect(await screen.findByText('Riverside Cafe')).toBeTruthy();
    await act(async () => {});
    expect(discoveryCalls()).toHaveLength(1);
    expect(mockPos).toHaveBeenCalledTimes(1);
  });

  it('shows progress while it finds the user and loads the list, instead of a bare heading', async () => {
    let releaseFix: (value: unknown) => void = () => {};
    mockPos.mockReturnValueOnce(new Promise((resolve) => (releaseFix = resolve)));
    renderScreen();

    expect(await screen.findByText('Finding bathrooms near you…')).toBeTruthy();
    expect(screen.queryByText('Nothing to verify nearby')).toBeNull();

    await act(async () => {
      releaseFix(fix());
    });
    expect(await screen.findByText('Riverside Cafe')).toBeTruthy();
    expect(screen.queryByText('Finding bathrooms near you…')).toBeNull();
  });
});

describe('Verify modal: checking one bathroom', () => {
  async function openCafe(client?: QueryClient) {
    renderScreen(client);
    fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
  }

  it('switches to the GPS check for the chosen bathroom, on a fresh fix, without navigating', async () => {
    await openCafe();

    expect(await screen.findByText('Accuracy: 12m')).toBeTruthy();
    expect(screen.getByText('You are 14m away')).toBeTruthy();
    // Icons are decoration beside the words: present, and hidden from screen readers.
    expect(screen.queryByTestId('icon-checkmark-circle')).toBeNull();
    expect(screen.getByTestId('icon-checkmark-circle', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Riverside Cafe')).toBeTruthy();
    // The list is gone: same route, different mode.
    expect(screen.queryByText('Verify a bathroom nearby')).toBeNull();
    expect(screen.queryByText('Park Pavilion')).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();

    expect(screen.getByLabelText("I'm Here")).toBeEnabled();
    // One fix placed the list; the check reads its own.
    expect(mockPos).toHaveBeenCalledTimes(2);
    expect(verifyCalls()).toEqual([]);
  });

  it.each([
    ['accuracy is worse than 50 m', { accuracy: 88 }, 'Riverside Cafe. FMT:14. Pending verification.', 'GPS accuracy too low — move to an open area and try again.'],
    ['the reading carries no accuracy', { accuracy: null }, 'Riverside Cafe. FMT:14. Pending verification.', 'GPS accuracy too low — move to an open area and try again.'],
    ['the bathroom is more than 100 m away', {}, 'Park Pavilion. FMT:240. Pending verification.', "You're too far away — need to be within 100m"],
  ])('keeps "I\'m Here" disabled, says why, and lets the user check again when %s', async (_name, fixOverrides, rowLabel, guidance) => {
    mockPos.mockResolvedValue(fix(fixOverrides));
    renderScreen();
    fireEvent.press(await screen.findByLabelText(rowLabel));

    expect(await screen.findByText(guidance)).toBeTruthy();
    expect(screen.getAllByTestId('icon-warning-outline', { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("I'm Here")).toBeDisabled();
    expect(verifyCalls()).toEqual([]);

    // Advisory only: the user can move and read GPS again, with no server call.
    fireEvent.press(screen.getByLabelText('Try Again'));
    await waitFor(() => expect(mockPos).toHaveBeenCalledTimes(3));
    expect(verifyCalls()).toEqual([]);
  });

  it('sends the fresh reading when "I\'m Here" is pressed, shows the success state, and closes on Done', async () => {
    const client = makeClient();
    client.setQueryData(['profileStats', 'user-a'], { verified: 0 });
    await openCafe(client);
    await screen.findByText('Accuracy: 12m');

    fireEvent.press(screen.getByLabelText("I'm Here"));

    expect(await screen.findByText('Verified!')).toBeTruthy();
    expect(screen.getByText('Thanks for keeping data fresh.')).toBeTruthy();
    expect(screen.queryByLabelText("I'm Here")).toBeNull();
    expect(verifyCalls()).toEqual([
      [
        'verify_location',
        {
          p_submission_id: 'sub-cafe',
          p_lat: HERE.lat,
          p_lng: HERE.lng,
          p_accuracy_m: 12,
          p_mocked: false,
          p_captured_at: expect.any(String),
        },
      ],
    ]);
    // The screen uses the shared verify action, which marks this account's caches stale.
    expect(client.getQueryState(['profileStats', 'user-a'])?.isInvalidated).toBe(true);

    fireEvent.press(screen.getByLabelText('Done'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('shows one identical screen for a refusal, a refusal carrying a reason, a server error and a network failure', async () => {
    // SC7: nothing on screen may tell these apart, or tell a mock-location refusal from
    // any other. The whole rendered tree is compared, not just the sentence.
    const outcomes: RpcReply[] = [
      { data: { accepted: false }, error: null },
      { data: { accepted: false, reason: 'mock_location_detected' }, error: null },
      { data: null, error: { message: 'verification cooldown active', code: 'P0001' } },
      new Error('Network request failed'),
    ];
    const trees: string[] = [];
    for (const verify of outcomes) {
      serveRpc({ candidates: { data: [CAFE, PARK], error: null }, verify });
      const view = renderScreen();
      fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
      await screen.findByText('Accuracy: 12m');
      fireEvent.press(screen.getByLabelText("I'm Here"));

      expect(await screen.findByText('Unable to verify your location. Please try again.')).toBeTruthy();
      expect(screen.getByTestId('icon-alert-circle', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByLabelText("I'm Here")).toBeDisabled();
      expect(screen.queryByText('Verified!')).toBeNull();
      trees.push(JSON.stringify(view.toJSON()));
      view.unmount();
    }
    expect(new Set(trees).size).toBe(1);
    expect(trees[0]).not.toMatch(/mock|cooldown|Network/i);
  });

  it('recovers from a refusal: Try Again reads GPS afresh and the user can confirm again', async () => {
    serveRpc({ candidates: { data: [CAFE], error: null }, verify: { data: { accepted: false }, error: null } });
    await openCafe();
    await screen.findByText('Accuracy: 12m');
    fireEvent.press(screen.getByLabelText("I'm Here"));
    await screen.findByText('Unable to verify your location. Please try again.');
    expect(mockPos).toHaveBeenCalledTimes(2);

    serveRpc({ candidates: { data: [CAFE], error: null }, verify: { data: { accepted: true }, error: null } });
    fireEvent.press(screen.getByLabelText('Try Again'));

    await waitFor(() => expect(mockPos).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByLabelText("I'm Here")).toBeEnabled());
    expect(screen.queryByText('Unable to verify your location. Please try again.')).toBeNull();
    // Re-reading is not re-sending: the second call waits for the user.
    expect(verifyCalls()).toHaveLength(1);

    fireEvent.press(screen.getByLabelText("I'm Here"));
    expect(await screen.findByText('Verified!')).toBeTruthy();
    expect(verifyCalls()).toHaveLength(2);
  });

  it('reads GPS again instead of sending a reading that has gone stale while the user waited', async () => {
    mockPos
      .mockResolvedValueOnce(fix()) // places the list
      .mockResolvedValueOnce(fix({ timestamp: Date.now() - 61_000 })); // the check's reading, now too old
    await openCafe();
    await screen.findByText('Accuracy: 12m');

    fireEvent.press(screen.getByLabelText("I'm Here"));

    await waitFor(() => expect(mockPos).toHaveBeenCalledTimes(3));
    expect(verifyCalls()).toEqual([]);
    expect(screen.queryByText('Unable to verify your location. Please try again.')).toBeNull();

    // The fresh reading is sendable.
    await waitFor(() => expect(screen.getByLabelText("I'm Here")).toBeEnabled());
    fireEvent.press(screen.getByLabelText("I'm Here"));
    expect(await screen.findByText('Verified!')).toBeTruthy();
    expect(verifyCalls()).toHaveLength(1);
  });

  it.each([
    [
      'location permission is switched off before the check',
      () => mockPerm.mockResolvedValueOnce({ status: 'granted' }).mockResolvedValue({ status: 'denied' }),
      "Location access is off. Turn on location so we can confirm you're here.",
      true,
    ],
    [
      'the GPS read for the check fails',
      () => mockPos.mockResolvedValueOnce(fix()).mockRejectedValueOnce(new Error('location services off')),
      "We couldn't get your location. Check your connection and try again.",
      false,
    ],
  ])('is not a dead end when %s', async (_name, arrange, message, offersSettings) => {
    arrange();
    await openCafe();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText("I'm Here")).toBeDisabled();
    expect(screen.queryByLabelText('Open location settings') !== null).toBe(offersSettings);
    expect(verifyCalls()).toEqual([]);

    // Once the cause is fixed, Try Again gets a reading and the check can go ahead.
    mockPerm.mockResolvedValue({ status: 'granted' });
    mockPos.mockResolvedValue(fix());
    fireEvent.press(screen.getByLabelText('Try Again'));
    expect(await screen.findByText('Accuracy: 12m')).toBeTruthy();
    expect(screen.queryByText(message)).toBeNull();
    expect(screen.getByLabelText("I'm Here")).toBeEnabled();
  });

  it('goes back to the list without closing the modal or asking the server again', async () => {
    await openCafe();
    await screen.findByText('Accuracy: 12m');

    fireEvent.press(screen.getByLabelText('Back to list'));

    expect(await screen.findByText('Verify a bathroom nearby')).toBeTruthy();
    expect(screen.getByText('Park Pavilion')).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(discoveryCalls()).toHaveLength(1);
  });

  it('no longer lists a bathroom the user has just verified (guard)', async () => {
    await openCafe();
    await screen.findByText('Accuracy: 12m');
    fireEvent.press(screen.getByLabelText("I'm Here"));
    await screen.findByText('Verified!');

    fireEvent.press(screen.getByLabelText('Back to list'));

    expect(await screen.findByText('Park Pavilion')).toBeTruthy();
    expect(screen.queryByText('Riverside Cafe')).toBeNull();
    // Removed locally: no second discovery call that could land inside the server cooldown.
    expect(discoveryCalls()).toHaveLength(1);
  });

  it('after Done, reopening inside the server cooldown shows the remaining bathrooms, not a false empty list', async () => {
    jest.useFakeTimers();
    try {
      serveWithCooldown([CAFE, PARK]);
      const client = makeClient();
      const first = renderScreen(client);
      fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
      await screen.findByText('Accuracy: 12m');
      fireEvent.press(screen.getByLabelText("I'm Here"));
      await screen.findByText('Verified!');
      fireEvent.press(screen.getByLabelText('Done'));
      first.unmount();

      // Reopened a second later, well inside the 3 s server cooldown.
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      renderScreen(client);

      expect(await screen.findByText('Park Pavilion')).toBeTruthy();
      expect(screen.queryByText('Nothing to verify nearby')).toBeNull();
      expect(discoveryCalls()).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Verify modal: account change', () => {
  it('drops a bathroom selected under the previous account when the signed-in user changes', async () => {
    const client = makeClient();
    const view = renderScreen(client);
    fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
    await screen.findByText('Accuracy: 12m');

    // A different account signs in while the check is open.
    mockUserId = 'user-b';
    serveRpc({ candidates: { data: [PARK], error: null } });
    view.rerender(
      <QueryClientProvider client={client}>
        <VerifyScreen />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Verify a bathroom nearby')).toBeTruthy();
    expect(await screen.findByText('Park Pavilion')).toBeTruthy();
    expect(screen.queryByText('Accuracy: 12m')).toBeNull();
    expect(screen.queryByLabelText("I'm Here")).toBeNull();
    expect(verifyCalls()).toEqual([]);
  });
});

describe('Verify modal: spoken status on Android', () => {
  it('puts "Nothing to verify nearby" in a live region', async () => {
    serveRpc({ candidates: { data: [], error: null } });
    renderScreen();
    expect(inLiveRegion(await screen.findByText('Nothing to verify nearby'))).toBe(true);
  });

  it('puts the "Verified!" success state in a live region', async () => {
    renderScreen();
    fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
    await screen.findByText('Accuracy: 12m');
    fireEvent.press(screen.getByLabelText("I'm Here"));
    expect(inLiveRegion(await screen.findByText('Verified!'))).toBe(true);
  });
});

describe('Verify modal: spoken status on iOS', () => {
  // accessibilityLiveRegion is Android-only. On iOS a status that appears without a
  // focus change is silent unless the app announces it.
  const originalOS = Platform.OS;
  let announce: jest.SpyInstance;

  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });
  afterEach(() => {
    Platform.OS = originalOS;
    announce.mockRestore();
  });

  it('announces the refusal and then the success', async () => {
    Platform.OS = 'ios';
    serveRpc({ candidates: { data: [CAFE], error: null }, verify: { data: { accepted: false }, error: null } });
    renderScreen();
    fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
    await screen.findByText('Accuracy: 12m');
    fireEvent.press(screen.getByLabelText("I'm Here"));
    await screen.findByText('Unable to verify your location. Please try again.');

    expect(announce).toHaveBeenLastCalledWith('Unable to verify your location. Please try again.');

    serveRpc({ candidates: { data: [CAFE], error: null }, verify: { data: { accepted: true }, error: null } });
    fireEvent.press(screen.getByLabelText('Try Again'));
    await waitFor(() => expect(screen.getByLabelText("I'm Here")).toBeEnabled());
    fireEvent.press(screen.getByLabelText("I'm Here"));
    await screen.findByText('Verified!');

    expect(announce).toHaveBeenLastCalledWith('Verified! Thanks for keeping data fresh.');
  });

  it('announces advisory guidance too, and leaves Android to its live regions (guard)', async () => {
    Platform.OS = 'ios';
    mockPos.mockResolvedValue(fix({ accuracy: 88 }));
    const view = renderScreen();
    fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
    await screen.findByText('GPS accuracy too low — move to an open area and try again.');
    expect(announce).toHaveBeenLastCalledWith('GPS accuracy too low — move to an open area and try again.');
    view.unmount();

    announce.mockClear();
    Platform.OS = 'android';
    renderScreen();
    fireEvent.press(await screen.findByLabelText('Riverside Cafe. FMT:14. Pending verification.'));
    await screen.findByText('GPS accuracy too low — move to an open area and try again.');
    expect(announce).not.toHaveBeenCalled();
  });

  it.each([
    [
      'location permission is off',
      () => mockPerm.mockResolvedValue({ status: 'denied' }),
      "Location access is off. Turn on location so we can confirm you're here.",
    ],
    [
      'the list cannot be loaded',
      () => serveRpc({ candidates: new Error('network down') }),
      "Couldn't load bathrooms to verify.",
    ],
    [
      'there is nothing to verify',
      () => serveRpc({ candidates: { data: [], error: null } }),
      'Nothing to verify nearby',
    ],
  ])('announces the list\u2019s outcome when %s', async (_name, arrange, message) => {
    Platform.OS = 'ios';
    arrange();
    renderScreen();

    await screen.findByText(message);
    expect(announce).toHaveBeenLastCalledWith(message);
  });
});

describe('Verify modal: test hygiene', () => {
  it('rendered every state above without a state update outside act()', async () => {
    // Let trailing list timers fire before judging.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(actWarnings).toEqual([]);
  });
});
