import { APP_CONFIG_SMOKE_KEYS } from '../appConfigSmoke';

describe('APP_CONFIG_SMOKE_KEYS', () => {
  it('contains only the six D-01 threshold keys', () => {
    expect(APP_CONFIG_SMOKE_KEYS).toEqual([
      'max_accuracy_m',
      'verify_radius_m',
      'max_gps_age_s',
      'decay_half_life_days',
      'confidence_floor',
      'report_suppress_threshold',
    ]);
    expect(APP_CONFIG_SMOKE_KEYS).not.toContain('submission_publish_threshold');
  });
});
