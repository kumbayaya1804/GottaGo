import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

jest.mock('react-native-url-polyfill/auto', () => ({}));

// Importing supabase triggers createClient — capture the call args
import '../supabase';

describe('supabase client', () => {
  it('initializes with detectSessionInUrl: false', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.detectSessionInUrl).toBe(false);
  });

  it('initializes with AsyncStorage as auth storage', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.storage).toBe(AsyncStorage);
  });

  it('initializes with autoRefreshToken: true', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.autoRefreshToken).toBe(true);
  });

  it('initializes with persistSession: true', () => {
    const options = (createClient as jest.Mock).mock.calls[0][2];
    expect(options.auth.persistSession).toBe(true);
  });

  it('throws a clear error when EXPO_PUBLIC_SUPABASE_URL is missing', () => {
    const savedUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    try {
      jest.isolateModules(() => {
        expect(() => require('../supabase')).toThrow('EXPO_PUBLIC_SUPABASE_URL');
      });
    } finally {
      process.env.EXPO_PUBLIC_SUPABASE_URL = savedUrl;
    }
  });

  it('throws a clear error when EXPO_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    const savedKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    try {
      jest.isolateModules(() => {
        expect(() => require('../supabase')).toThrow('EXPO_PUBLIC_SUPABASE_ANON_KEY');
      });
    } finally {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = savedKey;
    }
  });
});
