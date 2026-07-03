/**
 * Thin render + behavior tests for app/src/app/(tabs)/profile.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LEGAL_URLS } from '../../../constants/legal';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

const mockOpenURL = jest.fn();
const mockOpenSettings = jest.fn();
jest.mock('expo-linking', () => ({
  openURL: (...args: unknown[]) => mockOpenURL(...args),
  openSettings: (...args: unknown[]) => mockOpenSettings(...args),
}));

const mockSignOut = jest.fn();
let mockSessionValue: { session: { user: { id: string; email: string } } | null; signOut: jest.Mock };
jest.mock('../../../features/auth/useSession', () => ({
  useSession: () => mockSessionValue,
}));

const mockProfileStats = jest.fn();
jest.mock('../../../features/profile/profileStats', () => ({
  profileStats: (...args: unknown[]) => mockProfileStats(...args),
}));

const mockGetMyProfile = jest.fn();
jest.mock('../../../features/profile/getMyProfile', () => ({
  getMyProfile: (...args: unknown[]) => mockGetMyProfile(...args),
}));

const mockDeleteAccount = jest.fn();
jest.mock('../../../features/profile/deleteAccount', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

async function renderWithQueryClient(children: React.ReactElement) {
  // gcTime: 0 avoids leaving cache garbage-collection timers scheduled past test end
  // (Jest's "did not exit cleanly" warning) — each test gets a disposable client anyway.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const utils = render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
  // Flushes the microtask on which mocked queryFns resolve, so the resulting state
  // update lands inside act() instead of just after render() returns.
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
}

import ProfileScreen from '../../(tabs)/profile';

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
  mockProfileStats.mockResolvedValue({
    gpsVerifications: 3,
    locationsSubmitted: 1,
    ratingsGiven: 2,
  });
  mockGetMyProfile.mockResolvedValue({ displayName: 'Jamie' });
});

describe('ProfileScreen — Unauthenticated', () => {
  beforeEach(() => {
    mockSessionValue = { session: null, signOut: mockSignOut };
  });

  it('renders "Sign in to contribute" CTA', async () => {
    const { getByText } = await renderWithQueryClient(<ProfileScreen />);
    expect(getByText('Sign in to contribute')).toBeTruthy();
  });

  it('tapping "Sign In" navigates via router.push (never replace)', async () => {
    const { getAllByText } = await renderWithQueryClient(<ProfileScreen />);
    fireEvent.press(getAllByText('Sign In')[0]);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-in');
  });

  it('tapping "Create Account" navigates via router.push', async () => {
    const { getAllByText } = await renderWithQueryClient(<ProfileScreen />);
    fireEvent.press(getAllByText('Create Account')[0]);
    expect(mockPush).toHaveBeenCalledWith('/(auth)/sign-up');
  });

  it('renders the muted stats preview', async () => {
    const { getByText } = await renderWithQueryClient(<ProfileScreen />);
    expect(getByText('? GPS Verifications')).toBeTruthy();
    expect(getByText('? Locations Submitted')).toBeTruthy();
  });

  it('does not fetch profileStats or getMyProfile while unauthenticated', async () => {
    await renderWithQueryClient(<ProfileScreen />);
    expect(mockProfileStats).not.toHaveBeenCalled();
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen — Signed In', () => {
  beforeEach(() => {
    mockSessionValue = {
      session: { user: { id: 'user-1', email: 'jamie@example.com' } },
      signOut: mockSignOut,
    };
  });

  it('renders the masked email', async () => {
    const { findByText } = await renderWithQueryClient(<ProfileScreen />);
    expect(await findByText('j•••@example.com')).toBeTruthy();
  });

  it('renders the display name once loaded', async () => {
    const { findByText } = await renderWithQueryClient(<ProfileScreen />);
    expect(await findByText('Jamie')).toBeTruthy();
  });

  it('WR-02: shows a "Profile" fallback when getMyProfile fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('network down'));
    const { findAllByText } = await renderWithQueryClient(<ProfileScreen />);
    // One "Profile" is the static H2 title; the fallback adds a second occurrence.
    const matches = await findAllByText('Profile');
    expect(matches.length).toBe(2);
  });

  it('IN-03: shows a "Profile" fallback when display_name resolves to null', async () => {
    mockGetMyProfile.mockResolvedValue({ displayName: null });
    const { findAllByText } = await renderWithQueryClient(<ProfileScreen />);
    const matches = await findAllByText('Profile');
    expect(matches.length).toBe(2);
  });

  it('renders stats once loaded', async () => {
    const { findByText } = await renderWithQueryClient(<ProfileScreen />);
    await waitFor(() => expect(mockProfileStats).toHaveBeenCalledTimes(1));
    expect(await findByText('3')).toBeTruthy();
    expect(await findByText('1')).toBeTruthy();
    expect(await findByText('2')).toBeTruthy();
  });

  it('shows "—" for each stat when profileStats errors', async () => {
    mockProfileStats.mockRejectedValue(new Error('network down'));
    const { findAllByText } = await renderWithQueryClient(<ProfileScreen />);
    const dashes = await findAllByText('—');
    expect(dashes.length).toBe(3);
  });

  it('tapping "Privacy Policy" opens LEGAL_URLS.privacyPolicy', async () => {
    const { getByText } = await renderWithQueryClient(<ProfileScreen />);
    fireEvent.press(getByText('Privacy Policy'));
    expect(mockOpenURL).toHaveBeenCalledWith(LEGAL_URLS.privacyPolicy);
  });

  it('tapping "Terms of Service" opens LEGAL_URLS.termsOfService', async () => {
    const { getByText } = await renderWithQueryClient(<ProfileScreen />);
    fireEvent.press(getByText('Terms of Service'));
    expect(mockOpenURL).toHaveBeenCalledWith(LEGAL_URLS.termsOfService);
  });

  it('tapping "Sign Out" calls signOut', async () => {
    const { getByText } = await renderWithQueryClient(<ProfileScreen />);
    fireEvent.press(getByText('Sign Out'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('tapping "Open Settings" calls Linking.openSettings', async () => {
    const { getByText } = await renderWithQueryClient(<ProfileScreen />);
    fireEvent.press(getByText('Open Settings'));
    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('tapping "Delete Account" opens the delete confirmation modal', async () => {
    const { getByText, getByPlaceholderText } = await renderWithQueryClient(<ProfileScreen />);
    fireEvent.press(getByText('Delete Account'));
    expect(getByPlaceholderText('Type DELETE to confirm')).toBeTruthy();
  });

  it('canceling the delete confirmation modal closes it', async () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = await renderWithQueryClient(
      <ProfileScreen />
    );
    fireEvent.press(getByText('Delete Account'));
    expect(getByPlaceholderText('Type DELETE to confirm')).toBeTruthy();
    fireEvent.press(getByText('Cancel'));
    expect(queryByPlaceholderText('Type DELETE to confirm')).toBeNull();
  });

  it('CODEX-01: does not leak a previous user\'s cached stats to a newly signed-in user', async () => {
    // _layout.tsx creates ONE QueryClient at module scope that outlives component
    // mount/unmount cycles — simulate that by sharing a single client across two
    // separate render() calls, the same way sign-out -> sign-in would in the real app.
    const sharedQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    mockSessionValue = {
      session: { user: { id: 'user-1', email: 'alice@example.com' } },
      signOut: mockSignOut,
    };
    mockProfileStats.mockResolvedValue({
      gpsVerifications: 5,
      locationsSubmitted: 9,
      ratingsGiven: 1,
    });

    const first = render(
      <QueryClientProvider client={sharedQueryClient}>
        <ProfileScreen />
      </QueryClientProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(await first.findByText('5')).toBeTruthy();
    first.unmount();

    // A different user signs in on the same app runtime. Their stats fetch is still
    // in flight — user-1's cached value must not render for user-2 in the meantime.
    // The fetch is deliberately settled below (not left dangling) so Jest can exit;
    // an unsettled promise here previously left an open async handle (Codex finding).
    mockSessionValue = {
      session: { user: { id: 'user-2', email: 'bob@example.com' } },
      signOut: mockSignOut,
    };
    let resolveUser2Stats: (value: {
      gpsVerifications: number;
      locationsSubmitted: number;
      ratingsGiven: number;
    }) => void = () => {};
    mockProfileStats.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUser2Stats = resolve;
        })
    );

    const second = render(
      <QueryClientProvider client={sharedQueryClient}>
        <ProfileScreen />
      </QueryClientProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(second.queryByText('5')).toBeNull();

    await act(async () => {
      resolveUser2Stats({ gpsVerifications: 7, locationsSubmitted: 2, ratingsGiven: 0 });
      await Promise.resolve();
    });

    second.unmount();
    sharedQueryClient.clear();
  });
});
