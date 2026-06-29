import { z } from 'zod';

/**
 * Zod schema for the display name field.
 * Rules (CONTEXT §5 / UI-SPEC validation table):
 *   - 3–20 characters
 *   - Only letters, numbers, spaces, hyphens, and underscores
 */
export const displayName = z
  .string()
  .min(3, 'Display name must be 3–20 characters.')
  .max(20, 'Display name must be 3–20 characters.')
  .regex(
    /^[A-Za-z0-9 _-]+$/,
    'Display name can only contain letters, numbers, spaces, hyphens, and underscores.'
  );

/**
 * Zod schema for the email field.
 * Error copy from UI-SPEC §15 error-state copy matrix.
 */
export const email = z.string().email('Enter a valid email address.');

/**
 * Zod schema for the password field.
 * Minimum 8 characters (aligned to Supabase config minimum_password_length=8).
 */
export const password = z.string().min(8, 'Password must be at least 8 characters.');

/**
 * Combined schema for the sign-up form (display name + email + password).
 */
export const signUpSchema = z.object({
  displayName,
  email,
  password,
});

/**
 * Combined schema for the sign-in form (email + password).
 */
export const signInSchema = z.object({
  email,
  password,
});
