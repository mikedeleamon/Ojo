import crypto from 'crypto';

export const ENTITLEMENT_ID = 'pro';

// Only these actually change entitlement state. CANCELLATION and
// BILLING_ISSUE are deliberately absent: per RevenueCat's event model, access
// continues until the subscription actually lapses (EXPIRATION), regardless
// of whether the cause was a voluntary cancel (still active till period end)
// or a failed renewal (may still be in its grace period). Revoking on
// CANCELLATION would cut a user off while they're still inside a period they
// paid for.
const GRANTING_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
]);
const REVOKING_EVENTS = new Set(['EXPIRATION']);

export type EntitlementAction = 'grant' | 'revoke' | 'ignore';

/**
 * Maps one RevenueCat webhook event to an entitlement action. Pure and
 * side-effect free so the event-type/entitlement mapping — the part most
 * likely to be subtly wrong — can be unit tested without touching Express or
 * Mongo.
 */
export function classifyEvent(
  eventType: string,
  entitlementIds: string[] | null | undefined,
): EntitlementAction {
  if (!entitlementIds?.includes(ENTITLEMENT_ID)) return 'ignore';
  if (GRANTING_EVENTS.has(eventType)) return 'grant';
  if (REVOKING_EVENTS.has(eventType)) return 'revoke';
  return 'ignore';
}

/**
 * Verifies the webhook's Authorization header against the static secret
 * configured in the RevenueCat dashboard (the simpler of RevenueCat's two
 * supported schemes — the other is an HMAC signature over the raw body,
 * which would require carving this route out of the app-wide express.json()
 * parser to keep the raw bytes; not worth it for a webhook that only ever
 * flips one boolean). Constant-time and fails closed when the secret isn't
 * configured, rather than accepting every request.
 */
export function isAuthorizedWebhook(
  actualHeader: string | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!expectedSecret || !actualHeader) return false;
  const a = Buffer.from(actualHeader);
  const b = Buffer.from(expectedSecret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
