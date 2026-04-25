/**
 * Auth library — React Native implementation.
 * Uses expo-secure-store via the secureStorage abstraction.
 * Token is cached in-memory after initAuthCache() is called at startup.
 */

import { Buffer } from 'buffer';
import { secureStorage, storageGetJSON } from './storage';

export const AUTH_KEY = 'ojo_auth';

interface AuthPayload { token?: string; user?: unknown; }

// ─── In-memory cache ──────────────────────────────────────────────────────────
// getToken() stays synchronous (used in axios interceptors).
// initAuthCache() must be called once at app startup before rendering.

let _cachedToken: string | null = null;

/** Call once during splash screen before rendering anything. */
export const initAuthCache = async (): Promise<void> => {
  _cachedToken = await getTokenAsync();
};

/** Synchronous — reads the in-memory cache. Safe after initAuthCache() resolves. */
export const getToken = (): string | null => _cachedToken;

/** Async version — reads directly from SecureStore. */
export const getTokenAsync = async (): Promise<string | null> => {
  const payload = await storageGetJSON<AuthPayload>(secureStorage, AUTH_KEY, {});
  return payload.token ?? null;
};

export const authHeaders = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const auth = authHeaders;

export const saveAuth = async (token: string, user: unknown): Promise<void> => {
  _cachedToken = token;
  await secureStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
};

export const updateAuthUser = async (patch: Record<string, unknown>): Promise<void> => {
  const payload = await storageGetJSON<AuthPayload>(secureStorage, AUTH_KEY, {});
  await secureStorage.setItem(AUTH_KEY, JSON.stringify({
    ...payload,
    user: { ...(payload.user as object ?? {}), ...patch },
  }));
};

export const clearAuth = async (): Promise<void> => {
  _cachedToken = null;
  await secureStorage.removeItem(AUTH_KEY);
};

/**
 * Returns true if the stored token will expire within the next `withinSeconds`.
 * Uses Buffer instead of atob() which is unavailable in the RN JS engine.
 */
export const isTokenExpiringSoon = (withinSeconds = 86_400): boolean => {
  try {
    const token = getToken();
    if (!token) return false;
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
    );
    if (!payload?.exp) return false;
    return payload.exp - Date.now() / 1000 < withinSeconds;
  } catch {
    return false;
  }
};

export const refreshToken = async (): Promise<string | null> => {
  try {
    const { default: client } = await import('../api/client');
    const { data } = await client.post<{ token: string }>('/api/auth/refresh', {}, authHeaders());
    if (!data?.token) return null;
    const payload = await storageGetJSON<AuthPayload>(secureStorage, AUTH_KEY, {});
    await secureStorage.setItem(AUTH_KEY, JSON.stringify({ ...payload, token: data.token }));
    _cachedToken = data.token;
    return data.token;
  } catch {
    return null;
  }
};

type ApiError = { response?: { data?: { error?: string } }; message?: string };
export const getErrorMessage = (err: unknown, fallback = 'Something went wrong.'): string => {
  const e = err as ApiError;
  return e?.response?.data?.error ?? e?.message ?? fallback;
};
