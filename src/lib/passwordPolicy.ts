/**
 * Shared password-strength rule.
 *
 * Sign-up, password reset, and the in-app change-password screen all enforce
 * the same policy through this one validator so they can't drift (previously
 * sign-up required an uppercase letter + a number while reset and change only
 * checked the 8-character minimum).
 */

/** Human-readable summary, suitable for a field hint / placeholder. */
export const PASSWORD_RULE_HINT = '8+ characters · 1 uppercase · 1 number';

/**
 * Returns an error message when `password` violates the policy, or `undefined`
 * when it is acceptable.
 */
export function validatePassword(password: string): string | undefined {
  if (!password) return 'Required';
  if (password.length < 8) return 'At least 8 characters required';
  if (!/[A-Z]/.test(password)) return 'Must include at least one uppercase letter';
  if (!/\d/.test(password)) return 'Must include at least one number';
  return undefined;
}
