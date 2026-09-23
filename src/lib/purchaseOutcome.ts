/**
 * purchaseOutcome.ts
 * ------------------
 * What the Ojo Pro paywall says, and what it reports to Sentry, when prices or
 * a purchase don't end in an unlock.
 *
 * Why this exists: App Review rejected 1.0 (33) under 2.1(b) on 2026-09-22 —
 * "the app was unresponsive after we tapped on the Unlock Ojo Pro button"
 * (iPad Air 11" M4, iPadOS 27.0). Apple's screenshot showed the paywall idle,
 * prices loaded, button live, and no message: exactly the screen a store
 * *cancel* leaves behind, because the paywall deliberately said nothing on
 * cancel. Reproduced on an iPad Air on iPadOS 27.0 — closing the App Store
 * sheet leaves that same screen.
 *
 * Silence was the defect. StoreKit reports more than one thing as a cancel:
 * the person closing the sheet, and — the iOS 18.2 "Could not get
 * confirmation scene ID" bug being the documented case — a sheet that never
 * appeared at all. So the paywall now answers every outcome, and uses whether
 * the store's UI ever came up (see `sheetSeen`) to tell those two apart. And
 * because App Review's device is the one place we can't attach a debugger,
 * every miss is reported, so a repeat rejection arrives with evidence.
 *
 * Deliberately free of any react-native or @sentry import so it stays
 * unit-testable under the node test environment (same as sentryScrub.ts). The
 * RevenueCat import is type-only.
 */

import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

/** 'error' = it failed. 'info' = it did NOT fail, but the user has to know
 *  something — the two must not look alike, or a pending payment reads as a
 *  rejected card and the user buys again. */
export type Feedback = { tone: 'error' | 'info'; text: string };

export type OfferingState =
  | { status: 'loading' }
  | {
      status: 'ready';
      monthly: PurchasesPackage | null;
      annual: PurchasesPackage | null;
      // Only used when the offering exposes neither a monthly nor an annual
      // package — we can show its price but can't name its period, so the
      // per-period suffixes are suppressed for it.
      other: PurchasesPackage | null;
    }
  | { status: 'error' };

/** The store a purchase goes through, as the user would name it mid-sentence. */
export type StoreName = 'the App Store' | 'Google Play';

/**
 * The paywall's view of RevenueCat's current offering. An offering with no
 * package at all is an error, not an empty paywall: there would be nothing to
 * sell and nothing for the button to do.
 */
export const offeringStateFrom = (
  current: PurchasesOffering | null | undefined,
): OfferingState => {
  const monthly = current?.monthly ?? null;
  const annual = current?.annual ?? null;
  const other = monthly || annual ? null : (current?.availablePackages[0] ?? null);
  return monthly || annual || other
    ? { status: 'ready', monthly, annual, other }
    : { status: 'error' };
};

const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What to say when the store reports a cancel.
 *
 * `sheetSeen` is whether the store's own UI came up during the attempt. If it
 * did, a cancel is almost always the person backing out, so the note is calm
 * and confirms the one thing they may wonder about. It says "not completed"
 * rather than "you cancelled" because a sign-in that fails inside the sheet
 * also ends here, and telling that person they cancelled would be wrong.
 *
 * If it never came up, nobody backed out of anything: the store refused to
 * show its sheet, which is the failure App Review hit — and the one case a
 * user can do something about.
 */
export const cancelFeedback = (sheetSeen: boolean, store: StoreName): Feedback =>
  sheetSeen
    ? { tone: 'info', text: 'Purchase not completed — you were not charged.' }
    : {
        tone: 'error',
        text: `${sentenceCase(store)} did not open. Make sure you are signed in to ${store}, then try again.`,
      };

/**
 * Shown while a purchase is still in flight but the store's sheet hasn't come
 * up. Info, not error: nothing has failed yet, and the sheet may still arrive —
 * in which case the paywall withdraws this note.
 */
export const stalledFeedback = (store: StoreName): Feedback => ({
  tone: 'info',
  text: `Still waiting for ${store}. If nothing appears, close this screen and try again.`,
});

// ─── Sentry reporting ────────────────────────────────────────────────────────

export type PurchaseIssueKind =
  /** The store reported a cancel — with or without its sheet having appeared. */
  | 'cancelled'
  /** Any other purchase error. */
  | 'failed'
  /** Still no sheet and no result after the paywall's patience ran out. */
  | 'stalled'
  /** The store took the payment but the `pro` entitlement isn't active. */
  | 'not_entitled'
  | 'restore_failed'
  /** Prices never arrived: an SDK error, an empty offering, or our timeout. */
  | 'offerings_failed';

export interface PurchaseIssueDetails {
  error?: unknown;
  /** Purchases only — whether the store's UI came up during the attempt. */
  sheetSeen?: boolean;
  elapsedMs?: number;
  /** A store product id such as com.ojostudio.ojo.pro.monthly — not personal. */
  productId?: string;
  /** offerings_failed only: our own timeout fired, rather than the SDK failing. */
  timedOut?: boolean;
}

/** Exactly what gets handed to Sentry.captureMessage — nothing else is sent. */
export interface PurchaseIssue {
  message: string;
  level: 'info' | 'warning' | 'error';
  fingerprint: string[];
  tags: Record<string, string>;
  extra: Record<string, string | number | null>;
}

// Error text from the SDKs can carry request URLs, and RevenueCat's put the
// app user id — the account's database id — in the path
// (/v1/subscribers/<id>/…). The privacy policy promises error reports, not
// account identifiers, so URLs go entirely; sentryScrub.ts only covers the
// `request.url` fields Sentry fills in itself, never free text like this.
const URL_PATTERN = /\bhttps?:\/\/\S+/gi;
const MAX_TEXT = 300;

const scrubText = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length === 0) return null;
  const cleaned = value.replace(URL_PATTERN, '<url>');
  return cleaned.length > MAX_TEXT ? `${cleaned.slice(0, MAX_TEXT)}…` : cleaned;
};

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/** The parts of a RevenueCat PurchasesError worth reporting, read defensively:
 *  anything can be thrown, and a bridge error needn't match the SDK's shape. */
const readStoreError = (error: unknown) => {
  const e = (error && typeof error === 'object' ? error : {}) as {
    code?: unknown;
    message?: unknown;
    readableErrorCode?: unknown;
    underlyingErrorMessage?: unknown;
    userInfo?: { readableErrorCode?: unknown } | null;
  };
  return {
    code: nonEmpty(e.code),
    readableCode: nonEmpty(e.userInfo?.readableErrorCode) ?? nonEmpty(e.readableErrorCode),
    message: scrubText(e.message),
    underlying: scrubText(e.underlyingErrorMessage),
  };
};

/**
 * Build the Sentry event for a paywall miss.
 *
 * Levels follow how surprising the outcome is, not how bad it sounds: a cancel
 * after the sheet appeared is ordinary user behaviour (info — still sent,
 * because a failed sign-in inside the sheet lands here too, and that is the
 * App Review case), a cancel with no sheet is the bug class that got 1.0 (33)
 * rejected (warning), and a payment without an entitlement is a real loss
 * (error).
 */
export const purchaseIssue = (
  kind: PurchaseIssueKind,
  details: PurchaseIssueDetails = {},
): PurchaseIssue => {
  const { sheetSeen, elapsedMs, productId, timedOut } = details;
  const store = readStoreError(details.error);
  const errorLabel = store.readableCode ?? store.code ?? 'unknown error';

  let message: string;
  let level: PurchaseIssue['level'] = 'warning';
  let variant = store.readableCode ?? store.code ?? 'none';

  switch (kind) {
    case 'cancelled':
      message = sheetSeen
        ? 'Purchase cancelled after the store sheet appeared'
        : 'Purchase cancelled before any store sheet appeared';
      level = sheetSeen ? 'info' : 'warning';
      variant = sheetSeen ? 'sheet' : 'no-sheet';
      break;
    case 'failed':
      message = `Purchase failed: ${errorLabel}`;
      break;
    case 'stalled':
      message = 'Purchase stalled: no store sheet and no result yet';
      break;
    case 'not_entitled':
      message = 'Purchase went through but the entitlement is not active';
      level = 'error';
      break;
    case 'restore_failed':
      message = `Restore failed: ${errorLabel}`;
      break;
    case 'offerings_failed':
      message = timedOut
        ? 'Paywall prices timed out'
        : `Paywall prices failed to load: ${details.error === undefined ? 'empty offering' : errorLabel}`;
      if (timedOut) variant = 'timeout';
      else if (details.error === undefined) variant = 'empty';
      break;
  }

  return {
    message,
    level,
    fingerprint: ['ojo-pro-paywall', kind, variant],
    tags: {
      paywall_outcome: kind,
      store_error: store.code ?? 'none',
      sheet_seen: sheetSeen === undefined ? 'n/a' : sheetSeen ? 'yes' : 'no',
    },
    extra: {
      readableErrorCode: store.readableCode,
      errorMessage: store.message,
      underlyingErrorMessage: store.underlying,
      elapsedMs: elapsedMs === undefined ? null : Math.round(elapsedMs),
      productId: productId ?? null,
    },
  };
};
