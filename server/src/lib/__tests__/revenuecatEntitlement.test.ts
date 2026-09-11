import { classifyEvent, isAuthorizedWebhook } from '../revenuecatEntitlement';

describe('classifyEvent', () => {
  it('grants on a fresh purchase, renewal, or uncancel', () => {
    expect(classifyEvent('INITIAL_PURCHASE', ['pro'])).toBe('grant');
    expect(classifyEvent('RENEWAL', ['pro'])).toBe('grant');
    expect(classifyEvent('UNCANCELLATION', ['pro'])).toBe('grant');
  });

  it('revokes only on EXPIRATION', () => {
    expect(classifyEvent('EXPIRATION', ['pro'])).toBe('revoke');
  });

  // The bug this guards against: CANCELLATION means auto-renew was turned
  // off, not that access ended. RevenueCat's own model keeps the entitlement
  // active until the period actually lapses (EXPIRATION). Revoking here would
  // cut a user off mid-period.
  it('does not revoke on CANCELLATION or BILLING_ISSUE — access continues until EXPIRATION', () => {
    expect(classifyEvent('CANCELLATION', ['pro'])).toBe('ignore');
    expect(classifyEvent('BILLING_ISSUE', ['pro'])).toBe('ignore');
  });

  it('ignores events for a different entitlement', () => {
    expect(classifyEvent('INITIAL_PURCHASE', ['some_other_entitlement'])).toBe('ignore');
  });

  it('ignores events with no entitlement_ids at all', () => {
    expect(classifyEvent('INITIAL_PURCHASE', null)).toBe('ignore');
    expect(classifyEvent('INITIAL_PURCHASE', undefined)).toBe('ignore');
  });

  it('ignores unrecognized event types', () => {
    expect(classifyEvent('TEST', ['pro'])).toBe('ignore');
    expect(classifyEvent('TRANSFER', ['pro'])).toBe('ignore');
  });
});

describe('isAuthorizedWebhook', () => {
  it('accepts a header that matches the configured secret exactly', () => {
    expect(isAuthorizedWebhook('shh-its-a-secret', 'shh-its-a-secret')).toBe(true);
  });

  it('rejects a mismatched header', () => {
    expect(isAuthorizedWebhook('wrong', 'shh-its-a-secret')).toBe(false);
  });

  it('rejects when the header is missing', () => {
    expect(isAuthorizedWebhook(undefined, 'shh-its-a-secret')).toBe(false);
  });

  it('fails closed when no secret is configured, even against an empty header', () => {
    expect(isAuthorizedWebhook('', undefined)).toBe(false);
    expect(isAuthorizedWebhook('anything', undefined)).toBe(false);
  });
});
