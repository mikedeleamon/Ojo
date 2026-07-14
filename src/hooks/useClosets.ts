import { useSyncExternalStore, useEffect, useCallback } from 'react';
import axios from '../api/client';
import { Closet } from '../types';
import { auth, getToken } from '../lib/auth';
import { ArticleFormData } from '../types';

interface UseClosetsResult {
  closets:      Closet[];
  loading:      boolean;
  error:        string | null;
  preferred:    Closet | null;
  setClosets:   React.Dispatch<React.SetStateAction<Closet[]>>;
  refresh:      () => void;
  createCloset: (name: string) => Promise<Closet>;
  renameCloset: (id: string, name: string) => Promise<void>;
  deleteCloset: (id: string) => Promise<void>;
  addArticle:   (closetId: string, data: ArticleFormData) => Promise<void>;
  editArticle:  (closetId: string, articleId: string, data: ArticleFormData) => Promise<void>;
  removeArticle:(closetId: string, articleId: string) => Promise<void>;
  setPreferred: (id: string) => Promise<void>;
  /** User-initiated refetch (pull-to-refresh) that bypasses the freshness
   *  throttle. Resolves when the network round-trip settles, so a RefreshControl
   *  can await it to hide its spinner. */
  hardRefresh:  () => Promise<void>;
}

// ─── Shared module-level store ─────────────────────────────────────────────────
// Every useClosets() consumer reads from one cache and shares a single in-flight
// request, so the closet list is fetched once per session (plus explicit
// refreshes) instead of once per screen mount. A screen that gains focus
// re-validates in the background — the last data stays on screen rather than
// dropping back to a full-screen spinner.
//
// Consumers subscribe via useSyncExternalStore, and the store only publishes a
// new snapshot when the data actually changed. A focus-driven refetch that
// returns byte-identical closets keeps the same array reference, so nothing
// downstream re-renders, outfit generation doesn't re-run, and the home-screen
// widget isn't rewritten — refetching is cheap instead of a full app-wide
// render cascade.
const EMPTY: Closet[] = [];

let cache:    Closet[] | null = null;
let loaded    = false;                  // a fetch has completed (ok or errored)
let fetchedAt = 0;                      // when the last successful fetch landed
let inFlight: Promise<void> | null = null;
let error:    string | null = null;

interface ClosetSnapshot {
  closets: Closet[];
  loading: boolean;
  error:   string | null;
}

let snapshot: ClosetSnapshot = { closets: EMPTY, loading: true, error: null };
const listeners = new Set<() => void>();

/** Rebuild the snapshot object and notify subscribers. Call only on real change —
 *  useSyncExternalStore skips re-rendering when getSnapshot() is unchanged, so
 *  an unnecessary publish here is an unnecessary render everywhere. */
const publish = () => {
  snapshot = { closets: cache ?? EMPTY, loading: !loaded, error };
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
const getSnapshot = () => snapshot;

const updateCache = (fn: (prev: Closet[]) => Closet[]) => {
  cache = fn(cache ?? EMPTY);
  publish();
};

/** Focus-driven revalidations inside this window are skipped entirely — quick
 *  tab flips shouldn't refire the network on every switch. Mutations bypass
 *  this by writing the server's response straight into the cache. */
const FRESH_MS = 15_000;

/**
 * Fetch closets into the shared cache. Concurrent mounts and repeated focus
 * events collapse to one network request; data fresher than FRESH_MS isn't
 * refetched even when forced (unless `bypassThrottle` — an explicit
 * pull-to-refresh). If the server returns data identical to what's cached, the
 * old array reference is kept and no re-render is published.
 */
function load(force = false, bypassThrottle = false): Promise<void> {
  if (inFlight) return inFlight;
  if (loaded && !force) return Promise.resolve();
  if (loaded && force && !bypassThrottle && Date.now() - fetchedAt < FRESH_MS)
    return Promise.resolve();

  const token = getToken();
  if (!token) {
    if (!loaded || cache == null) {
      cache = cache ?? EMPTY;
      loaded = true;
      publish();
    }
    return Promise.resolve();
  }

  inFlight = axios.get<Closet[]>('/api/closets', auth())
    .then(({ data }) => {
      fetchedAt = Date.now();
      const changed =
        cache == null || JSON.stringify(cache) !== JSON.stringify(data);
      if (changed) cache = data;
      const hadError = error != null;
      error = null;
      inFlight = null;
      const wasLoaded = loaded;
      loaded = true;
      if (changed || hadError || !wasLoaded) publish();
    })
    .catch(() => {
      error = 'Could not load closets. Is the server running?';
      inFlight = null;
      loaded = true;
      publish();
    });
  return inFlight;
}

/** Force a fresh fetch past the throttle — for pull-to-refresh from screens
 *  that don't hold the hook (e.g. Home's WeatherHUD refresh). */
export const refreshClosets = (): Promise<void> => load(true, true);

/** Clears the shared cache — call on logout so the next account starts clean. */
export const resetClosetsCache = () => {
  cache = null;
  loaded = false;
  fetchedAt = 0;
  error = null;
  publish();
};

/**
 * Fetches all closets for the authenticated user and exposes CRUD operations.
 * Backed by a shared cache so the list is fetched once and reused across every
 * screen that calls this hook.
 */
export const useClosets = (): UseClosetsResult => {
  const { closets, loading, error } = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    void load(); // no-op if already cached / in flight
  }, []);

  // Only a true cold start (nothing fetched yet) shows the blocking spinner.
  // Focus-triggered background refreshes keep the previous data on screen.
  const preferred = closets.find((c) => c.isPreferred) ?? null;

  const refresh = useCallback(() => { void load(true); }, []);
  const hardRefresh = useCallback(() => load(true, true), []);

  const setClosets = useCallback<React.Dispatch<React.SetStateAction<Closet[]>>>((update) => {
    updateCache((prev) =>
      typeof update === 'function'
        ? (update as (p: Closet[]) => Closet[])(prev)
        : update,
    );
  }, []);

  const patch = useCallback((id: string, updated: Closet) =>
    updateCache((prev) => prev.map((c) => c._id === id ? updated : c)), []);

  const createCloset = useCallback(async (name: string) => {
    const { data } = await axios.post<Closet>('/api/closets', { name }, auth());
    updateCache((prev) => [data, ...prev]);
    return data;
  }, []);

  const renameCloset = useCallback(async (id: string, name: string) => {
    const { data } = await axios.put<Closet>(`/api/closets/${id}`, { name }, auth());
    patch(id, data);
  }, [patch]);

  const deleteCloset = useCallback(async (id: string) => {
    await axios.delete(`/api/closets/${id}`, auth());
    updateCache((prev) => prev.filter((c) => c._id !== id));
  }, []);

  const addArticle = useCallback(async (closetId: string, formData: ArticleFormData) => {
    const { data } = await axios.post<Closet>(`/api/closets/${closetId}/articles`, formData, auth());
    patch(closetId, data);
  }, [patch]);

  const editArticle = useCallback(async (closetId: string, articleId: string, formData: ArticleFormData) => {
    const { data } = await axios.put<Closet>(`/api/closets/${closetId}/articles/${articleId}`, formData, auth());
    patch(closetId, data);
  }, [patch]);

  const removeArticle = useCallback(async (closetId: string, articleId: string) => {
    const { data } = await axios.delete<Closet>(`/api/closets/${closetId}/articles/${articleId}`, auth());
    patch(closetId, data);
  }, [patch]);

  const setPreferred = useCallback(async (id: string) => {
    // The endpoint toggles, so the returned closet may now be un-preferred.
    // Apply its actual isPreferred and clear every other closet.
    const { data } = await axios.put<Closet>(`/api/closets/${id}/preferred`, {}, auth());
    updateCache((prev) => prev.map((c) => c._id === data._id ? data : { ...c, isPreferred: false }));
  }, []);

  return { closets, loading, error, preferred, setClosets, refresh, hardRefresh, createCloset, renameCloset,
           deleteCloset, addArticle, editArticle, removeArticle, setPreferred };
};
