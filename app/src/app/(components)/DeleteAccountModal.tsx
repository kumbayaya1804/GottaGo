import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '../../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { deleteAccount } from '../../features/profile/deleteAccount';

const DELETE_FAILURE_COPY = "Couldn't delete your account. Check your connection and try again.";
const CONFIRM_TOKEN = 'DELETE';

interface DeleteAccountModalProps {
  visible: boolean;
  onCancel: () => void;
}

/**
 * Account deletion confirmation modal (Settings → "Delete Account").
 *
 * Swipe-to-dismiss and the Android hardware back button are both disabled —
 * "explicit Cancel only" per design-system.md §16. deleteAccount() does not
 * navigate on success; the SIGNED_OUT auth event it triggers is already
 * handled by SessionProvider/root guard.
 */
export default function DeleteAccountModal({ visible, onCancel }: DeleteAccountModalProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  // Synchronous re-entrancy guard: a `submitting` state check alone can't stop two
  // presses dispatched before React commits the first one's re-render (both closures
  // would read the same stale `submitting` value) — a ref mutates immediately instead.
  const submittingRef = useRef(false);

  // Reset confirmation state every time the modal is (re)opened so a prior "DELETE"
  // entry or stale error never carries over — the modal stays mounted in profile.tsx,
  // only `visible` toggles (T-02-03: this gate must require a fresh confirmation).
  useEffect(() => {
    if (visible) {
      setConfirmText('');
      setError(false);
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [visible]);

  const canDelete = confirmText === CONFIRM_TOKEN;

  async function handleDelete() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(false);
    try {
      await deleteAccount();
    } catch {
      setError(true);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal
      testID="delete-account-modal"
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Delete Account</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            This will permanently delete your account. Your contributions to the community will
            remain but your identity will be removed.
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Type DELETE to confirm"
            placeholderTextColor={colors.textDisabled}
            accessibilityLabel="Type DELETE to confirm"
            autoCapitalize="none"
            autoCorrect={false}
            value={confirmText}
            onChangeText={setConfirmText}
          />
          {error && (
            <Text
              accessibilityLiveRegion="assertive"
              style={[styles.errorText, { color: colors.errorRed }]}
            >
              {DELETE_FAILURE_COPY}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete Account — permanent"
            accessibilityState={{ disabled: !canDelete || submitting }}
            accessibilityHint="This will permanently delete your account"
            disabled={!canDelete || submitting}
            style={[
              styles.destructiveButton,
              {
                backgroundColor: !canDelete || submitting ? colors.border : colors.emergency,
              },
            ]}
            onPress={handleDelete}
          >
            <Text
              style={[
                styles.destructiveButtonLabel,
                { color: !canDelete || submitting ? colors.textDisabled : colors.textInverse },
              ]}
            >
              Delete Account
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
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    lineHeight: typography.h2.lineHeight,
  },
  body: {
    marginTop: spacing.xl,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  input: {
    marginTop: spacing.xl,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.base,
    fontSize: typography.body.fontSize,
  },
  errorText: {
    marginTop: spacing.sm,
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
