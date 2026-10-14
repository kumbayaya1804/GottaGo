import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';

/**
 * Requests foreground GPS permission from the OS and, on grant only,
 * records consent in the database via the `set_gps_consent` SECURITY DEFINER RPC.
 *
 * Security requirement T-02-04: the RPC MUST NOT be called when the OS dialog
 * resolves to any status other than 'granted'. The database write is the
 * authoritative record of consent — writing it before permission is granted
 * would be a GDPR violation.
 *
 * Decision tree (CONTEXT §3):
 *   - 'granted' → call set_gps_consent RPC → return 'granted' once it is saved
 *   - anything else → do NOT call RPC → return 'denied'
 *   - the permission request or the RPC fails (resolved error or rejection)
 *     → return 'error'; the save is unconfirmed and the caller offers a retry.
 *       A rejected RPC can still have committed server-side before the response
 *       was lost, so 'error' means "not confirmed", not "definitely not stored".
 *
 * Never throws.
 *
 * @returns Promise<'granted' | 'denied' | 'error'>
 */
export async function requestGpsConsent(): Promise<'granted' | 'denied' | 'error'> {
  let status: Location.PermissionStatus;
  try {
    ({ status } = await Location.requestForegroundPermissionsAsync());
  } catch {
    return 'error';
  }

  if (status === 'granted') {
    try {
      const { error } = await supabase.rpc('set_gps_consent');
      return error ? 'error' : 'granted';
    } catch {
      return 'error';
    }
  }

  // Any non-granted status (denied, undetermined, etc.) returns 'denied'
  // and never writes to the database.
  return 'denied';
}
