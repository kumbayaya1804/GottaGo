import { submitSchema } from '../submitSchema';

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Alton Baker Park restroom',
    address: 'North parking lot',
    policyTag: 'public_facility',
    accessSensitivity: false,
    hours: undefined,
    accessCode: undefined,
    timingTip: undefined,
    ...overrides,
  };
}

describe('submitSchema', () => {
  it('rejects an empty name', () => {
    const result = submitSchema.safeParse(validInput({ name: '' }));
    expect(result.success).toBe(false);
  });

  it('accepts a valid full object', () => {
    const result = submitSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it('rejects a policyTag outside the 4-value enum', () => {
    const result = submitSchema.safeParse(validInput({ policyTag: 'not_a_real_tag' }));
    expect(result.success).toBe(false);
  });

  it('accepts each of the 4 valid policyTag values', () => {
    for (const tag of ['chill_spot', 'purchase_required', 'code_required', 'public_facility']) {
      const result = submitSchema.safeParse(validInput({ policyTag: tag }));
      expect(result.success).toBe(true);
    }
  });

  it('accepts accessCode absent even when policyTag is code_required (D-19 optional)', () => {
    const result = submitSchema.safeParse(
      validInput({ policyTag: 'code_required', accessCode: undefined })
    );
    expect(result.success).toBe(true);
  });

  it('accepts accessCode present when policyTag is code_required', () => {
    const result = submitSchema.safeParse(
      validInput({ policyTag: 'code_required', accessCode: '1234' })
    );
    expect(result.success).toBe(true);
  });

  it('flags an issue on accessCode when it is supplied but policyTag is not code_required', () => {
    const result = submitSchema.safeParse(
      validInput({ policyTag: 'public_facility', accessCode: '1234' })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('accessCode'))).toBe(true);
    }
  });

  it('defaults accessSensitivity to false when omitted', () => {
    const input = validInput();
    delete (input as Record<string, unknown>).accessSensitivity;
    const result = submitSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessSensitivity).toBe(false);
    }
  });

  it('accepts accessSensitivity true', () => {
    const result = submitSchema.safeParse(validInput({ accessSensitivity: true }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessSensitivity).toBe(true);
    }
  });

  it('rejects a name over 120 characters', () => {
    const result = submitSchema.safeParse(validInput({ name: 'a'.repeat(121) }));
    expect(result.success).toBe(false);
  });

  it('rejects an address over 200 characters', () => {
    const result = submitSchema.safeParse(validInput({ address: 'a'.repeat(201) }));
    expect(result.success).toBe(false);
  });

  it('accepts address omitted (label-only, optional per D-05)', () => {
    const result = submitSchema.safeParse(validInput({ address: undefined }));
    expect(result.success).toBe(true);
  });

  it('rejects a timingTip over 280 characters', () => {
    const result = submitSchema.safeParse(validInput({ timingTip: 'a'.repeat(281) }));
    expect(result.success).toBe(false);
  });

  it('accepts a timingTip within the limit', () => {
    const result = submitSchema.safeParse(validInput({ timingTip: 'Busiest around lunch' }));
    expect(result.success).toBe(true);
  });

  it('rejects an accessCode over 100 characters (D-20 generous but bounded)', () => {
    const result = submitSchema.safeParse(
      validInput({ policyTag: 'code_required', accessCode: 'a'.repeat(101) })
    );
    expect(result.success).toBe(false);
  });

  it('accepts an hours object', () => {
    const result = submitSchema.safeParse(validInput({ hours: { mon: '9-5' } }));
    expect(result.success).toBe(true);
  });
});
