import { z } from 'zod';

/**
 * Zod schema for the SubmitFlow wizard (RESEARCH §Pattern 7).
 *
 * - `name`/`policyTag` are required; everything else is optional.
 * - `address` is a label only (D-05) — never geocoded, coordinates always come from GPS.
 * - `accessSensitivity` defaults to `false` (D-08) and maps to `'sensitive' | null` (D-09)
 *   at the `submitLocation` layer, not here.
 * - `accessCode` is optional even when `policyTag === 'code_required'` (D-19) — the field
 *   only ever renders in that case (D-17), so a value present under any other tag indicates
 *   a client bug, flagged via `superRefine`.
 * - `hours` is a single free-text description (matches the Step 2 "Hours" input, e.g.
 *   "Open 7am–10pm") — not structured per-day data. Staged as-is in the `submissions.hours`
 *   jsonb column; Phase 5/8 owns any structured parsing at publish/display time.
 */
/**
 * Matches one visible character: anything outside every Unicode control (Cc), format
 * (Cf) and separator (Z) character as of Unicode 17.0, plus characters that render blank
 * without being in those categories (CGJ, Hangul fillers, Khmer U+17B4/17B5, Mongolian
 * selectors, Braille blank, variation selectors, the tag block). submit_location applies
 * the identical list server-side (20261016010000_phase5_submission_name_hardening.sql),
 * where PostgreSQL has no property classes; keep the two in step, or the form will
 * accept a name the server rejects with a generic error. submitSchema.test.ts compares
 * the two on every code point and checks this list against those categories.
 */
export const VISIBLE_CHAR =
  /[^\u0000-\u0020\u007F-\u00A0\u00AD\u034F\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u115F-\u1160\u1680\u17B4-\u17B5\u180B-\u180F\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2066-\u206F\u2800\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFB\u{110BD}\u{110CD}\u{13430}-\u{1343F}\u{1BCA0}-\u{1BCA3}\u{1D173}-\u{1D17A}\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/u;

export const submitSchema = z
  .object({
    // trim() before min(1): submit_location rejects a blank name server-side, so a
    // spaces-only name must fail here, on the field, rather than as a generic RPC error.
    name: z
      .string()
      .trim()
      .min(1, 'Name is required.')
      .max(120, 'Name is too long.')
      .regex(VISIBLE_CHAR, 'Name is required.'),
    address: z.string().max(200, 'Description is too long.').optional(),
    policyTag: z.enum(['chill_spot', 'purchase_required', 'code_required', 'public_facility']),
    accessSensitivity: z.boolean().default(false),
    hours: z.string().max(200, 'Hours description is too long.').optional(),
    accessCode: z.string().max(100, 'Door code is too long.').optional(),
    timingTip: z.string().max(280, 'Timing tip is too long.').optional(),
  })
  .superRefine((val, ctx) => {
    if (val.policyTag !== 'code_required' && val.accessCode) {
      ctx.addIssue({
        code: 'custom',
        path: ['accessCode'],
        message: 'Door code only applies to Code Required.',
      });
    }
  });

export type SubmitSchema = z.infer<typeof submitSchema>;
