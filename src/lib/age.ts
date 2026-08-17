/**
 * age.ts
 * ------
 * Minimum-age rules for account creation (COPPA / GDPR Art. 8).
 *
 * This is the client-side mirror of `server/src/lib/age.ts`. The server is the
 * authority — it re-validates every birthday it is sent and will reject an
 * underage account regardless of what the client did. This copy exists so the
 * UI can give immediate, specific feedback instead of round-tripping, and so
 * the sign-up form and the OAuth age gate can't drift apart.
 *
 * Keep the two files in lockstep. If a rule changes here, change it there.
 *
 * Dates are parsed and compared entirely in UTC so the same birthday resolves
 * to the same age no matter the device's timezone. At the exact boundary this
 * can differ from local time by under a day, which is immaterial for a
 * self-reported date.
 */

/**
 * Minimum age to hold an account.
 *
 * 13 is the COPPA floor (US, under-13). GDPR Art. 8 lets member states set the
 * digital-consent age anywhere from 13 to 16, so an EU launch may need this
 * raised or varied by region — see docs before changing.
 */
export const MIN_AGE_YEARS = 13;

/** Oldest plausible birthday. Anything beyond this is a typo, not a person. */
const MAX_AGE_YEARS = 120;

export type BirthdayRejection =
  | 'missing'      // nothing entered
  | 'unparseable'  // not a real calendar date
  | 'future'       // dated ahead of today
  | 'implausible'  // older than MAX_AGE_YEARS
  | 'underage';    // real date, but under MIN_AGE_YEARS

export type BirthdayValidation =
  | { ok: true;  dob: Date; age: number }
  | { ok: false; reason: BirthdayRejection; message: string };

/** Human-readable copy for each rejection. Shared by the form and the gate. */
export const BIRTHDAY_MESSAGES: Record<BirthdayRejection, string> = {
  missing:     'Required',
  unparseable: 'Enter a valid date (MM/DD/YYYY)',
  future:      'Birthday cannot be in the future',
  implausible: 'Enter a valid birthday',
  underage:    `You must be at least ${MIN_AGE_YEARS} years old to sign up`,
};

// ─── Input formatting ─────────────────────────────────────────────────────────

/** Auto-insert slashes as the user types: 01 → 01/ → 01/15 → 01/15/2000 */
export const formatBirthdayInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse `MM/DD/YYYY` (what the sign-up form produces) or `YYYY-MM-DD` (ISO,
 * accepted defensively so a stored or re-serialised value still reads back).
 *
 * Returns null for anything that isn't a real calendar date — this rejects
 * roll-over combinations like 02/30/2000 that the Date constructor would
 * silently accept as March 1st.
 */
export const parseBirthday = (raw: string): Date | null => {
  if (typeof raw !== 'string') return null;
  const val = raw.trim();
  if (!val) return null;

  let y: number, m: number, d: number;

  const slash = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso   = val.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (slash)    { m = +slash[1]; d = +slash[2]; y = +slash[3]; }
  else if (iso) { y = +iso[1];   m = +iso[2];   d = +iso[3];   }
  else return null;

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject roll-over: Date.UTC(2000, 1, 30) becomes March 1st.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth()    !== m - 1 ||
    date.getUTCDate()     !== d
  ) return null;

  return date;
};

/**
 * Re-express a parsed birthday as local midnight.
 *
 * Birthdays are parsed in UTC, but a date picker renders in local time — handing
 * it a UTC-midnight Date shows the previous day anywhere west of Greenwich. Use
 * this whenever a parsed birthday is used to seed UI, never for age maths.
 */
export const toLocalDate = (dob: Date): Date =>
  new Date(dob.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate());

/** Inverse of toLocalDate: a picker's local Date → the `MM/DD/YYYY` wire format. */
export const formatLocalDateAsBirthday = (date: Date): string => {
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
};

// ─── Age ──────────────────────────────────────────────────────────────────────

/**
 * Whole years elapsed, by calendar — not by dividing milliseconds, which drifts
 * across leap years and can read a day early at the boundary.
 */
export const ageInYears = (dob: Date, now: Date = new Date()): number => {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age;
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * The single gate. Every path that accepts a birthday — the sign-up form, the
 * post-OAuth age gate, the server routes — goes through this.
 */
export const validateBirthday = (
  raw: string | undefined | null,
  now: Date = new Date(),
): BirthdayValidation => {
  const fail = (reason: BirthdayRejection): BirthdayValidation =>
    ({ ok: false, reason, message: BIRTHDAY_MESSAGES[reason] });

  if (raw == null || String(raw).trim() === '') return fail('missing');

  const dob = parseBirthday(String(raw));
  if (!dob) return fail('unparseable');
  if (dob.getTime() > now.getTime()) return fail('future');

  const age = ageInYears(dob, now);
  if (age > MAX_AGE_YEARS) return fail('implausible');
  if (age < MIN_AGE_YEARS) return fail('underage');

  return { ok: true, dob, age };
};

/** Convenience predicate for callers that only need a yes/no. */
export const meetsMinimumAge = (raw: string | undefined | null, now?: Date): boolean =>
  validateBirthday(raw, now).ok;
