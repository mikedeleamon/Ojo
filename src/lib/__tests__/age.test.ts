import {
  MIN_AGE_YEARS,
  formatBirthdayInput,
  parseBirthday,
  ageInYears,
  validateBirthday,
  meetsMinimumAge,
} from '../age';

/** Fixed clock so the suite doesn't change meaning as time passes. */
const NOW = new Date(Date.UTC(2026, 7, 16)); // 2026-08-16

describe('formatBirthdayInput', () => {
  it('inserts slashes progressively as digits arrive', () => {
    expect(formatBirthdayInput('0')).toBe('0');
    expect(formatBirthdayInput('01')).toBe('01');
    expect(formatBirthdayInput('011')).toBe('01/1');
    expect(formatBirthdayInput('0115')).toBe('01/15');
    expect(formatBirthdayInput('01152000')).toBe('01/15/2000');
  });

  it('strips non-digits and caps at 8 digits', () => {
    expect(formatBirthdayInput('01/15/2000')).toBe('01/15/2000');
    expect(formatBirthdayInput('ab01cd15ef2000gh')).toBe('01/15/2000');
    expect(formatBirthdayInput('011520001234')).toBe('01/15/2000');
  });
});

describe('parseBirthday', () => {
  it('parses MM/DD/YYYY', () => {
    const d = parseBirthday('01/15/2000')!;
    expect(d.getUTCFullYear()).toBe(2000);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(15);
  });

  it('parses ISO YYYY-MM-DD', () => {
    const d = parseBirthday('2000-01-15')!;
    expect(d.getUTCFullYear()).toBe(2000);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(15);
  });

  it('accepts single-digit month and day', () => {
    expect(parseBirthday('1/5/2000')).not.toBeNull();
  });

  it('rejects roll-over dates the Date constructor would silently accept', () => {
    expect(parseBirthday('02/30/2000')).toBeNull();
    expect(parseBirthday('04/31/2001')).toBeNull();
    expect(parseBirthday('13/01/2000')).toBeNull();
    expect(parseBirthday('00/10/2000')).toBeNull();
  });

  it('accepts a real leap day and rejects a fake one', () => {
    expect(parseBirthday('02/29/2000')).not.toBeNull(); // 2000 is a leap year
    expect(parseBirthday('02/29/2001')).toBeNull();     // 2001 is not
  });

  it('rejects junk, empty, and malformed input', () => {
    expect(parseBirthday('')).toBeNull();
    expect(parseBirthday('   ')).toBeNull();
    expect(parseBirthday('not a date')).toBeNull();
    expect(parseBirthday('01/15/00')).toBeNull();   // 2-digit year
    expect(parseBirthday('01-15-2000')).toBeNull(); // wrong separator
    expect(parseBirthday(undefined as never)).toBeNull();
  });
});

describe('ageInYears', () => {
  it('counts whole calendar years', () => {
    expect(ageInYears(new Date(Date.UTC(2000, 7, 16)), NOW)).toBe(26);
  });

  it('does not count a birthday that has not arrived yet this year', () => {
    expect(ageInYears(new Date(Date.UTC(2000, 7, 17)), NOW)).toBe(25);
    expect(ageInYears(new Date(Date.UTC(2000, 8, 1)), NOW)).toBe(25);
  });

  it('counts the birthday itself as the day the age increments', () => {
    expect(ageInYears(new Date(Date.UTC(2013, 7, 16)), NOW)).toBe(13);
    expect(ageInYears(new Date(Date.UTC(2013, 7, 15)), NOW)).toBe(13);
  });

  it('stays correct across leap years', () => {
    // Feb 29 2008 → on Aug 16 2026 that is 18 whole years.
    expect(ageInYears(new Date(Date.UTC(2008, 1, 29)), NOW)).toBe(18);
  });
});

describe('validateBirthday', () => {
  it('accepts an adult', () => {
    const result = validateBirthday('01/15/2000', NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.age).toBe(26);
  });

  it('accepts someone exactly at the minimum age', () => {
    // Turns 13 on the dot.
    const result = validateBirthday('08/16/2013', NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.age).toBe(MIN_AGE_YEARS);
  });

  it('rejects someone one day short of the minimum age', () => {
    const result = validateBirthday('08/17/2013', NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('underage');
  });

  it('rejects a clearly underage date', () => {
    const result = validateBirthday('01/01/2020', NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('underage');
  });

  it('distinguishes every rejection reason', () => {
    const reason = (v: string | undefined | null) => {
      const r = validateBirthday(v, NOW);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason(undefined)).toBe('missing');
    expect(reason('')).toBe('missing');
    expect(reason('   ')).toBe('missing');
    expect(reason('garbage')).toBe('unparseable');
    expect(reason('02/30/2000')).toBe('unparseable');
    expect(reason('01/01/2030')).toBe('future');
    expect(reason('01/01/1800')).toBe('implausible');
    expect(reason('01/01/2020')).toBe('underage');
  });

  it('carries a message for every rejection', () => {
    const result = validateBirthday('01/01/2020', NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(String(MIN_AGE_YEARS));
  });
});

describe('meetsMinimumAge', () => {
  it('is a thin predicate over validateBirthday', () => {
    expect(meetsMinimumAge('01/15/2000', NOW)).toBe(true);
    expect(meetsMinimumAge('01/15/2020', NOW)).toBe(false);
    expect(meetsMinimumAge('', NOW)).toBe(false);
    expect(meetsMinimumAge(undefined, NOW)).toBe(false);
  });
});
