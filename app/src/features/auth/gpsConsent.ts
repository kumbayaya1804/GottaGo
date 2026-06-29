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
 *   - 'granted' → call set_gps_consent RPC → return 'granted'
 *   - anything else → do NOT call RPC → return 'denied'
 *
 * @returns Promise<'granted' | 'denied'>
 */
export async function requestGpsConsent(): Promise<'granted' | 'denied'> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status === 'granted') {
    await supabase.rpc('set_gps_consent');
    return 'granted';
  }

  // Any non-granted status (denied, undetermined, etc.) returns 'denied'
  // and never writes to the database.
  return 'denied';
}
