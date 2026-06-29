import { isProtected, nextRoute } from '../redirect';

describe('isProtected', () => {
  it('returns true for the submit route', () => {
    expect(isProtected(['(tabs)', 'submit'])).toBe(true);
  });

  it('returns false for the map tab (public)', () => {
    expect(isProtected(['(tabs)', 'index'])).toBe(false);
  });

  it('returns false for the nearby tab (public)', () => {
    expect(isProtected(['(tabs)', 'nearby'])).toBe(false);
  });

  it('returns false for the profile tab (public navigation)', () => {
    expect(isProtected(['(tabs)', 'profile'])).toBe(false);
  });

  it('returns false for the auth group', () => {
    expect(isProtected(['(auth)', 'sign-in'])).toBe(false);
  });

  it('returns false for empty segments', () => {
    expect(isProtected([])).toBe(false);
  });

  it('returns false for tabs group with no leaf segment', () => {
    expect(isProtected(['(tabs)'])).toBe(false);
  });
});

describe('nextRoute', () => {
  describe('no session + protected route', () => {
    it('redirects to sign-in when no session and accessing submit', () => {
      expect(nextRoute(['(tabs)', 'submit'], false)).toBe('/(auth)/sign-in');
    });
  });

  describe('has session + auth group', () => {
    it('redirects to tabs when session exists and in auth group', () => {
      expect(nextRoute(['(auth)', 'sign-in'], true)).toBe('/(tabs)');
    });

    it('redirects to tabs when session exists and in sign-up route', () => {
      expect(nextRoute(['(auth)', 'sign-up'], true)).toBe('/(tabs)');
    });
  });

  describe('null cases — no navigation needed', () => {
    it('returns null for public route with no session', () => {
      expect(nextRoute(['(tabs)', 'index'], false)).toBeNull();
    });

    it('returns null for public nearby route with no session', () => {
      expect(nextRoute(['(tabs)', 'nearby'], false)).toBeNull();
    });

    it('returns null for public profile route with no session', () => {
      expect(nextRoute(['(tabs)', 'profile'], false)).toBeNull();
    });

    it('returns null for protected route with session (already authenticated)', () => {
      expect(nextRoute(['(tabs)', 'submit'], true)).toBeNull();
    });

    it('returns null for root route with session', () => {
      expect(nextRoute([], true)).toBeNull();
    });

    it('returns null for root route without session', () => {
      expect(nextRoute([], false)).toBeNull();
    });
  });
});
