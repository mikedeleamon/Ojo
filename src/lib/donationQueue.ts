/**
 * donationQueue.ts
 * ----------------
 * Persistent list of article IDs the user has flagged for donation.
 * Stored locally in AsyncStorage only — no server sync needed (ephemeral by
 * design; the queue is cleared when items are donated or removed).
 *
 * Integrates with the Insights tab: sleeping items can be moved here,
 * and "Mark as donated" calls removeArticle() on the closet + clears the entry.
 */

import { storage, storageGetJSON } from './storage';
import { getUserId } from './auth';

const KEY = (): string =>
  `ojo_donation_queue_${getUserId() ?? 'anon'}`;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Load the full queue (array of article IDs). */
export const loadDonationQueue = async (): Promise<string[]> =>
  storageGetJSON<string[]>(storage, KEY(), []);

/** Add an article ID to the queue (idempotent — no duplicates). */
export const addToDonationQueue = async (articleId: string): Promise<void> => {
  const queue = await loadDonationQueue();
  if (!queue.includes(articleId)) {
    await storage.setItem(KEY(), JSON.stringify([...queue, articleId]));
  }
};

/** Remove a single article ID from the queue. */
export const removeFromDonationQueue = async (articleId: string): Promise<void> => {
  const queue = await loadDonationQueue();
  await storage.setItem(
    KEY(),
    JSON.stringify(queue.filter(id => id !== articleId)),
  );
};

/** Check if a specific article is in the queue. */
export const isInDonationQueue = async (articleId: string): Promise<boolean> => {
  const queue = await loadDonationQueue();
  return queue.includes(articleId);
};

/** Clear the entire queue (e.g. after a donation run). */
export const clearDonationQueue = async (): Promise<void> => {
  await storage.removeItem(KEY());
};
