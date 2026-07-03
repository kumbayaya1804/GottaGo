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

jest.mock('@rnmapbox/maps', () => ({
  MapView: 'MapView',
  Camera: 'Camera',
  ShapeSource: 'ShapeSource',
  SymbolLayer: 'SymbolLayer',
  setAccessToken: jest.fn(),
}));

jest.mock('expo-location', () => ({
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6, Balanced: 3, High: 4 },
}));

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => store.set(k, v),
      delete: (k: string) => store.delete(k),
    })),
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
