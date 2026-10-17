import fs from 'fs';
import path from 'path';
import { VISIBLE_CHAR, submitSchema } from '../submitSchema';

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

  it('rejects a spaces-only name with the same field error as an empty one', () => {
    // The server rejects a blank name (it could never publish), so the form must stop
    // it on the field — otherwise the user gets a generic error and an endless Retry.
    const result = submitSchema.safeParse(validInput({ name: '   ' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({ path: ['name'], message: 'Name is required.' });
    }
  });

  it.each([
    ['zero-width space', '\u200B'],
    ['BOM', '\uFEFF'],
    ['ZWNJ, ZWJ and word joiner', '\u200C\u200D\u2060'],
    ['soft hyphen and bidi marks', '\u00AD\u200E\u200F'],
    ['NEL (not stripped by String.prototype.trim)', '\u0085'],
    ['Mongolian vowel separator', '\u180E'],
  ])('rejects a name made only of invisible characters: %s', (_label, name) => {
    // submit_location applies the same character list; a form that let these through
    // would leave the user facing a generic server error.
    const result = submitSchema.safeParse(validInput({ name }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({ path: ['name'], message: 'Name is required.' });
    }
  });

  it.each([['Café Ñandú'], ['图书馆 洗手间'], ['Park \u{1F6BD}'], ['A\u200BB']])(
    'accepts a real name: %s',
    (name) => {
      expect(submitSchema.safeParse(validInput({ name })).success).toBe(true);
    },
  );

  it.each([
    ['LEFT-TO-RIGHT ISOLATE', [0x2066]],
    ['Arabic letter mark and bidi isolates', [0x061c, 0x2067, 0x2068, 0x2069]],
    ['Hangul fillers', [0x3164, 0x115f, 0xffa0]],
    ['Braille blank', [0x2800]],
    ['variation selectors and CGJ', [0xfe00, 0xfe0f, 0x034f]],
    ['tag characters and a musical format control', [0xe0001, 0xe0020, 0x1d173]],
    ['a C0 control', [0x0001]],
    ['ESC, U+001F and DEL', [0x001b, 0x001f, 0x007f]],
    ['C1 controls', [0x0080, 0x0096, 0x009f]],
    ['interlinear annotation controls', [0xfff9, 0xfffb]],
  ])('rejects a name made only of further invisible characters: %s', (_label, codePoints) => {
    const result = submitSchema.safeParse(validInput({ name: String.fromCodePoint(...codePoints) }));
    expect(result.success).toBe(false);
  });

  it('accepts an emoji with a variation selector inside a real name', () => {
    const name = 'I ' + String.fromCodePoint(0x2764, 0xfe0f) + ' parks';
    expect(submitSchema.safeParse(validInput({ name })).success).toBe(true);
  });

  it('treats every control, format and separator character as not visible (completeness)', () => {
    // The drift test below proves the form and server agree; this proves the shared list
    // is complete for the Unicode categories that never print: Cc (controls), Cf (format
    // characters) and Z (separators), as known to this JavaScript engine.
    const neverPrints = /[\p{Cc}\p{Cf}\p{Z}]/u;
    const gaps: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      const ch = String.fromCodePoint(cp);
      if (neverPrints.test(ch) && VISIBLE_CHAR.test(ch)) gaps.push(cp.toString(16));
    }
    expect(gaps).toEqual([]);
  });

  it('classifies every Unicode character exactly as submit_location does (no drift)', () => {
    // The form and the server must agree on which characters count as visible, or the
    // form would accept a name the server rejects with a generic error. Rebuild the
    // server's pattern from the migration and compare the two on every code point.
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../../../supabase/migrations/20261016010000_phase5_submission_name_hardening.sql'),
      'utf8',
    );
    const match = sql.match(/p_name !~ '(\[[^']+\])'/);
    expect(match).not.toBeNull();
    const serverVisible = new RegExp(match![1].replace(/\\U([0-9A-Fa-f]{8})/g, (_m, hex: string) => `\\u{${parseInt(hex, 16).toString(16)}}`), 'u');
    const mismatches: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      const ch = String.fromCodePoint(cp);
      if (VISIBLE_CHAR.test(ch) !== serverVisible.test(ch)) mismatches.push(cp.toString(16));
      if (mismatches.length > 10) break;
    }
    expect(mismatches).toEqual([]);
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

  it('accepts an hours description', () => {
    const result = submitSchema.safeParse(validInput({ hours: 'Open 7am-10pm' }));
    expect(result.success).toBe(true);
  });

  it('rejects an hours description over 200 characters', () => {
    const result = submitSchema.safeParse(validInput({ hours: 'a'.repeat(201) }));
    expect(result.success).toBe(false);
  });

  it('accepts hours omitted', () => {
    const result = submitSchema.safeParse(validInput({ hours: undefined }));
    expect(result.success).toBe(true);
  });
});
