// Mock the supabase singleton so auth.signInWithOAuth / exchangeCodeForSession can be intercepted
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

// expo-web-browser is mocked globally in jest.setup.ts (maybeCompleteAuthSession, openAuthSessionAsync)
import * as WebBrowser from 'expo-web-browser';

// expo-auth-session is NOT globally mocked — mock makeRedirectUri locally so tests never
// touch the native Linking/Constants path.
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'gotta-go://auth/callback'),
}));
import { makeRedirectUri } from 'expo-auth-session';

import { signInWithGoogle, handleAuthCallback } from '../oauth';

const mockSupabase = jest.requireMock('../../../lib/supabase').supabase as {
  auth: {
    signInWithOAuth: jest.Mock;
    exchangeCodeForSession: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('module load', () => {
  it('calls WebBrowser.maybeCompleteAuthSession once at module load', () => {
    jest.isolateModules(() => {
      require('../oauth');
    });
    expect(WebBrowser.maybeCompleteAuthSession).toHaveBeenCalled();
  });
});

describe('signInWithGoogle', () => {
  it('builds redirectTo via makeRedirectUri({ path: "auth/callback" })', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await signInWithGoogle();

    expect(makeRedirectUri).toHaveBeenCalledWith({ path: 'auth/callback' });
  });

  it('calls signInWithOAuth with provider google and skipBrowserRedirect true', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await signInWithGoogle();

    expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'gotta-go://auth/callback', skipBrowserRedirect: true },
    });
  });

  it('opens WebBrowser.openAuthSessionAsync with the provider url and redirectTo', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await signInWithGoogle();

    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://provider.example/authorize',
      'gotta-go://auth/callback'
    );
  });

  it('throws when signInWithOAuth returns an error', async () => {
    const oauthError = new Error('provider not enabled');
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: null, url: null },
      error: oauthError,
    });

    await expect(signInWithGoogle()).rejects.toThrow('provider not enabled');
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when signInWithOAuth resolves with no error but no url', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: null },
      error: null,
    });

    await expect(signInWithGoogle()).rejects.toThrow('No OAuth URL returned by signInWithOAuth');
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('parses and returns the code when the browser result is "success"', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'success',
      url: 'gotta-go://auth/callback?code=abc123',
    });

    const result = await signInWithGoogle();

    expect(result).toBe('abc123');
  });

  it('returns null without throwing when the browser result is "cancel"', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'cancel',
    });

    await expect(signInWithGoogle()).resolves.toBeNull();
  });

  it('returns null without throwing when the browser result is "dismiss"', async () => {
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://provider.example/authorize' },
      error: null,
    });
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: 'dismiss',
    });

    await expect(signInWithGoogle()).resolves.toBeNull();
  });
});

describe('handleAuthCallback', () => {
  it('extracts the PKCE code from the url and calls exchangeCodeForSession', async () => {
    const fakeSession = { access_token: 'x', user: { id: 'u1' } };
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: fakeSession, user: { id: 'u1' } },
      error: null,
    });

    const result = await handleAuthCallback('gotta-go://auth/callback?code=xyz789');

    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('xyz789');
    expect(result).toBe(fakeSession);
  });

  it('throws when the url carries no PKCE code', async () => {
    await expect(handleAuthCallback('gotta-go://auth/callback')).rejects.toThrow(
      'No authorization code found in callback URL'
    );
    expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('throws when exchangeCodeForSession returns an error', async () => {
    const exchangeError = new Error('invalid grant');
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: exchangeError,
    });

    await expect(handleAuthCallback('gotta-go://auth/callback?code=xyz789')).rejects.toThrow(
      'invalid grant'
    );
  });
});
