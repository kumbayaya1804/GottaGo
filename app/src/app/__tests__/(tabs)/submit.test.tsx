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
const CTA_AT_LOCATION = "I'm at This Location";
const SUCCESS_HEADING = 'Location Submitted!';
const SUCCESS_BODY =
  "It'll appear publicly after 2 GPS verifications. You can see it on the map now.";
const SENSITIVITY_CONFIRM_BODY = 'This location will be hidden from Family mode users';
const ERR_08 = "Couldn't submit your location. Check your connection and try again.";
const ERR_02 = 'GPS accuracy too low — move to an open area and try again.';

function freshSample(accuracy: number) {
  return {
    coord: { lat: 44.05, lng: -123.09 },
    accuracy,
    mocked: false,
    timestamp: Date.now(),
  };
}

async function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      // gcTime: 0 here too — otherwise each test's completed mutation schedules a
      // default 5-minute gc timer that outlives the test and the QueryClient
      // (never unmounted/cleared), which is what left Jest unable to exit.
      mutations: { retry: false, gcTime: 0 },
    },
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

/** Advance from a rendered Step 2 to Step 3 (GPS confirm); flush the getGpsSample read. */
async function advanceToStep3(utils: Awaited<ReturnType<typeof renderWizard>>) {
  await waitFor(() => expect(utils.getAllByText(CTA_NEXT).length).toBeGreaterThan(0));
  await act(async () => {
    fireEvent.press(utils.getAllByText(CTA_NEXT)[0]);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
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

  it('blocks advancing to Step 3 when an overlong Timing tip fails Zod validation', async () => {
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    await waitFor(() => expect(utils.getByLabelText('Timing tip')).toBeTruthy());
    fireEvent.changeText(utils.getByLabelText('Timing tip'), 'a'.repeat(281));
    await act(async () => {
      fireEvent.press(utils.getAllByText(CTA_NEXT)[0]);
      await Promise.resolve();
    });
    // Still on Step 2 — the Step 3 GPS confirm heading never renders.
    expect(utils.queryByText('GPS Confirm')).toBeNull();
    expect(utils.getByLabelText('Timing tip')).toBeTruthy();
    expect(mockSubmitLocation).not.toHaveBeenCalled();
  });
});

describe('SubmitScreen — Step 3 GPS gate (SC8 / ERR-02)', () => {
  it('disables "I\'m at This Location" and shows ERR-02 when accuracy > 50m', async () => {
    mockGetGpsSample.mockResolvedValue(freshSample(80));
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    await advanceToStep3(utils);
    await waitFor(() => expect(utils.getByText(ERR_02)).toBeTruthy());
    const cta = utils.getByLabelText(CTA_AT_LOCATION);
    expect(cta.props.accessibilityState.disabled).toBe(true);
    expect(mockSubmitLocation).not.toHaveBeenCalled();
  });

  it('enables the CTA with a good, fresh, non-mocked sample (≤ 50m)', async () => {
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    await advanceToStep3(utils);
    await waitFor(() => {
      const cta = utils.getByLabelText(CTA_AT_LOCATION);
      expect(cta.props.accessibilityState.disabled).toBe(false);
    });
  });
});

describe('SubmitScreen — sensitivity confirm gate (D-15)', () => {
  it('opens SensitivityConfirmModal before submitLocation when sensitivity is ON', async () => {
    const utils = await renderWizard();
    fireEvent(utils.getByLabelText(SENSITIVITY_LABEL), 'valueChange', true);
    await advanceToStep2(utils, 'Chill Spot');
    await advanceToStep3(utils);

    await waitFor(() => {
      const cta = utils.getByLabelText(CTA_AT_LOCATION);
      expect(cta.props.accessibilityState.disabled).toBe(false);
    });
    fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));

    await waitFor(() => expect(utils.getByText(SENSITIVITY_CONFIRM_BODY)).toBeTruthy());
    expect(mockSubmitLocation).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(utils.getByText('Confirm'));
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSubmitLocation).toHaveBeenCalledTimes(1));
  });

  it('submits directly (no dialog) when sensitivity is OFF and reaches the Success screen', async () => {
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    await advanceToStep3(utils);
    await waitFor(() => {
      const cta = utils.getByLabelText(CTA_AT_LOCATION);
      expect(cta.props.accessibilityState.disabled).toBe(false);
    });
    await act(async () => {
      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
      await Promise.resolve();
    });
    expect(utils.queryByText(SENSITIVITY_CONFIRM_BODY)).toBeNull();
    await waitFor(() => expect(mockSubmitLocation).toHaveBeenCalledTimes(1));
    expect(await utils.findByText(SUCCESS_HEADING)).toBeTruthy();
    expect(utils.getByText(SUCCESS_BODY)).toBeTruthy();
    expect(utils.getByText('Back to Map')).toBeTruthy();
  });

  it('retains a typed Hours value and forwards it to submitLocation', async () => {
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    fireEvent.changeText(utils.getByLabelText('Hours'), 'Open 7am-10pm');
    await advanceToStep3(utils);
    await waitFor(() => {
      const cta = utils.getByLabelText(CTA_AT_LOCATION);
      expect(cta.props.accessibilityState.disabled).toBe(false);
    });
    await act(async () => {
      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSubmitLocation).toHaveBeenCalledTimes(1));
    expect(mockSubmitLocation).toHaveBeenCalledWith(
      expect.objectContaining({ hours: 'Open 7am-10pm' })
    );
  });

  it('a fast double-press of the submit CTA calls submitLocation only once (re-entrancy guard)', async () => {
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    await advanceToStep3(utils);
    await waitFor(() => {
      const cta = utils.getByLabelText(CTA_AT_LOCATION);
      expect(cta.props.accessibilityState.disabled).toBe(false);
    });
    await act(async () => {
      // Both presses fire before mutation.isPending has a chance to re-render and
      // disable the button — the submittingRef guard, not React state, must catch this.
      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
      await Promise.resolve();
    });
    await waitFor(() => expect(mockSubmitLocation).toHaveBeenCalledTimes(1));
  });
});

describe('SubmitScreen — submit failure maps to ERR-08 (SC7)', () => {
  it('renders LOCKED ERR-08 and does NOT clear the form on RPC error', async () => {
    mockSubmitLocation.mockRejectedValue(new Error('gps rejected'));
    const utils = await renderWizard();
    await advanceToStep2(utils, 'Chill Spot');
    await advanceToStep3(utils);
    await waitFor(() => {
      const cta = utils.getByLabelText(CTA_AT_LOCATION);
      expect(cta.props.accessibilityState.disabled).toBe(false);
    });
    await act(async () => {
      fireEvent.press(utils.getByLabelText(CTA_AT_LOCATION));
      await Promise.resolve();
    });
    expect(await utils.findByText(ERR_08)).toBeTruthy();
    // Never surfaces the raw rejection reason (SC7).
    expect(utils.queryByText('gps rejected')).toBeNull();
    // Still on Step 3 (form preserved, not success).
    expect(utils.queryByText(SUCCESS_HEADING)).toBeNull();
    expect(utils.getByLabelText(CTA_AT_LOCATION)).toBeTruthy();
  });
});
