import { getGpsSample } from '../submit/useGpsSample';
import type { GpsDenied, GpsSample } from '../submit/types';

/**
 * Reads one high-accuracy GPS sample for the VerifyFlow "I'm Here" step.
 *
 * A verification needs exactly the reading a submission needs (permission request,
 * `Accuracy.BestForNavigation`, the Android mock flag normalized to `false` on iOS), so
 * this delegates to the submit feature's reader instead of keeping a second copy of it.
 *
 * Never throws on a non-granted permission: it returns the `{denied:true}` sentinel so
 * the wizard renders the denied state, never a dead end. The reading is advisory on the
 * client; `verify_location` re-validates it and is the authority.
 */
export function getVerifyGpsSample(): Promise<GpsSample | GpsDenied> {
  return getGpsSample();
}
