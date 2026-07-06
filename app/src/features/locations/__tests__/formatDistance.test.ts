// expo-localization is NOT globally mocked, so mock it here to drive the
// region-based miles/km selection. Intl is spied on for the fallback branch.
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

import * as Localization from 'expo-localization';
import { formatDistance, usesMilesForLocale } from '../formatDistance';

const mockGetLocales = Localization.getLocales as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('formatDistance', () => {
  it('renders a sub-0.1mi distance as feet (US)', () => {
    // 100 m ≈ 0.062 mi → feet branch
    expect(formatDistance(100, true)).toBe('328 ft');
  });

  it('renders >=0.1mi as miles to one decimal', () => {
    expect(formatDistance(2000, true)).toBe('1.2 mi');
    // Documents actual behavior: 500 m ≈ 0.31 mi → miles, not feet.
    expect(formatDistance(500, true)).toBe('0.3 mi');
  });

  it('renders sub-kilometer metric distances as meters', () => {
    expect(formatDistance(500, false)).toBe('500 m');
    expect(formatDistance(999, false)).toBe('999 m');
  });

  it('renders >=1000m metric distances as kilometers (1000m boundary)', () => {
    expect(formatDistance(1000, false)).toBe('1.0 km');
    expect(formatDistance(2000, false)).toBe('2.0 km');
  });
});

describe('usesMilesForLocale', () => {
  it('returns true for a mile-using region code from expo-localization', () => {
    mockGetLocales.mockReturnValue([{ regionCode: 'US' }]);
    expect(usesMilesForLocale()).toBe(true);
  });

  it('returns false for a metric region code', () => {
    mockGetLocales.mockReturnValue([{ regionCode: 'FR' }]);
    expect(usesMilesForLocale()).toBe(false);
  });

  it('falls back to Intl locale when no region code is present', () => {
    mockGetLocales.mockReturnValue([]); // no locales → undefined first element
    jest.spyOn(Intl, 'NumberFormat').mockReturnValue({
      resolvedOptions: () => ({ locale: 'en-GB' }),
    } as unknown as Intl.NumberFormat);
    expect(usesMilesForLocale()).toBe(true);
  });

  it('returns false when neither region code nor a 2-letter Intl region is available', () => {
    mockGetLocales.mockReturnValue([{ regionCode: null }]);
    jest.spyOn(Intl, 'NumberFormat').mockReturnValue({
      resolvedOptions: () => ({ locale: 'und' }),
    } as unknown as Intl.NumberFormat);
    expect(usesMilesForLocale()).toBe(false);
  });
});
