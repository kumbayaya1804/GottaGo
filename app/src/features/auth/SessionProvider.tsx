import React, { createContext, useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

/**
 * Shape of the session context value.
 * session: the active Supabase auth session, or null if unauthenticated
 * loading: true until the first auth event fires (blank-splash gate — decision #5)
 * signOut: calls supabase.auth.signOut()
 * suppressGuardRedirect: when true, the root layout guard's auto-redirect effect
 *   (redirect.ts nextRoute) is skipped. Set by screens that create a session as a
 *   side effect of an in-flight multi-step flow (e.g. sign-up: signUp() creates a
 *   session immediately since email confirmation is disabled, but the screen still
 *   has to call updateProfile() and show/handle its error before it's safe to let
 *   the guard route the user elsewhere) — WU-02-T4 review finding.
 */
export interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  suppressGuardRedirect: boolean;
  setSuppressGuardRedirect: (value: boolean) => void;
}

/**
 * React context for auth session. Exported so useSession.ts can consume it
 * and tests can provide a custom value via Context.Provider.
 */
export const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: React.ReactNode;
}

/**
 * SessionProvider wraps the root layout and provides the auth session to all
 * descendants via SessionContext.
 *
 * On mount:
 *   - Calls getSession() to hydrate from AsyncStorage-persisted session
 *   - Subscribes to onAuthStateChange for all subsequent auth events
 *
 * On unmount:
 *   - Unsubscribes to prevent memory leaks
 *
 * Events handled (RESEARCH §Pattern 1):
 *   INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
 *   PASSWORD_RECOVERY, USER_UPDATED
 *
 * Does NOT fetch the public.users profile row — that is done lazily via
 * TanStack Query per CONTEXT §1 decision #3.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [suppressGuardRedirect, setSuppressGuardRedirect] = useState(false);

  useEffect(() => {
    // Hydrate session from AsyncStorage on cold start
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Subscribe to all auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SessionContext.Provider
      value={{ session, loading, signOut, suppressGuardRedirect, setSuppressGuardRedirect }}
    >
      {children}
    </SessionContext.Provider>
  );
}
