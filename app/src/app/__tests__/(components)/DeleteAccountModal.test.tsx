/**
 * Thin render + behavior tests for app/src/app/(components)/DeleteAccountModal.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 *
 * T-02-03 critical: the Destructive button must stay disabled until the input
 * equals exactly "DELETE" (case-sensitive) — "delete" and "Delete" must not enable it.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

const mockDeleteAccount = jest.fn();
jest.mock('../../../features/profile/deleteAccount', () => ({
  deleteAccount: (...args: unknown[]) => mockDeleteAccount(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteAccount.mockResolvedValue(undefined);
});

import DeleteAccountModal from '../../(components)/DeleteAccountModal';

describe('DeleteAccountModal', () => {
  const baseProps = {
    visible: true,
    onCancel: jest.fn(),
  };

  it('renders the "Delete Account" title and verbatim body copy', () => {
    const { getAllByText, getByText } = render(<DeleteAccountModal {...baseProps} />);
    expect(getAllByText('Delete Account').length).toBeGreaterThanOrEqual(1);
    expect(
      getByText(
        'This will permanently delete your account. Your contributions to the community will remain but your identity will be removed.'
      )
    ).toBeTruthy();
  });

  it('Destructive button is disabled for empty input', () => {
    const { getByLabelText } = render(<DeleteAccountModal {...baseProps} />);
    const button = getByLabelText('Delete Account — permanent');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('Destructive button is disabled for "delete" (lowercase)', () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <DeleteAccountModal {...baseProps} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'delete');
    const button = getByLabelText('Delete Account — permanent');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('Destructive button is disabled for "Delete" (mixed case)', () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <DeleteAccountModal {...baseProps} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'Delete');
    const button = getByLabelText('Delete Account — permanent');
    expect(button.props.accessibilityState?.disabled).toBe(true);
  });

  it('Destructive button is enabled only for exact "DELETE"', () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <DeleteAccountModal {...baseProps} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'DELETE');
    const button = getByLabelText('Delete Account — permanent');
    expect(button.props.accessibilityState?.disabled).toBe(false);
  });

  it('tapping the enabled Destructive button calls deleteAccount', async () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <DeleteAccountModal {...baseProps} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'DELETE');
    fireEvent.press(getByLabelText('Delete Account — permanent'));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
  });

  it('on deleteAccount failure shows the inline error copy', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('network down'));
    const { getByLabelText, getByPlaceholderText, findByText } = render(
      <DeleteAccountModal {...baseProps} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'DELETE');
    fireEvent.press(getByLabelText('Delete Account — permanent'));

    expect(
      await findByText("Couldn't delete your account. Check your connection and try again.")
    ).toBeTruthy();
  });

  it('pressing "Cancel" calls onCancel', () => {
    const onCancel = jest.fn();
    const { getByText } = render(<DeleteAccountModal {...baseProps} onCancel={onCancel} />);
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('swipe-to-dismiss is forbidden: onRequestClose does NOT call onCancel', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(<DeleteAccountModal {...baseProps} onCancel={onCancel} />);
    fireEvent(getByTestId('delete-account-modal'), 'requestClose');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('CR-01: resets confirm text when reopened after typing DELETE and canceling', () => {
    const { getByPlaceholderText, getByLabelText, rerender } = render(
      <DeleteAccountModal visible={true} onCancel={jest.fn()} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'DELETE');
    expect(getByLabelText('Delete Account — permanent').props.accessibilityState?.disabled).toBe(
      false
    );

    // Cancel (parent flips visible to false) then reopen.
    rerender(<DeleteAccountModal visible={false} onCancel={jest.fn()} />);
    rerender(<DeleteAccountModal visible={true} onCancel={jest.fn()} />);

    expect(getByPlaceholderText('Type DELETE to confirm').props.value).toBe('');
    expect(getByLabelText('Delete Account — permanent').props.accessibilityState?.disabled).toBe(
      true
    );
  });

  it('CR-01: reopening clears a stale error from a prior failed attempt', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('network down'));
    const { getByPlaceholderText, getByLabelText, findByText, queryByText, rerender } = render(
      <DeleteAccountModal visible={true} onCancel={jest.fn()} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'DELETE');
    fireEvent.press(getByLabelText('Delete Account — permanent'));
    expect(
      await findByText("Couldn't delete your account. Check your connection and try again.")
    ).toBeTruthy();

    rerender(<DeleteAccountModal visible={false} onCancel={jest.fn()} />);
    rerender(<DeleteAccountModal visible={true} onCancel={jest.fn()} />);

    expect(
      queryByText("Couldn't delete your account. Check your connection and try again.")
    ).toBeNull();
  });

  it('WR-01: two presses dispatched before any re-render commits only call deleteAccount once', async () => {
    let resolveDelete: () => void = () => {};
    mockDeleteAccount.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );
    const { getByPlaceholderText, getByLabelText } = render(<DeleteAccountModal {...baseProps} />);
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'DELETE');
    const button = getByLabelText('Delete Account — permanent');

    // Both presses dispatched inside one act() so neither sees the other's re-render —
    // this is what a genuine double-tap race looks like, unlike two separate
    // fireEvent.press() calls (each individually flushed by its own act()).
    act(() => {
      fireEvent.press(button);
      fireEvent.press(button);
    });

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete();
      await Promise.resolve();
    });
  });

  it('WR-03: the delete-failure error is announced via accessibilityLiveRegion', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('network down'));
    const { getByPlaceholderText, getByLabelText, findByText } = render(
      <DeleteAccountModal {...baseProps} />
    );
    fireEvent.changeText(getByPlaceholderText('Type DELETE to confirm'), 'DELETE');
    fireEvent.press(getByLabelText('Delete Account — permanent'));

    const errorText = await findByText(
      "Couldn't delete your account. Check your connection and try again."
    );
    expect(errorText.props.accessibilityLiveRegion).toBe('assertive');
  });
});
