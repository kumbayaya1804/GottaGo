import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, useColorScheme, AccessibilityInfo } from 'react-native';
import { Colors } from '../../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';

/**
 * ERR-10 Auth Required Modal — inline slide-up sheet shown when an unauthenticated
 * user taps a protected action (Submit, GPS Verify, Rate, Report, access code reveal).
 *
 * Never a full navigation redirect. Navigation on Sign In / Create Account is the
 * caller's responsibility (it alone knows the returnTo context to resume after auth).
 *
 * Swipe-to-dismiss is FORBIDDEN (design-system.md §16) — close only via "Cancel" or
 * the Android hardware back button (onRequestClose), both wired to onCancel.
 */

export type AuthRequiredAction = 'verify' | 'rate' | 'report' | 'submit' | 'see access code';

interface AuthRequiredModalProps {
  visible: boolean;
  action: AuthRequiredAction;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onCancel: () => void;
}

export default function AuthRequiredModal({
  visible,
  action,
  onSignIn,
  onCreateAccount,
  onCancel,
}: AuthRequiredModalProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Modal
      testID="auth-required-modal"
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onCancel}
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View
            style={[styles.dragHandle, { backgroundColor: colors.divider }]}
            accessibilityRole="adjustable"
            accessibilityLabel="Panel"
            accessibilityValue={{ text: 'collapsed' }}
          />
          <Text style={[styles.heading, { color: colors.textPrimary }]}>
            Sign in to {action}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign In"
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={onSignIn}
          >
            <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create Account"
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={onCreateAccount}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
              Create Account
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel — dismiss sign-in prompt"
            style={styles.ghostButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onCancel}
          >
            <Text style={[styles.ghostButtonLabel, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    alignItems: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
  },
  heading: {
    marginTop: spacing.lg,
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: spacing.xl,
    width: '100%',
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  secondaryButton: {
    marginTop: spacing.md,
    width: '100%',
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  ghostButton: {
    marginTop: spacing.md,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
});
