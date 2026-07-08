/**
 * Thin render + behavior tests for app/src/app/(components)/PendingStatusSheet.tsx
 * (+ the nested WithdrawConfirmModal it renders).
 *
 * src/app/** is excluded from coverage collection — these tests exist for TDD
 * Guard compliance and behavioral verification only, not coverage metrics. Native
 * Mapbox pin rendering + submitter-scoped visibility are device-verified in the
 * Task 3 checkpoint; here we lock the sheet's content + withdraw wiring:
 *  - the LOCKED verification-progress copy renders a DYNAMIC 'N of 2' count from
 *    the tapped pending feature's confirmationCount (D-27),
 *  - NO Rate/Report/Directions row (this is the pending variant, not the published
 *    LocationDetailSheet),
 *  - the destructive 'Withdraw submission' CTA opens the D-30 confirm dialog, and
 *    confirming calls withdrawSubmission(id) then onWithdrawn (so the pin vanishes).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

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
      return RealReact.createElement(View, { testID: 'pending-status-sheet' }, children);
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

// --- Mock the network withdraw wrapper: assert it is called with the id, control resolution.
const mockWithdrawSubmission = jest.fn();
jest.mock('../../../features/submit/withdrawSubmission', () => ({
  withdrawSubmission: (...args: unknown[]) => mockWithdrawSubmission(...args),
}));

import PendingStatusSheet from '../../(components)/PendingStatusSheet';

const ID = '22222222-2222-2222-2222-222222222222';

const baseSubmission = {
  id: ID,
  name: 'Trailhead Port-a-Potty',
  policyTag: 'public_facility',
  confirmationCount: 1,
  expiresAt: '2026-07-10T12:00:00Z',
};

function renderSheet(
  props: Partial<React.ComponentProps<typeof PendingStatusSheet>> = {},
) {
  return render(
    <PendingStatusSheet
      submission={baseSubmission}
      onDismiss={jest.fn()}
      onWithdrawn={jest.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithdrawSubmission.mockResolvedValue(undefined);
});

describe('PendingStatusSheet', () => {
  it('renders nothing when no pending submission is selected', () => {
    const { queryByText } = renderSheet({ submission: null });
    expect(queryByText('Trailhead Port-a-Potty')).toBeNull();
  });

  it('renders the submission name', () => {
    const { getByText } = renderSheet();
    expect(getByText('Trailhead Port-a-Potty')).toBeTruthy();
  });

  it('renders the LOCKED verification-progress copy with a dynamic count (1 of 2)', () => {
    const { getByText } = renderSheet();
    expect(
      getByText(
        'Pending — 1 of 2 GPS verifications received. Share with friends to speed up verification.',
      ),
    ).toBeTruthy();
  });

  it('renders the progress count dynamically from confirmationCount (0 of 2)', () => {
    const { getByText } = renderSheet({
      submission: { ...baseSubmission, confirmationCount: 0 },
    });
    expect(
      getByText(
        'Pending — 0 of 2 GPS verifications received. Share with friends to speed up verification.',
      ),
    ).toBeTruthy();
  });

  it('shows the "Pending" badge (color + text, never color-only)', () => {
    const { getByText } = renderSheet();
    expect(getByText('Pending')).toBeTruthy();
  });

  it('does NOT render a Rate / Report / Get Directions row (pending variant)', () => {
    const { queryByText, queryByLabelText } = renderSheet();
    expect(queryByText('Rate')).toBeNull();
    expect(queryByText('Report')).toBeNull();
    expect(queryByText('Get Directions')).toBeNull();
    expect(queryByLabelText('Get Directions')).toBeNull();
  });

  it('renders the destructive "Withdraw submission" CTA', () => {
    const { getByLabelText } = renderSheet();
    expect(getByLabelText('Withdraw submission')).toBeTruthy();
  });

  it('tapping "Withdraw submission" opens the D-30 confirm dialog', () => {
    const { getByLabelText, getByText } = renderSheet();
    fireEvent.press(getByLabelText('Withdraw submission'));
    expect(getByText("Are you sure? This can't be undone")).toBeTruthy();
  });

  it('confirming the withdraw calls withdrawSubmission with the submission id', async () => {
    const { getByLabelText } = renderSheet();
    fireEvent.press(getByLabelText('Withdraw submission'));
    fireEvent.press(getByLabelText('Withdraw submission — permanent'));
    await waitFor(() => {
      expect(mockWithdrawSubmission).toHaveBeenCalledWith(ID);
    });
  });

  it('calls onWithdrawn after a successful withdraw (so the pin can be invalidated)', async () => {
    const onWithdrawn = jest.fn();
    const { getByLabelText } = renderSheet({ onWithdrawn });
    fireEvent.press(getByLabelText('Withdraw submission'));
    fireEvent.press(getByLabelText('Withdraw submission — permanent'));
    await waitFor(() => {
      expect(onWithdrawn).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call onWithdrawn when the withdraw RPC fails (shows inline error instead)', async () => {
    mockWithdrawSubmission.mockRejectedValue(new Error('network down'));
    const onWithdrawn = jest.fn();
    const { getByLabelText, findByText } = renderSheet({ onWithdrawn });
    fireEvent.press(getByLabelText('Withdraw submission'));
    fireEvent.press(getByLabelText('Withdraw submission — permanent'));
    await findByText("Couldn't withdraw your submission. Check your connection and try again.");
    expect(onWithdrawn).not.toHaveBeenCalled();
  });

  it('the withdraw confirm dialog forbids swipe-dismiss (onRequestClose is a no-op)', () => {
    const onDismiss = jest.fn();
    const { getByLabelText, getByTestId } = renderSheet({ onDismiss });
    fireEvent.press(getByLabelText('Withdraw submission'));
    fireEvent(getByTestId('withdraw-confirm-modal'), 'requestClose');
    // A swipe/back gesture on the destructive confirm must not silently withdraw or dismiss.
    expect(mockWithdrawSubmission).not.toHaveBeenCalled();
  });
});
