import '@testing-library/jest-native/extend-expect';

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
