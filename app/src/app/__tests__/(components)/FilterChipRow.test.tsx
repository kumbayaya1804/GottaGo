/**
 * Thin render + behavior tests for app/src/app/(components)/FilterChipRow.tsx.
 *
 * src/app/** is excluded from coverage collection — these tests exist for TDD
 * Guard compliance and behavioral verification only. FilterChipRow is UI over
 * the already-tested 03-02 useFiltersStore, so the store is mocked here: we
 * assert the five UI-SPEC chips render, a press delegates to the store's toggle
 * (no local filter state), and an active chip exposes accessibilityState.selected.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockToggle = jest.fn();
let mockFlags: Record<string, boolean>;

// Mock the store as a selector-based function (matches zustand's call shape).
jest.mock('../../../features/filters/useFiltersStore', () => ({
  useFiltersStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ ...mockFlags, toggle: mockToggle, clearAll: jest.fn() }),
}));

import FilterChipRow from '../../(components)/FilterChipRow';

beforeEach(() => {
  jest.clearAllMocks();
  mockFlags = {
    openNow: false,
    chillSpot: false,
    wheelchair: false,
    changing: false,
    highConf: false,
  };
});

describe('FilterChipRow', () => {
  it('renders the five UI-SPEC filter chips', () => {
    const { getByText } = render(<FilterChipRow />);
    ['Changing Table', 'Wheelchair', 'Chill Spot', 'Open Now', 'Clean: 4+'].forEach((label) =>
      expect(getByText(label)).toBeTruthy(),
    );
  });

  it('delegates a chip press to the store toggle (no local filter state)', () => {
    const { getByText } = render(<FilterChipRow />);
    fireEvent.press(getByText('Chill Spot'));
    expect(mockToggle).toHaveBeenCalledWith('chillSpot');
  });

  it('marks an active chip with accessibilityState selected + accessibilityRole button', () => {
    mockFlags.wheelchair = true;
    const { getByLabelText } = render(<FilterChipRow />);
    const chip = getByLabelText('Wheelchair');
    expect(chip.props.accessibilityRole).toBe('button');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
  });

  it('marks an inactive chip with accessibilityState selected false', () => {
    const { getByLabelText } = render(<FilterChipRow />);
    const chip = getByLabelText('Open Now');
    expect(chip.props.accessibilityState).toEqual({ selected: false });
  });
});
