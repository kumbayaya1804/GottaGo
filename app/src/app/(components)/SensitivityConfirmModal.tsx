import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';

// [LOCKED D-15] — verbatim from 04-UI-SPEC.md Destructive-actions matrix; do not paraphrase.
const SENSITIVITY_CONFIRM_BODY = 'This location will be hidden from Family mode users';

interface SensitivityConfirmModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * D-15 confirm-before-submit dialog. Fires on the Step-3 final submit only when the
 * `access_sensitivity` switch is ON, forcing a conscious acknowledgement before the
 * location is hidden from Family-mode users (T-04-19).
 *
 * Copies DeleteAccountModal's scrim+card skeleton (reset-on-open effect; explicit
 * Cancel; `onRequestClose` no-op so the Android back button can't silently dismiss).
 * Unlike DeleteAccountModal this dialog is NON-destructive (confirm uses `primary`,
 * not `emergency`) and performs no network call itself — the caller owns the RPC — so
 * it needs no `submittingRef` re-entrancy guard.
 */
export default function SensitivityConfirmModal({
  visible,
  onConfirm,
  onCancel,
}: SensitivityConfirmModalProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  // Re-entrancy guard against a double-tap firing onConfirm twice before the parent
  // unmounts/re-renders the dialog closed. Reset every time the modal (re)opens.
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (visible) setConfirmed(false);
  }, [visible]);

  function handleConfirm() {
    if (confirmed) return;
    setConfirmed(true);
    onConfirm();
  }

  return (
    <Modal
      testID="sensitivity-confirm-modal"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Hide from Family mode?</Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.body, { color: colors.textSecondary }]}
          >
            {SENSITIVITY_CONFIRM_BODY}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm — hide from Family mode"
            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
            onPress={handleConfirm}
          >
            <Text style={[styles.confirmButtonLabel, { color: colors.textInverse }]}>Confirm</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  card: {
    width: '100%',
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    lineHeight: typography.h2.lineHeight,
  },
  body: {
    marginTop: spacing.base,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  confirmButton: {
    marginTop: spacing.xl,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonLabel: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
  },
  ghostButton: {
    marginTop: spacing.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
});
