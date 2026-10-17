/**
 * Phase 5 verification service-layer types (plan 05-03).
 *
 * These shapes back the client-side VerifyFlow building blocks:
 *   - `VerifyCandidate` — a nearby pending submission another user may verify, as
 *     returned by `search_pending_submissions_nearby` (public-safe columns only; the
 *     server never returns the submitter, the access code, or the timing tip).
 *   - `VerifyInput` — the payload `verifyLocation` maps into the `verify_location`
 *     RPC's `p_*` arguments.
 *   - `VerifyResult` — the reason-free outcome. The server returns only
 *     `{ accepted }`; there is deliberately no rejection-reason field (SC7).
 *
 * The GPS reading itself reuses the submit feature's `GpsSample` / `GpsDenied`.
 */

/** snake_case row returned by the `search_pending_submissions_nearby` RPC. */
export interface VerifyCandidateRpcRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  policy_tag: string;
  distance_m: number;
}

/** A pending submission near the user, nearest first. `distanceM` is server-computed. */
export interface VerifyCandidate {
  id: string;
  name: string;
  lat: number;
  lng: number;
  policyTag: string;
  distanceM: number;
}

/**
 * The payload consumed by `verifyLocation`. `accuracy` is the OS-reported radius in
 * meters (may be `null`); `timestamp` is ms since epoch from the GPS sample and is
 * serialized to an ISO string for the RPC's freshness check.
 */
export interface VerifyInput {
  submissionId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  mocked: boolean;
  timestamp: number;
}

/** The whole outcome of a verification attempt. There is no reason field by design. */
export interface VerifyResult {
  accepted: boolean;
}
