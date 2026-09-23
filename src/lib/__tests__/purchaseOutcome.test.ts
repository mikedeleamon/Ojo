import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  cancelFeedback,
  offeringStateFrom,
  purchaseIssue,
  stalledFeedback,
} from '../purchaseOutcome';

const pkg = (identifier: string) => ({ identifier }) as unknown as PurchasesPackage;

const offering = (parts: {
  monthly?: PurchasesPackage | null;
  annual?: PurchasesPackage | null;
  availablePackages?: PurchasesPackage[];
}) =>
  ({
    monthly: parts.monthly ?? null,
    annual: parts.annual ?? null,
    availablePackages: parts.availablePackages ?? [],
  }) as unknown as PurchasesOffering;

// The shape react-native-purchases rejects with.
const storeError = (overrides: Record<string, unknown> = {}) => ({
  code: '1',
  message: 'Purchase was cancelled.',
  readableErrorCode: 'PURCHASE_CANCELLED',
  underlyingErrorMessage: '',
  userCancelled: true,
  userInfo: { readableErrorCode: 'PURCHASE_CANCELLED' },
  ...overrides,
});

describe('offeringStateFrom', () => {
  it('is ready with both plans when the offering has monthly and annual', () => {
    const monthly = pkg('$rc_monthly');
    const annual = pkg('$rc_annual');
    expect(offeringStateFrom(offering({ monthly, annual, availablePackages: [monthly, annual] }))).toEqual({
      status: 'ready',
      monthly,
      annual,
      other: null,
    });
  });

  it('falls back to the first package only when neither period is present', () => {
    const custom = pkg('lifetime');
    expect(offeringStateFrom(offering({ availablePackages: [custom] }))).toEqual({
      status: 'ready',
      monthly: null,
      annual: null,
      other: custom,
    });
  });

  it('is an error when there is nothing to sell', () => {
    expect(offeringStateFrom(offering({}))).toEqual({ status: 'error' });
    expect(offeringStateFrom(null)).toEqual({ status: 'error' });
    expect(offeringStateFrom(undefined)).toEqual({ status: 'error' });
  });
});

describe('cancelFeedback', () => {
  it('is a calm note when the store sheet came up', () => {
    const feedback = cancelFeedback(true, 'the App Store');
    expect(feedback.tone).toBe('info');
    expect(feedback.text).toMatch(/not completed/);
    expect(feedback.text).toMatch(/charged/);
  });

  it('never tells the person they cancelled — a failed sign-in lands here too', () => {
    expect(cancelFeedback(true, 'the App Store').text).not.toMatch(/you cancel/i);
  });

  it('says the store did not open when no sheet ever appeared', () => {
    const feedback = cancelFeedback(false, 'the App Store');
    expect(feedback.tone).toBe('error');
    expect(feedback.text).toMatch(/^The App Store did not open\./);
    expect(feedback.text).toMatch(/signed in to the App Store/);
  });

  it('names the store the platform actually uses', () => {
    expect(cancelFeedback(false, 'Google Play').text).toMatch(/^Google Play did not open\./);
  });
});

describe('stalledFeedback', () => {
  it('is info, not error — nothing has failed yet', () => {
    const feedback = stalledFeedback('the App Store');
    expect(feedback.tone).toBe('info');
    expect(feedback.text).toMatch(/the App Store/);
    expect(feedback.text).toMatch(/close this screen/);
  });
});

describe('purchaseIssue', () => {
  it('reports an ordinary cancel as info, grouped apart from the no-sheet case', () => {
    const withSheet = purchaseIssue('cancelled', { error: storeError(), sheetSeen: true });
    const noSheet = purchaseIssue('cancelled', { error: storeError(), sheetSeen: false });

    expect(withSheet.level).toBe('info');
    expect(withSheet.tags.sheet_seen).toBe('yes');
    expect(noSheet.level).toBe('warning');
    expect(noSheet.tags.sheet_seen).toBe('no');
    expect(noSheet.message).toMatch(/before any store sheet/);
    expect(withSheet.fingerprint).not.toEqual(noSheet.fingerprint);
  });

  it('carries the store error code and its readable name', () => {
    const issue = purchaseIssue('failed', {
      error: storeError({
        code: '2',
        message: 'There was a problem with the App Store.',
        userInfo: { readableErrorCode: 'STORE_PROBLEM' },
        readableErrorCode: 'STORE_PROBLEM',
      }),
      sheetSeen: true,
      elapsedMs: 1234.6,
      productId: 'com.ojostudio.ojo.pro.monthly',
    });

    expect(issue.message).toBe('Purchase failed: STORE_PROBLEM');
    expect(issue.tags).toEqual({ paywall_outcome: 'failed', store_error: '2', sheet_seen: 'yes' });
    expect(issue.extra).toEqual({
      readableErrorCode: 'STORE_PROBLEM',
      errorMessage: 'There was a problem with the App Store.',
      underlyingErrorMessage: null,
      elapsedMs: 1235,
      productId: 'com.ojostudio.ojo.pro.monthly',
    });
  });

  it('strips URLs, which can carry the account id, out of error text', () => {
    const issue = purchaseIssue('failed', {
      error: storeError({
        code: '10',
        underlyingErrorMessage:
          'Request failed: https://api.revenuecat.com/v1/subscribers/64f1c0ffee0000000000abcd/offerings (timed out)',
      }),
    });

    expect(issue.extra.underlyingErrorMessage).toBe('Request failed: <url> (timed out)');
    expect(JSON.stringify(issue)).not.toContain('64f1c0ffee0000000000abcd');
  });

  it('caps long error text', () => {
    const issue = purchaseIssue('failed', { error: storeError({ message: 'x'.repeat(1000) }) });
    expect((issue.extra.errorMessage as string).length).toBeLessThanOrEqual(301);
  });

  it('survives anything being thrown', () => {
    for (const thrown of [undefined, null, 'boom', 42, new Error('bridge down')]) {
      const issue = purchaseIssue('failed', { error: thrown });
      expect(issue.tags.store_error).toBe('none');
      expect(issue.message).toMatch(/^Purchase failed: /);
    }
  });

  it('marks a paid-but-locked purchase as an error', () => {
    const issue = purchaseIssue('not_entitled', { sheetSeen: true });
    expect(issue.level).toBe('error');
  });

  it('tells a timeout, an empty offering and an SDK error apart', () => {
    const timeout = purchaseIssue('offerings_failed', { timedOut: true });
    const empty = purchaseIssue('offerings_failed', {});
    const sdk = purchaseIssue('offerings_failed', {
      error: storeError({ code: '23', userInfo: { readableErrorCode: 'CONFIGURATION_ERROR' } }),
    });

    expect(timeout.message).toBe('Paywall prices timed out');
    expect(empty.message).toBe('Paywall prices failed to load: empty offering');
    expect(sdk.message).toBe('Paywall prices failed to load: CONFIGURATION_ERROR');
    expect(new Set([timeout, empty, sdk].map((i) => i.fingerprint.join('/'))).size).toBe(3);
    expect(timeout.tags.sheet_seen).toBe('n/a');
  });

  it('sends only the whitelisted fields', () => {
    const issue = purchaseIssue('stalled', { elapsedMs: 10000, productId: 'com.ojostudio.ojo.pro.annual' });
    expect(Object.keys(issue).sort()).toEqual(['extra', 'fingerprint', 'level', 'message', 'tags']);
    expect(Object.keys(issue.extra).sort()).toEqual([
      'elapsedMs',
      'errorMessage',
      'productId',
      'readableErrorCode',
      'underlyingErrorMessage',
    ]);
  });
});
