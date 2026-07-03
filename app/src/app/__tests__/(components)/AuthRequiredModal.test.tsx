/**
 * Thin render + behavior tests for app/src/app/(components)/AuthRequiredModal.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for
 * TDD Guard compliance and behavioral verification only, not coverage metrics.
 *
 * ERR-10: inline slide-up modal, never a navigation redirect.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import AuthRequiredModal from '../../(components)/AuthRequiredModal';

describe('AuthRequiredModal', () => {
  const baseProps = {
    visible: true,
    action: 'verify' as const,
    onSignIn: jest.fn(),
    onCreateAccount: jest.fn(),
    onCancel: jest.fn(),
  };

  let reduceMotionSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    reduceMotionSpy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(false);
  });

  afterEach(() => {
    reduceMotionSpy.mockRestore();
  });

  it('renders the action-specific heading "Sign in to verify"', () => {
    const { getByText } = render(<AuthRequiredModal {...baseProps} />);
    expect(getByText('Sign in to verify')).toBeTruthy();
  });

  it('renders a different heading for a different action', () => {
    const { getByText } = render(<AuthRequiredModal {...baseProps} action="rate" />);
    expect(getByText('Sign in to rate')).toBeTruthy();
  });

  it('pressing "Sign In" calls onSignIn', () => {
    const onSignIn = jest.fn();
    const { getByText } = render(<AuthRequiredModal {...baseProps} onSignIn={onSignIn} />);
    fireEvent.press(getByText('Sign In'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('pressing "Create Account" calls onCreateAccount', () => {
    const onCreateAccount = jest.fn();
    const { getByText } = render(
      <AuthRequiredModal {...baseProps} onCreateAccount={onCreateAccount} />
    );
    fireEvent.press(getByText('Create Account'));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });

  it('pressing "Cancel" calls onCancel', () => {
    const onCancel = jest.fn();
    const { getByText } = render(<AuthRequiredModal {...baseProps} onCancel={onCancel} />);
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Android back button (onRequestClose) calls onCancel', () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(<AuthRequiredModal {...baseProps} onCancel={onCancel} />);
    fireEvent(getByTestId('auth-required-modal'), 'requestClose');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses instant appear (animationType "none") when reduced motion is enabled', async () => {
    reduceMotionSpy.mockResolvedValue(true);
    const { findByTestId } = render(<AuthRequiredModal {...baseProps} />);
    const modal = await findByTestId('auth-required-modal');
    expect(modal.props.animationType).toBe('none');
  });

  it('uses slide animation when reduced motion is disabled', async () => {
    reduceMotionSpy.mockResolvedValue(false);
    const { findByTestId } = render(<AuthRequiredModal {...baseProps} />);
    const modal = await findByTestId('auth-required-modal');
    expect(modal.props.animationType).toBe('slide');
  });

  it('IN-02: does not update state after unmount when the promise resolves late', async () => {
    let resolveReduceMotion: (value: boolean) => void = () => {};
    reduceMotionSpy.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveReduceMotion = resolve;
      })
    );
    const { unmount } = render(<AuthRequiredModal {...baseProps} />);
    unmount();

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      resolveReduceMotion(true);
      await Promise.resolve();
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('IN-02: a rejected isReduceMotionEnabled() promise does not throw', async () => {
    reduceMotionSpy.mockRejectedValue(new Error('native module unavailable'));
    expect(() => render(<AuthRequiredModal {...baseProps} />)).not.toThrow();
    await act(async () => {
      await Promise.resolve();
    });
  });
});
