import { useReducer, useEffect, useCallback } from 'react';
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
  createCloset: (name: string) => Promise<void>;
  renameCloset: (id: string, name: string) => Promise<void>;
  deleteCloset: (id: string) => Promise<void>;
  addArticle:   (closetId: string, data: ArticleFormData) => Promise<void>;
  editArticle:  (closetId: string, articleId: string, data: ArticleFormData) => Promise<void>;
  removeArticle:(closetId: string, articleId: string) => Promise<void>;
  setPreferred: (id: string) => Promise<void>;
}

// ─── Shared module-level store ─────────────────────────────────────────────────
// Every useClosets() consumer reads from one cache and shares a single in-flight
// request, so the closet list is fetched once per session (plus explicit
// refreshes) instead of once per screen mount. A screen that gains focus
// re-validates in the background — the last data stays on screen rather than
// dropping back to a full-screen spinner. Fixes the "spinner on every tab
// switch" and the duplicate fetch when two screens mount at once.
let cache:    Closet[] | null = null;
let loaded    = false;                  // a fetch has completed (ok or errored)
let inFlight: Promise<void> | null = null;
let error:    string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const updateCache = (fn: (prev: Closet[]) => Closet[]) => {
  cache = fn(cache ?? []);
  emit();
};

/**
 * Fetch closets into the shared cache. No-ops if data is already cached (unless
 * `force`) or a fetch is already in flight, so concurrent mounts and repeated
 * focus events collapse to one network request.
 */
function load(force = false): Promise<void> {
  if (inFlight) return inFlight;
  if (loaded && !force) return Promise.resolve();

  const token = getToken();
  if (!token) {
    cache = cache ?? [];
    loaded = true;
    emit();
    return Promise.resolve();
  }

  inFlight = axios.get<Closet[]>('/api/closets', auth())
    .then(({ data }) => { cache = data; error = null; })
    .catch(() => { error = 'Could not load closets. Is the server running?'; })
    .finally(() => { inFlight = null; loaded = true; emit(); });
  emit(); // surface the in-flight (refreshing) state immediately
  return inFlight;
}

/** Clears the shared cache — call on logout so the next account starts clean. */
export const resetClosetsCache = () => {
  cache = null;
  loaded = false;
  error = null;
  emit();
};

/**
 * Fetches all closets for the authenticated user and exposes CRUD operations.
 * Backed by a shared cache so the list is fetched once and reused across every
 * screen that calls this hook.
 */
export const useClosets = (): UseClosetsResult => {
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(rerender);
    load(); // no-op if already cached / in flight
    return () => { listeners.delete(rerender); };
  }, []);

  const closets = cache ?? [];
  // Only a true cold start (nothing fetched yet) shows the blocking spinner.
  // Focus-triggered background refreshes keep the previous data on screen.
  const loading = !loaded;
  const preferred = closets.find((c) => c.isPreferred) ?? null;

  const refresh = useCallback(() => { void load(true); }, []);

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

  return { closets, loading, error, preferred, setClosets, refresh, createCloset, renameCloset,
           deleteCloset, addArticle, editArticle, removeArticle, setPreferred };
};
