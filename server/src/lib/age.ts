/**
 * age.ts
 * ------
 * Minimum-age enforcement for account creation (COPPA / GDPR Art. 8).
 *
 * This is the authority. The client has a mirror at `src/lib/age.ts` so the
 * sign-up form can give immediate feedback, but every birthday that reaches the
 * API is re-validated here — a client check is a convenience, never a control.
 *
 * Keep the two files in lockstep. If a rule changes here, change it there.
 *
 * Dates are parsed and compared entirely in UTC so a birthday resolves to the
 * same age regardless of where the request came from.
 */

/**
 * Minimum age to hold an account.
 *
 * 13 is the COPPA floor (US, under-13). GDPR Art. 8 lets member states set the
 * digital-consent age anywhere from 13 to 16, so an EU launch may need this
 * raised or varied by region.
 */
export const MIN_AGE_YEARS = 13;

/** Oldest plausible birthday. Anything beyond this is a typo, not a person. */
const MAX_AGE_YEARS = 120;

export type BirthdayRejection =
  | 'missing'
  | 'unparseable'
  | 'future'
  | 'implausible'
  | 'underage';

export type BirthdayValidation =
  | { ok: true;  dob: Date; age: number }
  | { ok: false; reason: BirthdayRejection; message: string };

/**
 * Client-facing copy per rejection.
 *
 * `underage` is deliberately the only one that states the rule. The others stay
 * generic so the endpoint can't be used to probe what shape of date is
 * acceptable.
 */
const MESSAGES: Record<BirthdayRejection, string> = {
  missing:     'Date of birth is required',
  unparseable: 'Enter a valid date of birth',
  future:      'Date of birth cannot be in the future',
  implausible: 'Enter a valid date of birth',
  underage:    `You must be at least ${MIN_AGE_YEARS} years old to use Ojo`,
};

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse `MM/DD/YYYY` (what the app sends) or `YYYY-MM-DD` (ISO, accepted
 * defensively). Returns null for anything that isn't a real calendar date,
 * including roll-over combinations like 02/30/2000 that the Date constructor
 * would otherwise absorb as March 1st.
 */
export function parseBirthday(raw: unknown): Date | null {
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
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth()    !== m - 1 ||
    date.getUTCDate()     !== d
  ) return null;

  return date;
}

// ─── Age ──────────────────────────────────────────────────────────────────────

/**
 * Whole years elapsed, by calendar — not by dividing milliseconds, which drifts
 * across leap years and can read a day early at the boundary.
 */
export function ageInYears(dob: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * The single gate. Every route that accepts a birthday goes through this —
 * sign-up, the post-OAuth age gate, and profile updates.
 */
export function validateBirthday(raw: unknown, now: Date = new Date()): BirthdayValidation {
  const fail = (reason: BirthdayRejection): BirthdayValidation =>
    ({ ok: false, reason, message: MESSAGES[reason] });

  if (raw == null || String(raw).trim() === '') return fail('missing');

  const dob = parseBirthday(raw);
  if (!dob) return fail('unparseable');
  if (dob.getTime() > now.getTime()) return fail('future');

  const age = ageInYears(dob, now);
  if (age > MAX_AGE_YEARS) return fail('implausible');
  if (age < MIN_AGE_YEARS) return fail('underage');

  return { ok: true, dob, age };
}

/**
 * Whether a stored birthday still satisfies the gate.
 *
 * Used to decide if an existing account needs to be re-prompted — accounts
 * created before the gate existed, and every OAuth account, carry an empty
 * birthday and must be caught on their next request.
 */
export function isAgeVerified(birthday: unknown, now?: Date): boolean {
  return validateBirthday(birthday, now).ok;
}
