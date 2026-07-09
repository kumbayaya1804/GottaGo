import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useSession } from '../../features/auth/useSession';
import { submitSchema, type SubmitSchema } from '../../features/submit/submitSchema';
import { getGpsSample } from '../../features/submit/useGpsSample';
import { submitLocation } from '../../features/submit/submitLocation';
import type { GpsSample, GpsDenied, SubmitInput } from '../../features/submit/types';
import AuthRequiredModal from '../(components)/AuthRequiredModal';
import SensitivityConfirmModal from '../(components)/SensitivityConfirmModal';

/**
 * SubmitFlow — the 3-step "Add a Bathroom" wizard (04-05, ROADMAP SC8) plus the
 * Success screen. Composed from shipped patterns (FilterChipRow segmented visuals,
 * sign-up RHF field layout, DeleteAccountModal confirm skeleton, AuthRequiredModal
 * gate) — no single multi-step analog existed.
 *
 * The whole wizard is auth-gated from the start (D-18): a signed-out user sees the
 * AuthRequiredModal and the form never mounts. Coordinates come exclusively from the
 * Step-3 GPS fix (D-05); the address field is a free-text label only (D-04) — Google
 * Places autocomplete is DEFERRED (OQ-1), no autocomplete package is imported.
 *
 * Component Acceptance Checklist: design-system.md §20 (ROADMAP SC10) — walked for
 * this screen at the Task-3 device checkpoint.
 */

// [LOCKED copy — verbatim from 04-UI-SPEC.md Copywriting Contract; do not paraphrase]
const CTA_NEXT = 'Next →';
const CTA_BACK = 'Back';
const CTA_AT_LOCATION = "I'm at This Location"; // wireframes.md #14
const CTA_BACK_TO_MAP = 'Back to Map'; // wireframes.md #15
const CTA_RETRY = 'Retry';
const SENSITIVITY_LABEL = 'Not suitable for kids'; // D-10
const SENSITIVITY_EXPLAINER = 'Hides this location from users who have Family mode enabled.'; // D-12
const PIN_LABEL = 'Door code (optional) — only shown to signed-in users'; // D-19
const ADDRESS_AFFORDANCE = 'No address? Describe the location instead'; // D-04
const SUCCESS_HEADING = 'Location Submitted!'; // wireframes.md #15
const SUCCESS_BODY =
  "It'll appear publicly after 2 GPS verifications. You can see it on the map now."; // wireframes.md #15
// [LOCKED error matrix — design-system.md §15 / 04-UI-SPEC.md; map the RPC's generic
// rejection to these friendly strings only — never surface the specific reason (SC7).]
const ERR_01 = "We can't find your location. Use search to browse bathrooms near an address.";
const ERR_02 = 'GPS accuracy too low — move to an open area and try again.';
const ERR_03 = 'GPS fix is stale — wait a moment and retry.';
const ERR_08 = "Couldn't submit your location. Check your connection and try again.";

// GPS confirm thresholds (advisory client pre-checks; the RPC re-validates, Pitfall 1).
const MAX_ACCURACY_M = 50;
const MAX_FIX_AGE_MS = 60_000;

/** Flatten the wizard form + GPS sample into the `submitLocation` payload (D-05/D-17). */
function buildInput(values: SubmitSchema, sample: GpsSample): SubmitInput {
  return {
    name: values.name,
    lat: sample.coord.lat,
    lng: sample.coord.lng,
    accuracy: sample.accuracy,
    mocked: sample.mocked,
    timestamp: sample.timestamp,
    policyTag: values.policyTag,
    address: values.address || null,
    sensitive: values.accessSensitivity,
    hours: values.hours ?? null,
    accessCode: values.accessCode || null,
    timingTip: values.timingTip || null,
  };
}

type PolicyTag = SubmitSchema['policyTag'];

const POLICY_OPTIONS: readonly { value: PolicyTag; label: string }[] = [
  { value: 'chill_spot', label: 'Chill Spot' },
  { value: 'purchase_required', label: 'Purchase Required' },
  { value: 'code_required', label: 'Code Required' },
  { value: 'public_facility', label: 'Public Facility' },
];

/**
 * Accessibility toggles are captured in the UI to honor the Step-1 surface inventory,
 * but are NOT yet forwarded on submit: the 04-03 `submit_location` RPC / `SubmitInput`
 * expose no accessibility parameters this phase. Tracked as a deferred item (SUMMARY).
 */
const ACCESSIBILITY_OPTIONS = [
  { key: 'changing', label: 'Changing table' },
  { key: 'wheelchair', label: 'Wheelchair accessible' },
] as const;

type WizardStep = 1 | 2 | 3 | 'success';

export default function SubmitScreen() {
  const router = useRouter();
  const sessionCtx = useSession();
  const session = sessionCtx?.session ?? null;
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  const [step, setStep] = useState<WizardStep>(1);
  const [describeMode, setDescribeMode] = useState(false);
  const [accessibility, setAccessibility] = useState<Record<string, boolean>>({});
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [sample, setSample] = useState<GpsSample | GpsDenied | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const submittingRef = useRef(false);

  const {
    control,
    trigger,
    watch,
    getValues,
    formState: { errors },
  } = useForm<SubmitSchema>({
    // `accessSensitivity` has a zod `.default(false)`, so the schema's INPUT type marks
    // it optional while the OUTPUT (SubmitSchema) marks it required — RHF is generic over
    // the output type, so the resolver's input-typed signature needs this cast bridge.
    resolver: zodResolver(submitSchema) as Resolver<SubmitSchema>,
    defaultValues: {
      name: '',
      address: '',
      accessSensitivity: false,
      accessCode: '',
      timingTip: '',
    },
  });

  const policyTag = watch('policyTag');

  const mutation = useMutation({
    mutationFn: (input: SubmitInput) => submitLocation(input),
    onSuccess: () => setStep('success'),
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  // Read a single high-accuracy GPS fix (SC1). Re-runnable for the ERR-03 stale Retry.
  const loadSample = useCallback(async () => {
    setGpsLoading(true);
    try {
      setSample(await getGpsSample());
    } finally {
      setGpsLoading(false);
    }
  }, []);

  // Fetch the fix on entering Step 3 (only if one isn't already loaded).
  useEffect(() => {
    if (step === 3 && sample === null && !gpsLoading) {
      void loadSample();
    }
  }, [step, sample, gpsLoading, loadSample]);

  // D-18: the entire wizard requires sign-in from the start. Render the inline
  // AuthRequiredModal gate (never a hard redirect) and do NOT mount the form.
  if (session === null) {
    return (
      <View style={[styles.gateContainer, { backgroundColor: colors.background }]}>
        <AuthRequiredModal
          visible
          action="submit"
          onSignIn={() => router.push('/(auth)/sign-in')}
          onCreateAccount={() => router.push('/(auth)/sign-up')}
          onCancel={() => router.replace('/(tabs)')}
        />
      </View>
    );
  }

  async function goToStep2() {
    const ok = await trigger(['name', 'policyTag']);
    if (ok) setStep(2);
  }

  async function goToStep3() {
    const ok = await trigger(['hours', 'accessCode', 'timingTip']);
    if (ok) setStep(3);
  }

  // Derived GPS state. `sample` is the denied sentinel, a real fix, or null (loading).
  const isDenied = sample !== null && 'denied' in sample;
  const gpsSample = sample !== null && !('denied' in sample) ? sample : null;
  const isStale = gpsSample !== null && Date.now() - gpsSample.timestamp > MAX_FIX_AGE_MS;
  const accuracyPoor =
    gpsSample !== null && gpsSample.accuracy !== null && gpsSample.accuracy > MAX_ACCURACY_M;
  const gpsValid =
    gpsSample !== null &&
    gpsSample.accuracy !== null &&
    gpsSample.accuracy <= MAX_ACCURACY_M &&
    !gpsSample.mocked &&
    !isStale;

  function doSubmit() {
    setConfirmVisible(false);
    if (gpsSample === null || submittingRef.current) return;
    submittingRef.current = true;
    mutation.mutate(buildInput(getValues(), gpsSample));
  }

  // On the 56pt CTA: fire the D-15 confirm dialog first if sensitivity is ON (T-04-19),
  // otherwise submit directly. The CTA is already gated on `gpsValid` via `disabled`.
  function handleAtLocationPress() {
    if (!gpsValid) return;
    if (getValues('accessSensitivity')) {
      setConfirmVisible(true);
    } else {
      doSubmit();
    }
  }

  const progressDots = [1, 2, 3];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Progress indicator ①────○────○ — done/active use `primary`, upcoming `border`. */}
      <View style={styles.progressRow} accessibilityLabel={`Step ${step === 'success' ? 3 : step} of 3`}>
        {progressDots.map((dot, i) => {
          const active = step !== 'success' && dot <= step;
          return (
            <React.Fragment key={dot}>
              {i > 0 && (
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: active ? colors.primary : colors.border },
                  ]}
                />
              )}
              <View
                style={[
                  styles.progressDot,
                  { backgroundColor: active ? colors.primary : colors.border },
                ]}
              />
            </React.Fragment>
          );
        })}
      </View>

      {step === 1 && (
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Add a Bathroom</Text>

          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Name</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <TextInput
                accessibilityLabel="Name"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                placeholder="e.g. Corner Cafe restroom"
                placeholderTextColor={colors.textDisabled}
                value={value ?? ''}
                onChangeText={onChange}
              />
            )}
          />
          {errors.name?.message && (
            <Text style={[styles.fieldError, { color: colors.errorRed }]}>{errors.name.message}</Text>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Address</Text>
          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, value } }) => (
              <TextInput
                accessibilityLabel={describeMode ? 'Describe the location' : 'Address'}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                placeholder={describeMode ? 'Describe the location (e.g. behind the gas station)' : 'Street address'}
                placeholderTextColor={colors.textDisabled}
                multiline={describeMode}
                value={value ?? ''}
                onChangeText={onChange}
              />
            )}
          />
          {/* D-04: free-text affordance — coordinates always come from GPS (D-05), so
              this is a label-only convenience; no autocomplete this phase (OQ-1). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ADDRESS_AFFORDANCE}
            onPress={() => setDescribeMode((m) => !m)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.textLink, { color: colors.primary }]}>{ADDRESS_AFFORDANCE}</Text>
          </Pressable>

          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Policy:</Text>
          <Controller
            control={control}
            name="policyTag"
            render={({ field: { onChange, value } }) => (
              <View style={styles.segmentGroup}>
                {POLICY_OPTIONS.map((opt) => {
                  const selected = value === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}
                      accessibilityState={{ selected }}
                      onPress={() => onChange(opt.value)}
                      style={[
                        styles.segment,
                        {
                          backgroundColor: selected ? colors.primary : colors.surface,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentLabel,
                          { color: selected ? colors.textInverse : colors.textPrimary },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
          {errors.policyTag?.message && (
            <Text style={[styles.fieldError, { color: colors.errorRed }]}>Select a policy.</Text>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Accessibility:</Text>
          {ACCESSIBILITY_OPTIONS.map((opt) => {
            const checked = !!accessibility[opt.key];
            return (
              <Pressable
                key={opt.key}
                accessibilityRole="checkbox"
                accessibilityLabel={opt.label}
                accessibilityState={{ checked }}
                onPress={() => setAccessibility((a) => ({ ...a, [opt.key]: !checked }))}
                style={styles.checkboxRow}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    {
                      borderColor: checked ? colors.primary : colors.border,
                      backgroundColor: checked ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {checked && (
                    <Text style={[styles.checkboxTick, { color: colors.textInverse }]}>✓</Text>
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
              </Pressable>
            );
          })}

          {/* D-13: sensitivity is an RN Switch (visually distinct from the policy
              segmented picker), with the D-12 declarative-effect explainer beneath. */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextGroup}>
              <Text style={[styles.body, { color: colors.textPrimary }]}>{SENSITIVITY_LABEL}</Text>
              <Text style={[styles.subhead, { color: colors.textSecondary }]}>
                {SENSITIVITY_EXPLAINER}
              </Text>
            </View>
            <Controller
              control={control}
              name="accessSensitivity"
              render={({ field: { onChange, value } }) => (
                <Switch
                  accessibilityLabel={SENSITIVITY_LABEL}
                  accessibilityState={{ checked: !!value }}
                  value={!!value}
                  onValueChange={onChange}
                  trackColor={{ true: colors.primary }}
                />
              )}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_NEXT}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={goToStep2}
          >
            <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>{CTA_NEXT}</Text>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Access & Hours</Text>

          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Hours:</Text>
          <Controller
            control={control}
            name="hours"
            render={({ field: { onChange, value } }) => (
              <TextInput
                accessibilityLabel="Hours"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                placeholder="e.g. Open 7am–10pm"
                placeholderTextColor={colors.textDisabled}
                maxLength={200}
                value={value ?? ''}
                onChangeText={onChange}
              />
            )}
          />
          {errors.hours?.message && (
            <Text style={[styles.fieldError, { color: colors.errorRed }]}>{errors.hours.message}</Text>
          )}

          {/* D-17: PIN field renders ONLY for the code_required policy. */}
          {policyTag === 'code_required' && (
            <View>
              <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Door code</Text>
              <Controller
                control={control}
                name="accessCode"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    accessibilityLabel={PIN_LABEL}
                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                    placeholder="1234"
                    placeholderTextColor={colors.textDisabled}
                    maxLength={100}
                    value={value ?? ''}
                    onChangeText={onChange}
                  />
                )}
              />
              <Text style={[styles.subhead, { color: colors.textSecondary }]}>{PIN_LABEL}</Text>
              {errors.accessCode?.message && (
                <Text style={[styles.fieldError, { color: colors.errorRed }]}>{errors.accessCode.message}</Text>
              )}
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Timing tip</Text>
          <Controller
            control={control}
            name="timingTip"
            render={({ field: { onChange, value } }) => (
              <TextInput
                accessibilityLabel="Timing tip"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                placeholder="e.g. Busiest at lunch"
                placeholderTextColor={colors.textDisabled}
                maxLength={280}
                value={value ?? ''}
                onChangeText={onChange}
              />
            )}
          />
          {errors.timingTip?.message && (
            <Text style={[styles.fieldError, { color: colors.errorRed }]}>{errors.timingTip.message}</Text>
          )}

          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CTA_BACK}
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
              onPress={() => setStep(1)}
            >
              <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>{CTA_BACK}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CTA_NEXT}
              style={[styles.primaryButtonFlex, { backgroundColor: colors.primary }]}
              onPress={goToStep3}
            >
              <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>{CTA_NEXT}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>GPS Confirm</Text>

          {gpsLoading && (
            <View style={styles.gpsRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.subhead, { color: colors.textSecondary }]}>
                Reading your location…
              </Text>
            </View>
          )}

          {/* Live accuracy readout — every status pairs color + glyph + text (WCAG 1.4.1,
              design-system.md §18.4). This app ships no icon library; an accessible text
              glyph stands in for the Ionicons checkmark/warning marks. */}
          {!gpsLoading && gpsSample !== null && gpsSample.accuracy !== null && (
            <View style={styles.gpsRow}>
              <Text
                style={[
                  styles.gpsGlyph,
                  { color: accuracyPoor ? colors.warningAmber : colors.successGreen },
                ]}
              >
                {accuracyPoor ? '⚠' : '✓'}
              </Text>
              <Text
                style={[
                  styles.body,
                  { color: accuracyPoor ? colors.warningAmber : colors.successGreen },
                ]}
              >
                {`GPS accuracy: ±${Math.round(gpsSample.accuracy)}m (${accuracyPoor ? 'poor' : 'good'})`}
              </Text>
            </View>
          )}

          {/* Inline GPS error area — generic RPC rejection maps to LOCKED copy only (SC7). */}
          {!gpsLoading && isDenied && (
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.gpsError, { color: colors.errorRed }]}
            >
              {ERR_01}
            </Text>
          )}
          {!gpsLoading && accuracyPoor && (
            <View style={styles.gpsErrorRow} accessibilityLiveRegion="polite">
              <Text style={[styles.gpsGlyph, { color: colors.warningAmber }]}>⚠</Text>
              <Text style={[styles.gpsError, { color: colors.warningAmber }]}>{ERR_02}</Text>
            </View>
          )}
          {!gpsLoading && !accuracyPoor && isStale && (
            <View>
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.gpsError, { color: colors.warningAmber }]}
              >
                {ERR_03}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={CTA_RETRY}
                style={[styles.secondaryButton, { borderColor: colors.primary }]}
                onPress={() => void loadSample()}
              >
                <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
                  {CTA_RETRY}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ERR-08: RPC failure — inline, form preserved, Retry re-submits (SC7). */}
          {mutation.isError && (
            <View>
              <View style={styles.gpsErrorRow} accessibilityLiveRegion="assertive">
                <Text style={[styles.gpsGlyph, { color: colors.errorRed }]}>⚠</Text>
                <Text style={[styles.gpsError, { color: colors.errorRed }]}>{ERR_08}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={CTA_RETRY}
                style={[styles.secondaryButton, { borderColor: colors.primary }]}
                onPress={doSubmit}
              >
                <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
                  {CTA_RETRY}
                </Text>
              </Pressable>
            </View>
          )}

          {/* 56pt primary CTA — enabled only for a present, non-mocked, fresh, ≤50m fix. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_AT_LOCATION}
            accessibilityState={{ disabled: !gpsValid || mutation.isPending }}
            disabled={!gpsValid || mutation.isPending}
            style={[
              styles.primaryButton,
              { backgroundColor: !gpsValid || mutation.isPending ? colors.border : colors.primary },
            ]}
            onPress={handleAtLocationPress}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonLabel,
                  { color: !gpsValid ? colors.textDisabled : colors.textInverse },
                ]}
              >
                {CTA_AT_LOCATION}
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_BACK}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={() => setStep(2)}
          >
            <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>{CTA_BACK}</Text>
          </Pressable>
        </View>
      )}

      {step === 'success' && (
        <View style={styles.successBlock}>
          <Text style={[styles.successGlyph, { color: colors.successGreen }]}>✓</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{SUCCESS_HEADING}</Text>
          <Text style={[styles.body, styles.successBody, { color: colors.textSecondary }]}>
            {SUCCESS_BODY}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={CTA_BACK_TO_MAP}
            style={[styles.primaryButton, styles.successCta, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>
              {CTA_BACK_TO_MAP}
            </Text>
          </Pressable>
        </View>
      )}

      {/* D-15 confirm dialog — fires before submit when sensitivity is ON. */}
      <SensitivityConfirmModal
        visible={confirmVisible}
        onConfirm={doSubmit}
        onCancel={() => setConfirmVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  gateContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
  },
  progressBar: {
    width: spacing.xxl,
    height: 2,
    marginHorizontal: spacing.xs,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    lineHeight: typography.h2.lineHeight,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
  },
  fieldError: {
    marginTop: spacing.xs,
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
  },
  textLink: {
    marginTop: spacing.sm,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  segmentGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segment: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  segmentLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing.md,
  },
  checkboxBox: {
    width: spacing.lg,
    height: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTick: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    lineHeight: typography.caption.lineHeight,
  },
  checkboxLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.base,
  },
  switchTextGroup: {
    flex: 1,
  },
  body: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  subhead: {
    marginTop: spacing.xs,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  primaryButton: {
    marginTop: spacing.xl,
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonFlex: {
    flex: 1,
    minHeight: 56,
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
    marginTop: spacing.xl,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  gpsGlyph: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
  },
  gpsErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  gpsError: {
    flex: 1,
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  successBlock: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  successGlyph: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight,
    lineHeight: typography.display.lineHeight,
    marginBottom: spacing.base,
  },
  successBody: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  successCta: {
    alignSelf: 'stretch',
  },
});
