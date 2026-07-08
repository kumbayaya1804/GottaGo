import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import type { PendingSubmissionProperties } from '../../features/submit/types';
import WithdrawConfirmModal from './WithdrawConfirmModal';

/**
 * Submitter-only pending-status bottom sheet (D-26 / D-27). Opened when the map's
 * SEPARATE pending `ShapeSource` pin is tapped — NOT the published LocationDetailSheet.
 *
 * Reuses LocationDetailSheet's BottomSheet/BottomSheetView scaffold and snapPoints, but
 * renders verification PROGRESS (a dynamic 'N of 2' count from the tapped feature's
 * `confirmationCount`, read straight off the map data — no second fetch, D-27) instead of
 * the published badge/hours/directions block. There is NO Rate/Report/Directions row: a
 * pending submission is not yet a published, navigable location.
 *
 * The one action is the destructive 'Withdraw submission' CTA (D-28, `colors.emergency`)
 * which opens the D-30 confirm dialog. Withdrawal is server-scoped (WithdrawConfirmModal →
 * `withdraw_submission`); on success this calls `onWithdrawn` so the caller invalidates the
 * pending query and the pin disappears from the map entirely (D-29). No access code or any
 * signed-in-only value is ever shown here.
 */

// A location publishes after 2 independent GPS verifications (PROJECT data-integrity
// constraint / D-27). The progress copy renders `confirmationCount` against this.
export const PUBLISH_THRESHOLD = 2;

// [LOCKED — 04-UI-SPEC.md] verbatim copy; the count is dynamic, the rest is not paraphrasable.
const PENDING_BADGE = 'Pending';
const WITHDRAW_CTA = 'Withdraw submission';

/** LOCKED verification-progress body (D-27) — only the leading count is dynamic. */
function progressCopy(confirmationCount: number): string {
  return `Pending — ${confirmationCount} of ${PUBLISH_THRESHOLD} GPS verifications received. Share with friends to speed up verification.`;
}

export interface PendingStatusSheetProps {
  /** The tapped pending feature's properties, or null when the sheet is closed. */
  submission: PendingSubmissionProperties | null;
  /** Called when the sheet is dismissed by gesture (index returns to -1). */
  onDismiss: () => void;
  /** Called after a successful withdraw so the caller invalidates ['pendingSubmissions', uid]. */
  onWithdrawn: () => void;
}

export default function PendingStatusSheet({
  submission,
  onDismiss,
  onWithdrawn,
}: PendingStatusSheetProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%', '55%'], []);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Open to peek when a pending pin is selected; close (animate out) when cleared, and
  // drop any open confirm dialog so it never lingers over a dismissed sheet.
  useEffect(() => {
    if (submission !== null) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
      setConfirmVisible(false);
    }
  }, [submission]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1) onDismiss();
    },
    [onDismiss],
  );

  const handleWithdrawn = useCallback(() => {
    setConfirmVisible(false);
    onWithdrawn();
  }, [onWithdrawn]);

  if (submission === null) return null;

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleChange}
        backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.md }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView style={styles.content}>
          <View
            accessibilityRole="summary"
            accessibilityLabel={`Pending submission ${submission.name}`}
          >
            <Text style={[styles.name, { color: colors.textPrimary }]}>{submission.name}</Text>

            {/* Status conveyed by text + token color (never color-only), design-system §18.4. */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.pinPending }]}>
                <Text style={[styles.badgeText, { color: colors.textInverse }]}>
                  {PENDING_BADGE}
                </Text>
              </View>
            </View>

            <Text style={[styles.body, { color: colors.textPrimary }]}>
              {progressCopy(submission.confirmationCount)}
            </Text>

            {/* Only action on a pending submission: withdraw (destructive). No Rate/Report/Directions. */}
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={WITHDRAW_CTA}
                accessibilityHint="Opens a confirmation before withdrawing your pending submission"
                style={[styles.destructiveButton, { backgroundColor: colors.emergency }]}
                onPress={() => setConfirmVisible(true)}
              >
                <Text style={[styles.destructiveButtonLabel, { color: colors.textInverse }]}>
                  {WITHDRAW_CTA}
                </Text>
              </Pressable>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>

      <WithdrawConfirmModal
        visible={confirmVisible}
        submissionId={submission.id}
        onCancel={() => setConfirmVisible(false)}
        onWithdrawn={handleWithdrawn}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  name: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    lineHeight: typography.h2.lineHeight,
  },
  badgeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
  },
  body: {
    marginTop: spacing.lg,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  actionRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
  },
  destructiveButton: {
    flex: 1,
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
});
