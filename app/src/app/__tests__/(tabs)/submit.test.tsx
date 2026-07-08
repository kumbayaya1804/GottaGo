/**
 * Thin render + behavior tests for app/src/app/(tabs)/submit.tsx — the 3-step
 * SubmitFlow wizard (04-05).
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 * Real GPS accuracy / permission prompts / mock-location are device-only and are
 * covered by the Task 3 device-UAT checkpoint, not jest.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, replace: mockReplace })),
  useSegments: jest.fn(() => []),
}));

let mockSessionValue: { session: { user: { id: string; email: string } } | null } | null;
jest.mock('../../../features/auth/useSession', () => ({
  useSession: () => mockSessionValue,
}));

const mockGetGpsSample = jest.fn();
jest.mock('../../../features/submit/useGpsSample', () => ({
  getGpsSample: (...args: unknown[]) => mockGetGpsSample(...args),
}));

const mockSubmitLocation = jest.fn();
jest.mock('../../../features/submit/submitLocation', () => ({
  submitLocation: (...args: unknown[]) => mockSubmitLocation(...args),
}));

import SubmitScreen from '../../(tabs)/submit';

// LOCKED copy mirrored from 04-UI-SPEC.md (verbatim assertions).
const PIN_LABEL = 'Door code (optional) — only shown to signed-in users';
const ADDRESS_AFFORDANCE = 'No address? Describe the location instead';
const SENSITIVITY_LABEL = 'Not suitable for kids';
const CTA_NEXT = 'Next →';

async function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SubmitScreen />
    </QueryClientProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
}

/** Fill Step 1 (name + policy tag) and advance to Step 2. */
async function advanceToStep2(
  utils: Awaited<ReturnType<typeof renderWizard>>,
  policyLabel = 'Chill Spot',
) {
  fireEvent.changeText(utils.getByLabelText('Name'), 'Corner Cafe');
  fireEvent.press(utils.getByText(policyLabel));
  await act(async () => {
    fireEvent.press(utils.getByText(CTA_NEXT));
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionValue = { session: { user: { id: 'user-1', email: 'jamie@example.com' } } };
  mockGetGpsSample.mockResolvedValue({
    coord: { lat: 44.05, lng: -123.09 },
    accuracy: 10,
    mocked: false,
    timestamp: Date.now(),
  });
  mockSubmitLocation.mockResolvedValue('new-location-id');
});

describe('SubmitScreen — auth gate (D-18)', () => {
  it('shows the AuthRequiredModal and no form when signed out', async () => {
    mockSessionValue = { session: null };
    const utils = await renderWizard();
    expect(utils.getByText('Sign in to submit')).toBeTruthy();
    // The form is not mounted — no name field, no sensitivity switch.
    expect(utils.queryByLabelText('Name')).toBeNull();
    expect(utils.queryByText(SENSITIVITY_LABEL)).toBeNull();
  });

  it('mounts the form (Step 1) when signed in', async () => {
    const utils = await renderWizard();
    expect(utils.getByLabelText('Name')).toBeTruthy();
    expect(utils.getByText(SENSITIVITY_LABEL)).toBeTruthy();
  });
});

describe('SubmitScreen — Step 1 (D-04 / D-10 / D-13)', () => {
  it('renders the free-text address affordance (D-04)', async () => {
    const utils = await renderWizard();
    expect(utils.getByText(ADDRESS_AFFORDANCE)).toBeTruthy();
  });

  it('renders the sensitivity control as an RN Switch (not a chip)', async () => {
    const utils = await renderWizard();
    const toggle = utils.getByLabelText(SENSITIVITY_LABEL);
    expect(toggle.props.accessibilityRole).toBe('switch');
  });
});

describe('SubmitScreen — Step 2 conditional PIN (D-17)', () => {
  it('does NOT render the PIN field for a non-code_required policy', async () => {
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    await waitFor(() => expect(utils.queryByLabelText('Hours')).toBeTruthy());
    expect(utils.queryByText(PIN_LABEL)).toBeNull();
  });

  it('renders the PIN field with LOCKED helper copy when policy is Code Required', async () => {
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Code Required');
    await waitFor(() => expect(utils.getByText(PIN_LABEL)).toBeTruthy());
  });
});
