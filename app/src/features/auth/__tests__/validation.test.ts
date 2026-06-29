import { displayName, email, password, signUpSchema, signInSchema } from '../validation';

describe('validation schemas', () => {
  // ─── displayName ────────────────────────────────────────────────────────────

  describe('displayName', () => {
    it('accepts a valid display name', () => {
      expect(() => displayName.parse('Alice')).not.toThrow();
    });

    it('accepts a display name with allowed special characters', () => {
      expect(() => displayName.parse('Alice_B-3')).not.toThrow();
    });

    it('accepts a display name with spaces', () => {
      expect(() => displayName.parse('Alice Bob')).not.toThrow();
    });

    it('accepts a 3-character display name (min boundary)', () => {
      expect(() => displayName.parse('Ali')).not.toThrow();
    });

    it('accepts a 20-character display name (max boundary)', () => {
      expect(() => displayName.parse('A'.repeat(20))).not.toThrow();
    });

    it('rejects a display name shorter than 3 characters', () => {
      const result = displayName.safeParse('Ab');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Display name must be 3–20 characters.'
        );
      }
    });

    it('rejects an empty display name', () => {
      const result = displayName.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Display name must be 3–20 characters.'
        );
      }
    });

    it('rejects a display name longer than 20 characters', () => {
      const result = displayName.safeParse('A'.repeat(21));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Display name must be 3–20 characters.'
        );
      }
    });

    it('rejects a display name with disallowed characters', () => {
      const result = displayName.safeParse('Alice!');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Display name can only contain letters, numbers, spaces, hyphens, and underscores.'
        );
      }
    });

    it('rejects a display name with @ symbol', () => {
      const result = displayName.safeParse('Alice@Bob');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Display name can only contain letters, numbers, spaces, hyphens, and underscores.'
        );
      }
    });
  });

  // ─── email ──────────────────────────────────────────────────────────────────

  describe('email', () => {
    it('accepts a valid email', () => {
      expect(() => email.parse('user@example.com')).not.toThrow();
    });

    it('rejects an invalid email format', () => {
      const result = email.safeParse('not-an-email');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Enter a valid email address.');
      }
    });

    it('rejects an email missing domain', () => {
      const result = email.safeParse('user@');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Enter a valid email address.');
      }
    });

    it('rejects an empty string as email', () => {
      const result = email.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Enter a valid email address.');
      }
    });
  });

  // ─── password ───────────────────────────────────────────────────────────────

  describe('password', () => {
    it('accepts a password with exactly 8 characters', () => {
      expect(() => password.parse('abcd1234')).not.toThrow();
    });

    it('accepts a password longer than 8 characters', () => {
      expect(() => password.parse('supersecurepassword')).not.toThrow();
    });

    it('rejects a password shorter than 8 characters', () => {
      const result = password.safeParse('short');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Password must be at least 8 characters.'
        );
      }
    });

    it('rejects an empty password', () => {
      const result = password.safeParse('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Password must be at least 8 characters.'
        );
      }
    });
  });

  // ─── signUpSchema ────────────────────────────────────────────────────────────

  describe('signUpSchema', () => {
    it('accepts valid sign-up data', () => {
      const result = signUpSchema.safeParse({
        displayName: 'Alice',
        email: 'alice@example.com',
        password: 'securepass',
      });
      expect(result.success).toBe(true);
    });

    it('rejects sign-up data with invalid display name', () => {
      const result = signUpSchema.safeParse({
        displayName: 'A',
        email: 'alice@example.com',
        password: 'securepass',
      });
      expect(result.success).toBe(false);
    });

    it('rejects sign-up data with invalid email', () => {
      const result = signUpSchema.safeParse({
        displayName: 'Alice',
        email: 'not-email',
        password: 'securepass',
      });
      expect(result.success).toBe(false);
    });

    it('rejects sign-up data with short password', () => {
      const result = signUpSchema.safeParse({
        displayName: 'Alice',
        email: 'alice@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── signInSchema ────────────────────────────────────────────────────────────

  describe('signInSchema', () => {
    it('accepts valid sign-in data', () => {
      const result = signInSchema.safeParse({
        email: 'alice@example.com',
        password: 'securepass',
      });
      expect(result.success).toBe(true);
    });

    it('rejects sign-in data with invalid email', () => {
      const result = signInSchema.safeParse({
        email: 'bad',
        password: 'securepass',
      });
      expect(result.success).toBe(false);
    });

    it('rejects sign-in data with short password', () => {
      const result = signInSchema.safeParse({
        email: 'alice@example.com',
        password: 'abc',
      });
      expect(result.success).toBe(false);
    });
  });
});
