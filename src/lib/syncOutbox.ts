/**
 * syncOutbox.ts
 * -------------
 * Changes made on this device that the server hasn't confirmed yet, for one
 * synced collection (outfit history, TripFit plans).
 *
 * Writes go to local storage first and the server second. When the server call
 * fails (offline, a 500), the change waits here and is sent again after the
 * next successful load. The outbox is also how a load tells apart two records
 * that look the same in the server's list: a local record the server lacks
 * because it never got there (in the outbox: keep it and resend) and one it
 * lacks because another device deleted it (not in the outbox: drop it).
 */

import { storage, storageGetJSON } from './storage';

export interface Outbox {
  /** Record id → version of the local copy waiting to upload. */
  push: Record<string, string>;
  /** Ids deleted on this device whose server delete hasn't landed. */
  del: string[];
  /** When a "clear all" happened on this device, until the server confirms it. */
  clearAt?: string;
  /**
   * False until the first successful load on an install that predates the
   * outbox. That load queues whatever the old one-time migration left behind.
   */
  seeded: boolean;
}

/** Uploads, deletes and clears the server confirmed after a `mark()`. */
export interface Settled {
  pushed:    Set<string>;
  deleted:   Set<string>;
  clearedAt: number | null;
}

export interface OutboxStore {
  read(): Promise<Outbox>;
  write(box: Outbox): Promise<void>;
  /** Call just before requesting the server's list; pass the result to settledSince(). */
  mark(): number;
  /**
   * What the server confirmed after `mark`. The list being merged may predate
   * it, so it can lack a record whose upload has since landed (keep the local
   * copy) or still hold one whose delete has (hide it).
   */
  settledSince(mark: number): Settled;
  /**
   * Runs `fn` once every earlier call has settled. Every read-modify-write of
   * the collection and its outbox goes through here, so a load's merge can't
   * overwrite a record saved while its request was in flight.
   */
  locked<T>(fn: () => Promise<T>): Promise<T>;
  /** The server has `version` of `id`. A newer local edit stays queued. */
  confirmPush(id: string, version: string): Promise<void>;
  confirmDelete(id: string): Promise<void>;
  confirmClear(at: string): Promise<void>;
}

export const createOutboxStore = (key: () => string): OutboxStore => {
  let tail: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };

  const read = async (): Promise<Outbox> => ({
    push: {},
    del: [],
    seeded: false,
    ...(await storageGetJSON<Partial<Outbox>>(storage, key(), {})),
  });
  const write = (box: Outbox) => storage.setItem(key(), JSON.stringify(box));
  const update = (fn: (box: Outbox) => void) =>
    locked(async () => {
      const box = await read();
      fn(box);
      await write(box);
    });

  // In memory only: a list request can't outlive the app session it was sent in.
  let seq = 0;
  const settled = new Map<string, { seq: number; kind: 'push' | 'del' }>();
  let lastClear: { seq: number; at: number } | null = null;

  return {
    read,
    write,
    locked,
    mark: () => seq,
    settledSince: mark => {
      const out: Settled = { pushed: new Set(), deleted: new Set(), clearedAt: null };
      settled.forEach((s, id) => {
        if (s.seq > mark) (s.kind === 'push' ? out.pushed : out.deleted).add(id);
      });
      if (lastClear && lastClear.seq > mark) out.clearedAt = lastClear.at;
      return out;
    },
    confirmPush: (id, version) => update(box => {
      if (box.push[id] === version) delete box.push[id];
      settled.set(id, { seq: ++seq, kind: 'push' });
    }),
    confirmDelete: id => update(box => {
      box.del = box.del.filter(d => d !== id);
      settled.set(id, { seq: ++seq, kind: 'del' });
    }),
    confirmClear: at => update(box => {
      if (box.clearAt === at) delete box.clearAt;
      lastClear = { seq: ++seq, at: new Date(at).getTime() };
    }),
  };
};
