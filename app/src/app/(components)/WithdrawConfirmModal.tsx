import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { withdrawSubmission } from '../../features/submit/withdrawSubmission';

/**
 * D-30 confirm-before-withdraw dialog for the submitter-only PendingStatusSheet.
 *
 * Mirrors DeleteAccountModal's scrim + card + destructive-confirm + Cancel structure
 * and its synchronous `submittingRef` re-entrancy guard (a `submitting` state check
 * alone can't stop two presses dispatched before the first re-render commits). Swipe /
 * hardware-back dismiss is FORBIDDEN on a destructive confirm (design-system.md §16) —
 * `onRequestClose` is a no-op, close only via explicit Cancel.
 *
 * On confirm this calls the server-scoped `withdraw_submission` RPC (04-01 enforces
 * `submitter_id = auth.uid()`, T-04-21 — this UI cannot withdraw another user's pin) and,
 * only on success, calls `onWithdrawn` so the caller invalidates the pending query and the
 * pin disappears from the map entirely (D-29). On failure it shows inline error copy and
 * does NOT call `onWithdrawn`.
 */

// [LOCKED — 04-UI-SPEC.md Destructive actions / D-30] verbatim, do not paraphrase.
const WITHDRAW_CONFIRM_COPY = "Are you sure? This can't be undone";
const WITHDRAW_FAILURE_COPY =
  "Couldn't withdraw your submission. Check your connection and try again.";
const WITHDRAW_CONFIRM_LABEL = 'Withdraw';

interface WithdrawConfirmModalProps {
  visible: boolean;
  /** The submitter's own pending submission id to withdraw, or null when none is selected. */
  submissionId: string | null;
  onCancel: () => void;
  /** Called only after a successful withdraw so the caller can invalidate the pending query. */
  onWithdrawn: () => void;
}

export default function WithdrawConfirmModal({
  visible,
  submissionId,
  onCancel,
  onWithdrawn,
}: WithdrawConfirmModalProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const submittingRef = useRef(false);

  // Reset transient submit/error state every time the dialog (re)opens so a prior failed
  // attempt never carries over — the modal stays mounted, only `visible` toggles.
  useEffect(() => {
    if (visible) {
      setSubmitting(false);
      setError(false);
      submittingRef.current = false;
    }
  }, [visible]);

  async function handleWithdraw() {
    if (submittingRef.current || submissionId === null) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(false);
    try {
      await withdrawSubmission(submissionId);
      onWithdrawn();
    } catch {
      setError(true);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal
      testID="withdraw-confirm-modal"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {WITHDRAW_CONFIRM_COPY}
          </Text>
          {error && (
            <Text
              accessibilityLiveRegion="assertive"
              style={[styles.errorText, { color: colors.errorRed }]}
            >
              {WITHDRAW_FAILURE_COPY}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Withdraw submission — permanent"
            accessibilityState={{ disabled: submitting }}
            accessibilityHint="This permanently withdraws your pending submission"
            disabled={submitting}
            style={[
              styles.destructiveButton,
              { backgroundColor: submitting ? colors.border : colors.emergency },
            ]}
            onPress={handleWithdraw}
          >
            <Text
              style={[
                styles.destructiveButtonLabel,
                { color: submitting ? colors.textDisabled : colors.textInverse },
              ]}
            >
              {WITHDRAW_CONFIRM_LABEL}
            </Text>
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
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
    textAlign: 'center',
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  destructiveButton: {
    marginTop: spacing.xl,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButtonLabel: {
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
