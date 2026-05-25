interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_ENTRIES = 2_000;
const store = new Map<string, CacheEntry<unknown>>();

export function ttlGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function ttlSet<T>(key: string, data: T, ttlMs: number): void {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    // Evict the oldest insertion (Map preserves insertion order)
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function ttlDelete(key: string): void {
  store.delete(key);
}

export function ttlClearAll(): void {
  store.clear();
}
