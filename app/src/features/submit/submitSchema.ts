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
 */
export const submitSchema = z
  .object({
    name: z.string().min(1, 'Name is required.').max(120, 'Name is too long.'),
    address: z.string().max(200, 'Description is too long.').optional(),
    policyTag: z.enum(['chill_spot', 'purchase_required', 'code_required', 'public_facility']),
    accessSensitivity: z.boolean().default(false),
    hours: z.record(z.string(), z.string()).optional(),
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
