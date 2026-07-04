import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Colors } from '../../constants/Colors';
import { spacing } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { radius } from '../../constants/radius';
import { LEGAL_URLS } from '../../constants/legal';
import { useSession } from '../../features/auth/useSession';
import { profileStats } from '../../features/profile/profileStats';
import { getMyProfile } from '../../features/profile/getMyProfile';
import DeleteAccountModal from '../(components)/DeleteAccountModal';

/**
 * Masks an email's local part for display: keeps the first character, replaces the
 * rest with a fixed-width bullet run, keeps the domain untouched.
 */
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return email;
  return `${email[0]}•••${email.slice(atIndex)}`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const sessionCtx = useSession();
  const session = sessionCtx?.session ?? null;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const statsQuery = useQuery({
    // Scoped by user id: the QueryClient is app-lifetime (created once in _layout.tsx),
    // so an unscoped key would let one user's cached stats render for the next user who
    // signs in during the same app runtime (Codex WU-02-T5 review finding).
    queryKey: ['profileStats', session?.user.id],
    queryFn: profileStats,
    enabled: session !== null,
  });

  const profileQuery = useQuery({
    queryKey: ['myProfile', session?.user.id],
    queryFn: () => getMyProfile(session!.user.id),
    enabled: session !== null,
  });

  if (session === null) {
    return (
      <ScrollView style={[styles.screen, { backgroundColor: colors.background }]}>
        <Text style={[styles.h2, { color: colors.textPrimary }]}>Sign in to contribute</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Track your contributions and access door codes.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign In"
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={[styles.primaryButtonLabel, { color: colors.textInverse }]}>Sign In</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create Account"
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text style={[styles.secondaryButtonLabel, { color: colors.primary }]}>
            Create Account
          </Text>
        </Pressable>
        <Text style={[styles.mutedStat, { color: colors.textDisabled }]}>
          ? GPS Verifications
        </Text>
        <Text style={[styles.mutedStat, { color: colors.textDisabled }]}>
          ? Locations Submitted
        </Text>
      </ScrollView>
    );
  }

  const stats = statsQuery.data;
  const statsErrored = statsQuery.isError;

  function renderStatValue(value: number | undefined) {
    if (statsErrored) {
      return <Text style={[styles.statValue, { color: colors.textDisabled }]}>—</Text>;
    }
    if (value === undefined) {
      return (
        <View
          style={[styles.skeleton, { backgroundColor: colors.skeletonBase }]}
          accessibilityLabel="Loading"
        />
      );
    }
    return <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>;
  }

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.h2, { color: colors.textPrimary }]}>Profile</Text>

      <View
        style={[styles.avatar, { borderColor: colors.border }]}
        accessibilityRole="image"
        accessibilityLabel="Profile photo — placeholder"
      />
      <Text style={[styles.displayName, { color: colors.textPrimary }]}>
        {profileQuery.isError
          ? 'Profile'
          : profileQuery.data
            ? profileQuery.data.displayName ?? 'Profile'
            : ''}
      </Text>
      <Text style={[styles.subhead, { color: colors.textSecondary }]}>
        {session.user.email ? maskEmail(session.user.email) : ''}
      </Text>

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Stats</Text>
      <View style={styles.statsRow}>
        <Text style={[styles.body, { color: colors.textPrimary }]}>GPS Verifications</Text>
        {renderStatValue(stats?.gpsVerifications)}
      </View>
      <View style={styles.statsRow}>
        <Text style={[styles.body, { color: colors.textPrimary }]}>Locations Submitted</Text>
        {renderStatValue(stats?.locationsSubmitted)}
      </View>
      <View style={styles.statsRow}>
        <Text style={[styles.body, { color: colors.textPrimary }]}>Ratings Given</Text>
        {renderStatValue(stats?.ratingsGiven)}
      </View>

      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Settings</Text>
      <View style={[styles.settingsRow, { borderBottomColor: colors.divider }]}>
        <Text style={[styles.body, { color: colors.textPrimary }]}>Account</Text>
        <Text style={[styles.subhead, { color: colors.textDisabled }]}>Coming soon</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Privacy Policy — opens in browser"
        style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
        onPress={() => Linking.openURL(LEGAL_URLS.privacyPolicy)}
      >
        <Text style={[styles.body, { color: colors.textPrimary }]}>Privacy Policy</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Terms of Service — opens in browser"
        style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
        onPress={() => Linking.openURL(LEGAL_URLS.termsOfService)}
      >
        <Text style={[styles.body, { color: colors.textPrimary }]}>Terms of Service</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete Account"
        accessibilityHint="Opens confirmation dialog before deleting"
        style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
        onPress={() => setDeleteModalVisible(true)}
      >
        <Text style={[styles.body, { color: colors.textPrimary }]}>Delete Account</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign Out"
        style={[styles.settingsRow, { borderBottomColor: colors.divider }]}
        onPress={() => sessionCtx?.signOut()}
      >
        <Text style={[styles.body, { color: colors.textPrimary }]}>Sign Out</Text>
      </Pressable>
      <View style={[styles.settingsRow, { borderBottomColor: colors.divider }]}>
        <Text style={[styles.body, { color: colors.textPrimary }]}>Location Permissions</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          onPress={() => Linking.openSettings()}
        >
          <Text style={[styles.settingsAction, { color: colors.textLink }]}>Open Settings</Text>
        </Pressable>
      </View>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.base,
  },
  h2: {
    marginTop: spacing.base,
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    lineHeight: typography.h2.lineHeight,
  },
  body: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  subhead: {
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
  primaryButton: {
    marginTop: spacing.xxl,
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
    marginTop: spacing.md,
    minHeight: 48,
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
  mutedStat: {
    marginTop: spacing.xl,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  avatar: {
    marginTop: spacing.xxl,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignSelf: 'center',
  },
  displayName: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
  },
  sectionHeader: {
    marginTop: spacing.xxl,
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
  },
  statsRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    lineHeight: typography.h3.lineHeight,
  },
  skeleton: {
    width: 32,
    height: 24,
    borderRadius: radius.xs,
  },
  settingsRow: {
    minHeight: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  settingsAction: {
    fontSize: typography.subhead.fontSize,
    fontWeight: typography.subhead.fontWeight,
    lineHeight: typography.subhead.lineHeight,
  },
});
