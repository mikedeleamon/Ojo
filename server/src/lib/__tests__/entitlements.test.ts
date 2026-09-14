import {
  checkLimit,
  limitFor,
  limitsEnforced,
  FREE_ITEM_LIMIT,
  FREE_CLOSET_LIMIT,
  LIMIT_CODES,
} from '../entitlements';

// The flag that decides whether any of this is switched on at all. It defaults
// off so that deploying the caps before the store exists is a no-op — see the
// comment on limitsEnforced().
describe('limitsEnforced', () => {
  const original = process.env.ENFORCE_FREE_TIER_LIMITS;
  afterEach(() => { process.env.ENFORCE_FREE_TIER_LIMITS = original; });

  it('is off when the variable is unset', () => {
    delete process.env.ENFORCE_FREE_TIER_LIMITS;
    expect(limitsEnforced()).toBe(false);
  });

  it('is off for anything other than the exact string "true"', () => {
    for (const v of ['false', '1', 'TRUE', 'yes', '']) {
      process.env.ENFORCE_FREE_TIER_LIMITS = v;
      expect(limitsEnforced()).toBe(false);
    }
  });

  it('is on only for "true"', () => {
    process.env.ENFORCE_FREE_TIER_LIMITS = 'true';
    expect(limitsEnforced()).toBe(true);
  });
});

describe('limitFor', () => {
  it('gives free accounts the documented ceilings', () => {
    expect(limitFor('item', false)).toBe(FREE_ITEM_LIMIT);
    expect(limitFor('closet', false)).toBe(FREE_CLOSET_LIMIT);
  });

  it('gives Pro accounts no ceiling at all', () => {
    expect(limitFor('item', true)).toBeNull();
    expect(limitFor('closet', true)).toBeNull();
  });
});

describe('checkLimit — free accounts', () => {
  it('allows an empty account to add', () => {
    expect(checkLimit('item', 0, false).allowed).toBe(true);
    expect(checkLimit('closet', 0, false).allowed).toBe(true);
  });

  // The boundary that decides whether the cap is 40 or 39 in practice.
  // `current` is the count BEFORE the addition, so holding 39 must still be
  // able to reach 40.
  it('allows the addition that lands exactly on the limit', () => {
    expect(checkLimit('item', FREE_ITEM_LIMIT - 1, false).allowed).toBe(true);
    expect(checkLimit('closet', FREE_CLOSET_LIMIT - 1, false).allowed).toBe(true);
  });

  it('refuses the addition that would exceed the limit', () => {
    expect(checkLimit('item', FREE_ITEM_LIMIT, false).allowed).toBe(false);
    expect(checkLimit('closet', FREE_CLOSET_LIMIT, false).allowed).toBe(false);
  });

  it('returns a machine-readable code and a message on refusal', () => {
    const item = checkLimit('item', FREE_ITEM_LIMIT, false);
    expect(item.code).toBe(LIMIT_CODES.item);
    expect(item.error).toContain(String(FREE_ITEM_LIMIT));

    const closet = checkLimit('closet', FREE_CLOSET_LIMIT, false);
    expect(closet.code).toBe(LIMIT_CODES.closet);
    expect(closet.error).toBeTruthy();
  });

  it('carries no code or message when the addition is allowed', () => {
    const ok = checkLimit('item', 0, false);
    expect(ok.code).toBeUndefined();
    expect(ok.error).toBeUndefined();
  });
});

describe('checkLimit — Pro accounts', () => {
  it('allows additions well past the free ceiling', () => {
    expect(checkLimit('item', FREE_ITEM_LIMIT * 25, true).allowed).toBe(true);
    expect(checkLimit('closet', 50, true).allowed).toBe(true);
  });
});

describe('checkLimit — grandfathered accounts', () => {
  // The rule this codifies: an account over the cap (it predates this file, or
  // Pro lapsed) keeps everything it has. The ONLY consequence is that it cannot
  // add another. Nothing here may ever read as "delete down to the limit."
  it('refuses to add but reports the real count, not a clamped one', () => {
    const over = checkLimit('item', 137, false);
    expect(over.allowed).toBe(false);
    expect(over.current).toBe(137);
    expect(over.limit).toBe(FREE_ITEM_LIMIT);
  });

  it('lets a lapsed subscriber add again the moment Pro is restored', () => {
    expect(checkLimit('item', 137, false).allowed).toBe(false);
    expect(checkLimit('item', 137, true).allowed).toBe(true);
  });

  it('treats an over-cap closet count the same way', () => {
    const over = checkLimit('closet', 4, false);
    expect(over.allowed).toBe(false);
    expect(over.current).toBe(4);
  });
});
