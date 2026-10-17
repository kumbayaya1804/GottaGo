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
import { AccessibilityInfo, Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// --- Mock @gorhom/bottom-sheet: render children as plain Views so content is queryable.
// The imperative open/close calls are shared spies so tests can see when the sheet opens.
const mockSnapToIndex = jest.fn();
const mockClose = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const RealReact = require('react');
  const { View } = require('react-native');
  const BottomSheet = RealReact.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      RealReact.useImperativeHandle(ref, () => ({
        snapToIndex: mockSnapToIndex,
        expand: jest.fn(),
        collapse: jest.fn(),
        close: mockClose,
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

  it('tapping "Withdraw submission" opens the confirm dialog with the Phase 5 copy: it will not publish, and verifications already given are kept (D-58)', () => {
    const { getByText, getByLabelText, queryByText } = renderSheet();
    fireEvent.press(getByLabelText('Withdraw submission'));
    // Since Phase 5 a withdrawal with verification events is cancelled, not deleted, so
    // the old "This can't be undone" wording no longer describes what happens.
    expect(
      getByText("Withdraw this submission? It won't publish, but any verifications already given are kept."),
    ).toBeTruthy();
    expect(queryByText("Are you sure? This can't be undone")).toBeNull();
    // Visible button labels from 05-UI-SPEC: confirm "Withdraw", cancel "Keep it".
    expect(getByText('Withdraw')).toBeTruthy();
    expect(getByLabelText('Keep it')).toBeTruthy();
    expect(getByText('Keep it')).toBeTruthy();
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

describe('PendingStatusSheet: published resolution (D-68)', () => {
  // The pending-only query drops a submission the moment it publishes, so this state is
  // driven by a separate `publication` prop, never by `submission`.
  const PUBLICATION = {
    submissionId: ID,
    locationId: '33333333-3333-3333-3333-333333333333',
    name: 'Trailhead Port-a-Potty',
    publishedAt: '2026-10-11T12:00:00Z',
  };
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('opens again for the next publication after the previous one is swiped away', () => {
    // The owner can have several unseen publications. Swiping one away moves straight to
    // the next while the sheet stays "open" in props; it must be presented again, not
    // rendered into the sheet the swipe just closed.
    const NEXT = { ...PUBLICATION, submissionId: '44444444-4444-4444-4444-444444444444', name: 'Library Restroom' };
    const props = { submission: null, onDismiss: jest.fn(), onWithdrawn: jest.fn(), onPublicationSeen: jest.fn() };
    const { rerender } = render(<PendingStatusSheet {...props} publication={PUBLICATION} />);
    expect(mockSnapToIndex).toHaveBeenCalledTimes(1);

    rerender(<PendingStatusSheet {...props} publication={NEXT} />);
    expect(mockSnapToIndex).toHaveBeenCalledTimes(2);
    expect(mockSnapToIndex).toHaveBeenLastCalledWith(0);
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('tells the creator their bathroom published (seen, and spoken on iOS) and reports it seen on Done', () => {
    Platform.OS = 'ios';
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const onPublicationSeen = jest.fn();

    const { getByText, getByLabelText, getByTestId, queryByText, queryByLabelText } = renderSheet({
      submission: null,
      publication: PUBLICATION,
      onPublicationSeen,
    });

    expect(getByText('Published!')).toBeTruthy();
    expect(getByText('Trailhead Port-a-Potty')).toBeTruthy();
    expect(
      getByText('Your bathroom is now live on the map. Thanks for helping people find a place to go.'),
    ).toBeTruthy();
    // Status is words plus a mark, never colour alone; the mark is hidden from screen readers.
    expect(getByTestId('icon-checkmark-circle', { includeHiddenElements: true })).toBeTruthy();
    // Nothing from the pending variant.
    expect(queryByText(/GPS verifications received/)).toBeNull();
    expect(queryByText('Pending')).toBeNull();
    expect(queryByLabelText('Withdraw submission')).toBeNull();
    // The sheet slides up without taking focus; iOS has no live regions.
    expect(announce).toHaveBeenCalledWith(
      'Published! Your bathroom is now live on the map. Thanks for helping people find a place to go.',
    );

    fireEvent.press(getByLabelText('Done'));
    expect(onPublicationSeen).toHaveBeenCalledWith(ID);
  });
});
