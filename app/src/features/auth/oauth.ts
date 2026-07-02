import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '../../lib/supabase';

// Completes any in-flight auth session when the app returns to the foreground.
// Must be called once at module load (RESEARCH §Pattern 3).
WebBrowser.maybeCompleteAuthSession();

/** Extracts the PKCE authorization `code` query param from a Supabase callback URL. */
function extractCode(url: string): string | null {
  const { params } = QueryParams.getQueryParams(url);
  return params.code ?? null;
}

export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = makeRedirectUri({ path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) {
    throw new Error('No OAuth URL returned by signInWithOAuth');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    return extractCode(result.url);
  }

  return null;
}

/**
 * Exchanges the PKCE `code` carried by a Supabase OAuth/recovery deep-link callback
 * URL for a session via `exchangeCodeForSession`.
 *
 * @throws if the url carries no `code`, or if the exchange itself errors
 */
export async function handleAuthCallback(url: string) {
  const code = extractCode(url);
  if (!code) {
    throw new Error('No authorization code found in callback URL');
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;

  return data.session;
}
