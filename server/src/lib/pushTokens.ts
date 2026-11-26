/**
 * pushTokens.ts — which account a phone's push token belongs to.
 *
 * An Expo push token identifies one install of the app on one phone, not an
 * account. Every account that has ever signed in on that phone registers the
 * same token, so the token has to belong to exactly one of them: the one
 * signed in now.
 *
 * Registration used to set the token on the signed-in account and leave it
 * wherever else it already was, and signing out left it in place too. The
 * previous account kept pushing to the phone: its closet-gap nudges and
 * weather alerts named its own home city and judged its own closet, while the
 * phone, signed in to a different account, reported where it actually was
 * to that other account. The user saw "Today's forecast in Arlington"
 * while in New Jersey, with a coat in the closet they were signed in to.
 */

/** The parts of the User model these need — narrowed so tests can pass a fake. */
export interface PushTokenStore {
  updateMany(filter: object, update: object): PromiseLike<unknown>;
  updateOne(filter: object, update: object): PromiseLike<unknown>;
}

/**
 * Give `pushToken` to `userId`, taking it from any other account that has it.
 * `alsoSet` rides along on the same write (the device's time zone).
 */
export async function claimPushToken(
  users: PushTokenStore,
  userId: string,
  pushToken: string,
  alsoSet: Record<string, unknown> = {},
): Promise<void> {
  await users.updateMany(
    { pushToken, _id: { $ne: userId } },
    { $unset: { pushToken: '' } },
  );
  await users.updateOne({ _id: userId }, { $set: { pushToken, ...alsoSet } });
}

/**
 * Signing out on this phone: stop pushing to it for `userId`. Only when the
 * account still holds this phone's token — if the same account signed in on
 * another phone since, the token stored is that phone's, and it stays.
 */
export async function releasePushToken(
  users: PushTokenStore,
  userId: string,
  pushToken: string,
): Promise<void> {
  await users.updateOne({ _id: userId, pushToken }, { $unset: { pushToken: '' } });
}
