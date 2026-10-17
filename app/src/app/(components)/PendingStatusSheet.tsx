import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  AccessibilityInfo,
  Platform,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import type { PendingSubmissionProperties, UnseenPublication } from '../../features/submit/types';
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
 *
 * It also shows the "Published!" resolution (D-68). The pending query drops a submission
 * the moment it publishes, so that state comes from a separate `publication` prop and
 * never from `submission`. It is the in-app way the creator learns the outcome, whether
 * or not a push notification arrived.
 */

// A location publishes after 2 independent GPS verifications (PROJECT data-integrity
// constraint / D-27). The progress copy renders `confirmationCount` against this.
export const PUBLISH_THRESHOLD = 2;

// [LOCKED — 04-UI-SPEC.md] verbatim copy; the count is dynamic, the rest is not paraphrasable.
const PENDING_BADGE = 'Pending';
const WITHDRAW_CTA = 'Withdraw submission';
// [05-UI-SPEC.md Copywriting Contract] verbatim.
const PUBLISHED_HEADING = 'Published!';
const PUBLISHED_BODY =
  'Your bathroom is now live on the map. Thanks for helping people find a place to go.';
const PUBLISHED_DONE = 'Done';

const PUBLISHED_ICON_SIZE = 22; // design-system §7

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
  /**
   * One of the owner's submissions that has published and that they have not been shown
   * yet, or null. Shown in place of `submission` when both are set.
   */
  publication?: UnseenPublication | null;
  /** Called with the submission id when the owner taps Done on the Published state. */
  onPublicationSeen?: (submissionId: string) => void;
}

export default function PendingStatusSheet({
  submission,
  onDismiss,
  onWithdrawn,
  publication = null,
  onPublicationSeen,
}: PendingStatusSheetProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['30%', '55%'], []);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const isOpen = submission !== null || publication !== null;
  const publishedId = publication?.submissionId ?? null;

  // Open to peek when there is something to show; close (animate out) when cleared, and
  // drop any open confirm dialog so it never lingers over a dismissed sheet. A new
  // publication re-opens it too: swiping one away can move straight to the next unseen
  // one while `isOpen` stays true, and without this the next would render into the sheet
  // the swipe just closed, with no visible way to acknowledge it.
  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
      setConfirmVisible(false);
    }
  }, [isOpen, publishedId]);

  // The sheet slides up without taking focus, and iOS has no live regions, so the news
  // is spoken there. Android reads the live region on the heading row.
  useEffect(() => {
    if (publishedId !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(`${PUBLISHED_HEADING} ${PUBLISHED_BODY}`);
    }
  }, [publishedId]);

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

  if (publication !== null) {
    return (
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
          {/* Status is words plus a mark, never color alone (design-system §18.4). */}
          <View style={styles.publishedHeadingRow} accessibilityLiveRegion="polite">
            <Ionicons
              name="checkmark-circle"
              size={PUBLISHED_ICON_SIZE}
              color={colors.successGreen}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text accessibilityRole="header" style={[styles.name, { color: colors.textPrimary }]}>
              {PUBLISHED_HEADING}
            </Text>
          </View>
          <Text style={[styles.publishedName, { color: colors.textPrimary }]}>
            {publication.name}
          </Text>
          <Text style={[styles.body, { color: colors.textPrimary }]}>{PUBLISHED_BODY}</Text>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={PUBLISHED_DONE}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => onPublicationSeen?.(publication.submissionId)}
            >
              <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>
                {PUBLISHED_DONE}
              </Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  }

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
  publishedHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  publishedName: {
    marginTop: spacing.sm,
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: typography.bodyMedium.fontWeight,
    lineHeight: typography.bodyMedium.lineHeight,
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
  primaryButton: {
    flex: 1,
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
