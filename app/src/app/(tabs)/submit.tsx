import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { useSession } from '../../features/auth/useSession';
import { submitSchema, type SubmitSchema } from '../../features/submit/submitSchema';
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
const SENSITIVITY_LABEL = 'Not suitable for kids'; // D-10
const SENSITIVITY_EXPLAINER = 'Hides this location from users who have Family mode enabled.'; // D-12
const PIN_LABEL = 'Door code (optional) — only shown to signed-in users'; // D-19
const ADDRESS_AFFORDANCE = 'No address? Describe the location instead'; // D-04

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

  const {
    control,
    trigger,
    watch,
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
          <TextInput
            accessibilityLabel="Hours"
            style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
            placeholder="e.g. Open 7am–10pm"
            placeholderTextColor={colors.textDisabled}
          />

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
                    value={value ?? ''}
                    onChangeText={onChange}
                  />
                )}
              />
              <Text style={[styles.subhead, { color: colors.textSecondary }]}>{PIN_LABEL}</Text>
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
                value={value ?? ''}
                onChangeText={onChange}
              />
            )}
          />

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
              onPress={() => setStep(3)}
            >
              <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>{CTA_NEXT}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>GPS Confirm</Text>
          <Text style={[styles.subhead, { color: colors.textSecondary }]}>
            Confirming you are physically at this location…
          </Text>
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

      {/* D-15 confirm dialog — wired to the Step-3 final submit in Task 2. */}
      <SensitivityConfirmModal
        visible={confirmVisible}
        onConfirm={() => setConfirmVisible(false)}
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
});
