/**
 * Telling the server where the device actually is, for trips.
 *
 * Server-sent weather notifications used to name the user's home city no matter
 * where they were: three days into a trip to Ocho Rios, the phone still said
 * "Rain is moving into Arlington." The server can see the saved trip's dates,
 * but dates only say the user *planned* to be somewhere — acting on them alone
 * would have moved those notifications to a city they may never have reached.
 *
 * Trip Mode already resolves the one fact that settles it, from a GPS fix it
 * takes anyway (hooks/useTripMode.ts · selectActiveTrip). This posts that
 * verdict up so the notification passes can use it (server/src/lib/activeTrip.ts).
 *
 * Only the trip's id goes over the wire. The destination is already on the
 * plan, so confirming presence never needs the device's coordinates to leave
 * it — and the server never learns where the user is, only which of their own
 * trips they are on.
 */

import api from '../api/client';
import { authHeaders, getToken } from './auth';
import { storage, storageGetJSON, storageSetJSON } from './storage';

const PRESENCE_KEY = 'ojo_trip_presence_sent';

/**
 * How often a standing confirmation is refreshed.
 *
 * The server expires confirmations it hasn't heard about in two days, so this
 * only needs to be comfortably inside that: at six hours a device that opens
 * the app even once a day stays confirmed with several refreshes to spare,
 * while a phone that goes quiet still ages out on the server's schedule.
 */
const REFRESH_MS = 6 * 60 * 60 * 1_000;

interface SentPresence {
  tripId: string | null;
  at:     number;
}

const readSent = (): Promise<SentPresence | null> =>
  storageGetJSON<SentPresence | null>(storage, PRESENCE_KEY, null);

/**
 * Report that the device is at `tripId`'s destination, or `null` that GPS put
 * it at none of the user's trip cities. Call only when GPS actually answered —
 * silence is what lets a stale confirmation expire rather than being replaced
 * by a guess.
 *
 * Cheap to call on every Trip Mode resolution: the last value sent is cached on
 * disk, so this is a no-op unless the answer changed or the standing
 * confirmation is due for a refresh. A user with no trips never posts at all —
 * clearing something that was never set is not worth a request.
 */
export const reportTripPresence = async (tripId: string | null): Promise<void> => {
  if (!getToken()) return;

  const sent = await readSent();
  if (tripId === null && !sent?.tripId) return;
  if (sent && sent.tripId === tripId && Date.now() - sent.at < REFRESH_MS) return;

  try {
    await api.post('/api/notifications/trip-presence', { tripId }, authHeaders());
    await storageSetJSON(storage, PRESENCE_KEY, { tripId, at: Date.now() });
  } catch {
    // Best-effort. Leaving the cache alone means the next resolution retries,
    // and the server expires the old confirmation on its own either way.
  }
};

/**
 * Forget what this device has reported.
 *
 * For sign-out: the cache is what suppresses redundant posts, so without this
 * the next account would inherit "already told them" for a trip that isn't
 * theirs and skip its own first report.
 */
export const clearTripPresenceCache = (): Promise<void> =>
  storage.removeItem(PRESENCE_KEY);
