import { useContext } from 'react';
import { SessionContext } from './SessionProvider';

/**
 * Hook for consuming the SessionContext in any component.
 *
 * Usage:
 *   const { session, loading, signOut } = useSession() ?? {};
 *
 * Returns null if called outside a SessionProvider tree (should not happen in
 * production — the root _layout always wraps with SessionProvider).
 */
export function useSession() {
  return useContext(SessionContext);
}
