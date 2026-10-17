import React from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  AccessibilityInfo,
  Platform,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useSession } from '../../features/auth/useSession';
import { formatDistance, usesMilesForLocale } from '../../features/locations/formatDistance';
import type { GpsDenied, GpsSample } from '../../features/submit/types';
import { distanceMeters } from '../../features/verify/distance';
import { useVerify } from '../../features/verify/useVerify';
import {
  CANDIDATES_FRESH_MS,
  DISCOVERY_COOLDOWN_MS,
  useVerifyCandidates,
} from '../../features/verify/useVerifyCandidates';
import { getVerifyGpsSample } from '../../features/verify/useVerifyGpsSample';
import type { VerifyCandidate } from '../../features/verify/types';
import AuthRequiredModal from '../(components)/AuthRequiredModal';
import { rememberPostAuthReturn } from '../../features/auth/redirect';

/**
 * VerifyFlow — the "Verify Location" modal (plan 05-03, 05-UI-SPEC.md).
 *
 * One route, two modes: a list of nearby pending bathrooms, then a GPS check of the one
 * the user picks. Picking a row changes the mode in place; it never navigates.
 *
 * Verifying requires an account, so a signed-out user gets the inline sign-in prompt
 * (ERR-10) and nothing else mounts: no GPS read and no server call.
 */

// [LOCKED copy — verbatim from 05-UI-SPEC.md Copywriting Contract and wireframes.md
// "Verify Flow"; do not paraphrase]
const MODAL_TITLE = 'Verify Location';
const CTA_CANCEL = 'Cancel';
const CTA_IM_HERE = "I'm Here";
const CTA_DONE = 'Done';
const CTA_BACK_TO_LIST = 'Back to list';
const LIST_HEADING = 'Verify a bathroom nearby';
const CTA_RETRY = 'Retry';
const CTA_TRY_AGAIN = 'Try Again';
const CTA_OPEN_SETTINGS = 'Open settings';
const PERMISSION_OFF = "Location access is off. Turn on location so we can confirm you're here.";
const LOCATION_UNAVAILABLE = "We couldn't get your location. Check your connection and try again.";
const LIST_ERROR = "Couldn't load bathrooms to verify.";
const EMPTY_HEADING = 'Nothing to verify nearby';
const EMPTY_BODY =
  "There are no pending bathrooms within walking distance right now. When you're near a newly submitted spot, it'll show up here to verify.";
const ERR_02 = 'GPS accuracy too low — move to an open area and try again.';
const TOO_FAR = "You're too far away — need to be within 100m";
// ERR-09 (design-system §15). The ONLY sentence shown once the server has been asked:
// every refusal and every failed call maps to it, with no branch on the cause.
const ERR_09 = 'Unable to verify your location. Please try again.';
const SUCCESS_HEADING = 'Verified!';
const SUCCESS_BODY = 'Thanks for keeping data fresh.';

// Icon sizes from design-system §7.
const ICON_SIZE = 22;
const READOUT_ICON_SIZE = 16;
const SUCCESS_ICON_SIZE = 48;

// Advisory client pre-checks for "I'm Here". The server re-validates every one of them
// and is the only authority on whether a verification counts.
const MAX_ACCURACY_M = 50;
const MAX_DISTANCE_M = 100;
const MAX_FIX_AGE_MS = 60_000;

type ThemeColors = (typeof Colors)['light' | 'dark'];

/**
 * Speaks a status change on iOS. `accessibilityLiveRegion` is Android-only, so on iOS a
 * message that appears without a focus change is silent unless the app announces it.
 * Android reads the live region on the message itself and needs nothing here.
 */
function useIosAnnouncement(message: string | null) {
  React.useEffect(() => {
    if (message !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}

function rowAccessibilityLabel(candidate: VerifyCandidate, usesMiles: boolean): string {
  return `${candidate.name}. ${formatDistance(candidate.distanceM, usesMiles)}. Pending verification.`;
}

export default function VerifyScreen() {
  const router = useRouter();
  const session = useSession()?.session ?? null;
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  if (session === null) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AuthRequiredModal
          visible
          action="verify"
          onSignIn={() => {
            rememberPostAuthReturn('/verify');
            router.push('/(auth)/sign-in');
          }}
          onCreateAccount={() => {
            rememberPostAuthReturn('/verify');
            router.push('/(auth)/sign-up');
          }}
          onCancel={() => router.back()}
        />
      </View>
    );
  }

  // Keyed by account: a different user signing in starts a fresh flow, so a bathroom
  // selected under the previous account can never be shown or verified under this one.
  return <VerifyFlow key={session.user.id} userId={session.user.id} />;
}

function VerifyFlow({ userId }: { userId: string }) {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const usesMiles = usesMilesForLocale();
  const [selected, setSelected] = React.useState<VerifyCandidate | null>(null);

  // One GPS fix places the list. It is cached for as long as the list it produced, so
  // reopening the modal straight away reuses both instead of asking the server again:
  // every discovery call restarts a short server cooldown, and a call made inside it
  // returns no rows.
  const position = useQuery({
    queryKey: ['verifyListPosition', userId],
    queryFn: getVerifyGpsSample,
    staleTime: CANDIDATES_FRESH_MS,
    retry: false,
  });
  const listFix = position.isFetching ? undefined : position.data;
  const listCoords =
    listFix !== undefined && !('denied' in listFix)
      ? { userLat: listFix.coord.lat, userLng: listFix.coord.lng }
      : null;
  const candidates = useVerifyCandidates(listCoords);
  const rows = candidates.data ?? [];

  // Retry after a failed load waits out the server's discovery cooldown. The failed call
  // may still have reached the server and claimed the cooldown before its response was
  // lost, and a call inside the cooldown returns zero rows: an immediate retry could turn
  // a failure into a false "Nothing to verify nearby".
  const [retryWaiting, setRetryWaiting] = React.useState(false);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    },
    [],
  );
  const retryCandidates = () => {
    if (retryTimer.current !== null) return;
    const wait = Math.max(0, candidates.errorUpdatedAt + DISCOVERY_COOLDOWN_MS - Date.now());
    setRetryWaiting(true);
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      void candidates.refetch();
      setRetryWaiting(false);
    }, wait);
  };
  const listLoading = candidates.isFetching || retryWaiting;
  // Why there is no position to list from, when there is none.
  const permissionOff = listFix !== undefined && 'denied' in listFix;
  const locationProblem = permissionOff
    ? PERMISSION_OFF
    : position.isError && !position.isFetching
      ? LOCATION_UNAVAILABLE
      : null;

  // The list's outcome arrives without a focus change. Nothing is spoken from here while
  // one bathroom is being checked; that mode announces its own status.
  useIosAnnouncement(
    selected !== null
      ? null
      : (locationProblem ??
          (listLoading
            ? null
            : candidates.isError
              ? LIST_ERROR
              : candidates.isSuccess && rows.length === 0
                ? EMPTY_HEADING
                : null)),
  );

  const header = (
    <Stack.Screen
      options={{
        title: MODAL_TITLE,
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_CANCEL}
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Text style={[styles.headerButtonLabel, { color: colors.primary }]}>{CTA_CANCEL}</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (selected !== null) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {header}
        <VerifyCheck candidate={selected} colors={colors} onDone={() => router.back()} />
        {/* Wrong row, or another bathroom to verify: return to the list in place. */}
        <View style={styles.stateBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_BACK_TO_LIST}
            onPress={() => setSelected(null)}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
              {CTA_BACK_TO_LIST}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {header}

      <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
        {LIST_HEADING}
      </Text>

      {/* Finding the user and loading the list can each take seconds; say so. */}
      {(position.isFetching || listLoading) && (
        <View style={styles.stateBlock}>
          <View style={styles.statusRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Finding bathrooms near you…
            </Text>
          </View>
        </View>
      )}

      {/* No position is never a dead end: Try Again re-reads GPS, and when permission is
          the cause a second button opens settings. */}
      {locationProblem !== null && (
        <View style={styles.stateBlock}>
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <Ionicons
              name="warning-outline"
              size={ICON_SIZE}
              color={colors.warningAmber}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>{locationProblem}</Text>
          </View>
          {permissionOff && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open location settings"
              onPress={() => void Linking.openSettings()}
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
            >
              <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
                {CTA_OPEN_SETTINGS}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_TRY_AGAIN}
            onPress={() => void position.refetch()}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
              {CTA_TRY_AGAIN}
            </Text>
          </Pressable>
        </View>
      )}

      {/* A failed load is its own state with a way to try again; it must never look like
          the legitimate "nothing nearby" answer. */}
      {candidates.isError && !listLoading && (
        <View style={styles.stateBlock}>
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <Ionicons
              name="alert-circle"
              size={ICON_SIZE}
              color={colors.errorRed}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>{LIST_ERROR}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${CTA_RETRY} loading bathrooms to verify`}
            onPress={retryCandidates}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>{CTA_RETRY}</Text>
          </Pressable>
        </View>
      )}

      {candidates.isSuccess && rows.length === 0 && (
        // Android live region: the answer appears without a focus change (iOS is
        // covered by useIosAnnouncement above).
        <View style={styles.stateBlock} accessibilityLiveRegion="polite">
          <Text style={[styles.stateHeading, { color: colors.textPrimary }]}>{EMPTY_HEADING}</Text>
          <Text style={[styles.stateBody, { color: colors.textSecondary }]}>{EMPTY_BODY}</Text>
        </View>
      )}

      {rows.length > 0 && (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={rowAccessibilityLabel(item, usesMiles)}
              accessibilityHint="Checks your location against this bathroom"
              onPress={() => setSelected(item)}
              style={[styles.row, { borderBottomColor: colors.divider }]}
            >
              <Ionicons
                name="location-outline"
                size={ICON_SIZE}
                color={colors.primary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.rowSubhead, { color: colors.textSecondary }]}>
                  {`${formatDistance(item.distanceM, usesMiles)} · Pending`}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

/**
 * The GPS check for one bathroom. It reads its own fresh fix: the one that placed the
 * list may be several seconds old, and the server refuses a stale reading.
 */
function VerifyCheck({
  candidate,
  colors,
  onDone,
}: {
  candidate: VerifyCandidate;
  colors: ThemeColors;
  onDone: () => void;
}) {
  const [sample, setSample] = React.useState<GpsSample | GpsDenied | null>(null);
  const [reading, setReading] = React.useState(true);
  const [readFailed, setReadFailed] = React.useState(false);
  const verify = useVerify();

  const readGps = React.useCallback(async () => {
    setReading(true);
    setReadFailed(false);
    try {
      setSample(await getVerifyGpsSample());
    } catch {
      setSample(null);
      setReadFailed(true);
    } finally {
      setReading(false);
    }
  }, []);

  React.useEffect(() => {
    void readGps();
  }, [readGps]);

  const fix = sample !== null && !('denied' in sample) ? sample : null;
  // Why there is no reading to check, when there is none.
  const permissionOff = sample !== null && 'denied' in sample;
  const locationProblem = permissionOff ? PERMISSION_OFF : readFailed ? LOCATION_UNAVAILABLE : null;
  const distanceM = fix !== null ? distanceMeters(fix.coord, candidate) : null;
  const accuracyOk = fix !== null && fix.accuracy !== null && fix.accuracy <= MAX_ACCURACY_M;
  const ready = accuracyOk && distanceM !== null && distanceM <= MAX_DISTANCE_M;
  // Advisory guidance, computed on the device before anything is sent. Saying "too far"
  // or "accuracy too low" here tells the user nothing the server decided.
  const guidance = fix === null || ready ? null : !accuracyOk ? ERR_02 : TOO_FAR;
  // Every refusal and every failure of the call is the same state. There is no reason to
  // read and no branch on one: a mock-location refusal must look like any other (SC7).
  const rejected = verify.isError || (verify.isSuccess && !verify.data.accepted);
  const accepted = verify.isSuccess && verify.data.accepted;
  const canSubmit = ready && !reading && !verify.isPending && !rejected;

  useIosAnnouncement(
    accepted
      ? `${SUCCESS_HEADING} ${SUCCESS_BODY}`
      : rejected
        ? ERR_09
        : reading
          ? null
          : (locationProblem ?? guidance),
  );

  function handleImHere() {
    if (fix === null || !canSubmit) return;
    // The server refuses an old reading, and a refusal costs the user a cooldown. If the
    // user waited on this screen, read again rather than send it.
    if (Date.now() - fix.timestamp > MAX_FIX_AGE_MS) {
      void readGps();
      return;
    }
    verify.mutate({
      submissionId: candidate.id,
      lat: fix.coord.lat,
      lng: fix.coord.lng,
      accuracy: fix.accuracy,
      mocked: fix.mocked,
      timestamp: fix.timestamp,
    });
  }

  if (accepted) {
    return (
      // Android live region: success replaces the check without a focus change (iOS is
      // covered by useIosAnnouncement).
      <View style={styles.successBlock} accessibilityLiveRegion="polite">
        {/* A static mark: the reduced-motion alternative is the only version built. */}
        <Ionicons
          name="checkmark-circle"
          size={SUCCESS_ICON_SIZE}
          color={colors.successGreen}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text accessibilityRole="header" style={[styles.candidateName, { color: colors.textPrimary }]}>
          {SUCCESS_HEADING}
        </Text>
        <Text style={[styles.successBody, { color: colors.textSecondary }]}>{SUCCESS_BODY}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CTA_DONE}
          onPress={onDone}
          style={[styles.primaryButton, styles.successCta, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>{CTA_DONE}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.checkBlock}>
      <Text accessibilityRole="header" style={[styles.candidateName, { color: colors.textPrimary }]}>
        {candidate.name}
      </Text>

      {reading && (
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Reading your location…
          </Text>
        </View>
      )}

      {!reading && fix !== null && distanceM !== null && (
        <View>
          {fix.accuracy !== null && (
            <View style={styles.statusRow}>
              <Ionicons
                name={accuracyOk ? 'checkmark-circle' : 'warning-outline'}
                size={READOUT_ICON_SIZE}
                color={accuracyOk ? colors.successGreen : colors.warningAmber}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Text style={[styles.statusText, { color: colors.textPrimary }]}>
                {`Accuracy: ${Math.round(fix.accuracy)}m`}
              </Text>
            </View>
          )}
          <Text style={[styles.distanceText, { color: colors.textPrimary }]}>
            {`You are ${Math.round(distanceM)}m away`}
          </Text>
        </View>
      )}

      {/* No reading is never a dead end: Try Again reads GPS again, and when permission
          is the cause a second button opens settings. */}
      {!reading && locationProblem !== null && (
        <View>
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <Ionicons
              name="warning-outline"
              size={READOUT_ICON_SIZE}
              color={colors.warningAmber}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>{locationProblem}</Text>
          </View>
          {permissionOff && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open location settings"
              onPress={() => void Linking.openSettings()}
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
            >
              <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
                {CTA_OPEN_SETTINGS}
              </Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_TRY_AGAIN}
            onPress={() => void readGps()}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
              {CTA_TRY_AGAIN}
            </Text>
          </Pressable>
        </View>
      )}

      {!reading && guidance !== null && (
        <View>
          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            <Ionicons
              name="warning-outline"
              size={READOUT_ICON_SIZE}
              color={colors.warningAmber}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>{guidance}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_TRY_AGAIN}
            onPress={() => void readGps()}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
              {CTA_TRY_AGAIN}
            </Text>
          </Pressable>
        </View>
      )}

      {rejected && (
        <View>
          <View style={styles.statusRow} accessibilityLiveRegion="assertive">
            <Ionicons
              name="alert-circle"
              size={READOUT_ICON_SIZE}
              color={colors.errorRed}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>{ERR_09}</Text>
          </View>
          {/* Recovery re-reads GPS. It does not re-send: the user confirms again. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_TRY_AGAIN}
            onPress={() => {
              verify.reset();
              void readGps();
            }}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
              {CTA_TRY_AGAIN}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CTA_IM_HERE}
        accessibilityState={{ disabled: !canSubmit, busy: verify.isPending }}
        disabled={!canSubmit}
        onPress={handleImHere}
        style={[
          styles.primaryButton,
          { backgroundColor: canSubmit || verify.isPending ? colors.primary : colors.border },
        ]}
      >
        {verify.isPending ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text
            style={[
              styles.primaryButtonLabel,
              { color: canSubmit ? colors.textInverse : colors.textDisabled },
            ]}
          >
            {CTA_IM_HERE}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonLabel: {
    ...typography.body,
  },
  heading: {
    ...typography.h2,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  stateBlock: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  stateHeading: {
    ...typography.h3,
  },
  stateBody: {
    ...typography.body,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  statusText: {
    ...typography.body,
    flex: 1,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
  secondaryButtonLabel: {
    ...typography.bodyMedium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    ...typography.h3,
  },
  rowSubhead: {
    ...typography.subhead,
  },
  checkBlock: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    gap: spacing.xxl,
  },
  candidateName: {
    ...typography.h2,
  },
  distanceText: {
    ...typography.bodyMedium,
    marginTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
  },
  primaryButtonLabel: {
    ...typography.bodyMedium,
  },
  successBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xxxl,
    gap: spacing.base,
  },
  successBody: {
    ...typography.body,
    textAlign: 'center',
  },
  successCta: {
    alignSelf: 'stretch',
    marginTop: spacing.base,
  },
});
