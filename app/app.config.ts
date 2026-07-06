import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Gotta Go',
  slug: 'gotta-go',
  owner: 'mrsaintarmand',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'gotta-go',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.watchthegap.gottago',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.watchthegap.gottago',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-image',
    'expo-localization',
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsVersion: '11.20.1',
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN ?? '',
        RNMapboxMapsImpl: 'mapbox',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '8c002e93-229f-4140-845f-eb3a9625b545',
    },
  },
};

export default config;
