/**
 * One phone, one account to push for.
 *
 * The bug this closes: a phone's push token stayed on every account that had
 * ever signed in on it. The previous account kept sending its closet-gap
 * nudges there, for its own home city ("Today's forecast in Arlington") and
 * its own closet, while the phone, signed in to another account, was in
 * New Jersey.
 */

import { claimPushToken, releasePushToken, type PushTokenStore } from '../pushTokens';

type Row = { _id: string; pushToken?: string; settings?: { timeZone?: string } };

/** In-memory users collection: just the filter and update shapes these helpers use. */
const fakeUsers = (rows: Row[]): PushTokenStore & { rows: Row[] } => {
  const matches = (row: Row, filter: any): boolean =>
    Object.entries(filter).every(([key, want]: [string, any]) => {
      const have = (row as any)[key];
      if (want && typeof want === 'object' && '$ne' in want) return have !== want.$ne;
      return have === want;
    });
  const apply = (row: Row, update: any) => {
    for (const [key, value] of Object.entries(update.$set ?? {})) {
      if (key === 'settings.timeZone') row.settings = { ...row.settings, timeZone: value as string };
      else (row as any)[key] = value;
    }
    for (const key of Object.keys(update.$unset ?? {})) delete (row as any)[key];
  };
  return {
    rows,
    updateMany: async (filter, update) => {
      rows.filter((r) => matches(r, filter)).forEach((r) => apply(r, update));
    },
    updateOne: async (filter, update) => {
      const row = rows.find((r) => matches(r, filter));
      if (row) apply(row, update);
    },
  };
};

const PHONE = 'ExponentPushToken[phone]';
const IPAD = 'ExponentPushToken[ipad]';

describe('claimPushToken', () => {
  it('takes the token from the account that had it before', async () => {
    const users = fakeUsers([
      { _id: 'arlington', pushToken: PHONE },
      { _id: 'current' },
    ]);
    await claimPushToken(users, 'current', PHONE);
    expect(users.rows.find((r) => r._id === 'arlington')?.pushToken).toBeUndefined();
    expect(users.rows.find((r) => r._id === 'current')?.pushToken).toBe(PHONE);
  });

  it('leaves other phones’ tokens alone', async () => {
    const users = fakeUsers([
      { _id: 'other', pushToken: IPAD },
      { _id: 'current' },
    ]);
    await claimPushToken(users, 'current', PHONE);
    expect(users.rows.find((r) => r._id === 'other')?.pushToken).toBe(IPAD);
  });

  it('re-registering the same account keeps the token and writes the zone', async () => {
    const users = fakeUsers([{ _id: 'current', pushToken: PHONE }]);
    await claimPushToken(users, 'current', PHONE, { 'settings.timeZone': 'America/New_York' });
    expect(users.rows[0]).toEqual({
      _id: 'current',
      pushToken: PHONE,
      settings: { timeZone: 'America/New_York' },
    });
  });
});

describe('releasePushToken', () => {
  it('signing out stops pushes to this phone for that account', async () => {
    const users = fakeUsers([{ _id: 'leaving', pushToken: PHONE }]);
    await releasePushToken(users, 'leaving', PHONE);
    expect(users.rows[0].pushToken).toBeUndefined();
  });

  it('keeps the token of a phone the account signed in on since', async () => {
    const users = fakeUsers([{ _id: 'leaving', pushToken: IPAD }]);
    await releasePushToken(users, 'leaving', PHONE);
    expect(users.rows[0].pushToken).toBe(IPAD);
  });
});
