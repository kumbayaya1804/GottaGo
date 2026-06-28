/**
 * Design system color tokens — full 35-token light+dark table.
 * Source: docs/design/design-system.md §1.1 (light) and §1.2 (dark).
 *
 * Usage in components:
 *   import Colors from '@/constants/Colors';         // default (design-system.md pattern)
 *   import { Colors } from '@/constants/Colors';     // named (both supported)
 *   const colorScheme = useColorScheme() ?? 'light';
 *   const colors = Colors[colorScheme];
 *
 * NEVER reference raw hex strings in component files.
 */

export const Colors = {
  light: {
    // Primary actions
    primary: '#1A73E8',
    primaryPressed: '#1557B0',
    primarySurface: '#E8F0FE',

    // Emergency
    emergency: '#D93025',
    emergencyOrange: '#EA8600',

    // Map pin policy tags
    pinChillSpot: '#34A853',
    pinCodeRequired: '#EA8600',
    pinPublicFacility: '#4285F4',
    pinPurchaseRequired: '#767676',
    pinPending: '#9AA0A6',

    // Confidence badges
    confidenceHigh: '#34A853',
    confidenceMedium: '#FBBC04',
    confidenceLow: '#EA4335',

    // Backgrounds
    background: '#FFFFFF',
    surface: '#F8F9FA',
    surfaceOverlay: '#FFFFFF',
    mapOverlay: 'rgba(255,255,255,0.92)',

    // Text
    textPrimary: '#202124',
    textSecondary: '#5F6368',
    textDisabled: '#9AA0A6',
    textInverse: '#FFFFFF',
    textLink: '#1A73E8',

    // Borders & dividers
    border: '#DADCE0',
    divider: '#E8EAED',

    // Tab bar
    tabIconDefault: '#9AA0A6',
    tabIconSelected: '#1A73E8',
    tabBackground: '#FFFFFF',

    // Skeleton loaders
    skeletonBase: '#E0E0E0',
    skeletonHighlight: '#F5F5F5',

    // Status
    successGreen: '#34A853',
    warningAmber: '#EA8600',
    errorRed: '#EA4335',

    // Offline banner
    offlineBanner: '#FFF3CD',
    offlineBannerText: '#664D03',

    // Modal backdrop
    scrim: 'rgba(0,0,0,0.4)',
  },

  dark: {
    // Primary actions
    primary: '#8AB4F8',
    primaryPressed: '#669DF6',
    primarySurface: '#1E3A5F',

    // Emergency
    emergency: '#F28B82',
    emergencyOrange: '#FDD663',

    // Map pin policy tags
    pinChillSpot: '#81C995',
    pinCodeRequired: '#FDD663',
    pinPublicFacility: '#8AB4F8',
    pinPurchaseRequired: '#9AA0A6',
    pinPending: '#5F6368',

    // Confidence badges
    confidenceHigh: '#81C995',
    confidenceMedium: '#FDD663',
    confidenceLow: '#F28B82',

    // Backgrounds
    background: '#121212',
    surface: '#1E1E1E',
    surfaceOverlay: '#2C2C2C',
    mapOverlay: 'rgba(30,30,30,0.92)',

    // Text
    textPrimary: '#E8EAED',
    textSecondary: '#9AA0A6',
    textDisabled: '#5F6368',
    textInverse: '#202124',
    textLink: '#8AB4F8',

    // Borders & dividers
    border: '#3C3C3C',
    divider: '#2C2C2C',

    // Tab bar
    tabIconDefault: '#5F6368',
    tabIconSelected: '#8AB4F8',
    tabBackground: '#1E1E1E',

    // Skeleton loaders
    skeletonBase: '#3C3C3C',
    skeletonHighlight: '#4A4A4A',

    // Status
    successGreen: '#81C995',
    warningAmber: '#FDD663',
    errorRed: '#F28B82',

    // Offline banner
    offlineBanner: '#3B2F00',
    offlineBannerText: '#FDD663',

    // Modal backdrop
    scrim: 'rgba(0,0,0,0.6)',
  },
} as const;

export default Colors;
