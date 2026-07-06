import '@testing-library/jest-native/extend-expect';
import { notifyManager } from '@tanstack/query-core';

// TanStack Query schedules and batches state notifications via setTimeout(fn, 0) by
// default, which fires after a test's act() block has already closed and produces
// spurious "not wrapped in act(...)" warnings. Overriding both the scheduler and the
// notify function to run synchronously is the library's documented test-environment fix.
notifyManager.setScheduler((callback) => callback());
notifyManager.setNotifyFunction((fn) => fn());

// Required by supabase.ts requireEnv() at module load time
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

jest.mock('@rnmapbox/maps', () => {
  const RealReact = require('react');
  const { View } = require('react-native');
  // Render every Mapbox layer/source as a passthrough View so screen tests can
  // mount MapScreen and query its non-native children (state cards, banners).
  const Passthrough = ({ children, ...props }: { children?: unknown }) =>
    RealReact.createElement(View, props, children as never);
  return {
    __esModule: true,
    default: {
      setAccessToken: jest.fn(),
      StyleURL: {
        Light: 'mapbox://styles/mapbox/light-v11',
        Dark: 'mapbox://styles/mapbox/dark-v11',
      },
    },
    MapView: Passthrough,
    Camera: Passthrough,
    ShapeSource: Passthrough,
    SymbolLayer: Passthrough,
    CircleLayer: Passthrough,
    UserLocation: Passthrough,
    setAccessToken: jest.fn(),
  };
});

jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6, Balanced: 3, High: 4 },
}));

jest.mock('react-native-mmkv', () => {
  // Mirrors the react-native-mmkv v4 instance API (createMMKV factory; getString
  // returns string | undefined; remove()/contains()/clearAll()). Backed by a
  // shared in-memory Map so persist writes/reads are observable in tests.
  const store = new Map<string, string>();
  const instance = {
    getString: (k: string) => (store.has(k) ? store.get(k) : undefined),
    set: (k: string, v: string) => store.set(k, v),
    remove: (k: string) => store.delete(k),
    contains: (k: string) => store.has(k),
    clearAll: () => store.clear(),
  };
  return {
    createMMKV: jest.fn(() => instance),
    MMKV: jest.fn().mockImplementation(() => instance),
  };
});

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useSegments: jest.fn(() => []),
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));
