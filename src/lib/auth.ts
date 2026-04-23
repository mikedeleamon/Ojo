/**
 * Single source of truth for auth-token access and header construction.
 * Uses secureStorage so the token migrates to Keychain/Keystore in React Native.
 */

import { secureStorage, storageGetJSON } from './storage';

export const AUTH_KEY = 'ojo_auth';

interface AuthPayload { token?: string; user?: unknown; }

export const getToken = (): string | null => {
  // Synchronous read for cases that need it (axios interceptors, etc.)
  // Works on web because secureStorage wraps localStorage synchronously.
  // RN migration: replace callers with async getTokenAsync() below.
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').token ?? null;
  } catch {
    return null;
  }
};

/** Async version — use this in new code; required in React Native. */
export const getTokenAsync = async (): Promise<string | null> => {
  const payload = await storageGetJSON<AuthPayload>(secureStorage, AUTH_KEY, {});
  return payload.token ?? null;
};

export const authHeaders = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

/** Convenience alias. */
export const auth = authHeaders;

/** Save auth payload to secure storage. */
export const saveAuth = async (token: string, user: unknown): Promise<void> => {
  await secureStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
};

/** Update the stored user object (e.g. after profile edit). */
export const updateAuthUser = async (patch: Record<string, unknown>): Promise<void> => {
  const payload = await storageGetJSON<AuthPayload>(secureStorage, AUTH_KEY, {});
  await secureStorage.setItem(AUTH_KEY, JSON.stringify({
    ...payload,
    user: { ...(payload.user as object ?? {}), ...patch },
  }));
};

/** Clear all auth state. */
export const clearAuth = async (): Promise<void> => {
  await secureStorage.removeItem(AUTH_KEY);
};

/**
 * Returns true if the stored token will expire within the next `withinSeconds`.
 * Used to decide whether a proactive refresh is needed.
 */
export const isTokenExpiringSoon = (withinSeconds = 86_400): boolean => {
  try {
    const token = getToken();
    if (!token) return false;
    // JWT payload is the second base64 segment
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload?.exp) return false;
    return payload.exp - Date.now() / 1000 < withinSeconds;
  } catch {
    return false;
  }
};

/**
 * Calls POST /api/auth/refresh with the current token and saves the new one.
 * Returns the new token string, or null if the refresh failed.
 *
 * RN migration: identical — the endpoint is the same, only storage changes.
 */
export const refreshToken = async (): Promise<string | null> => {
  try {
    // Import lazily to avoid circular dependency with api/client
    const { default: client } = await import('../api/client');
    const { data } = await client.post<{ token: string }>('/api/auth/refresh', {}, authHeaders());
    if (!data?.token) return null;
    const payload = await storageGetJSON<AuthPayload>(secureStorage, AUTH_KEY, {});
    await secureStorage.setItem(AUTH_KEY, JSON.stringify({ ...payload, token: data.token }));
    return data.token;
  } catch {
    return null;
  }
};

/** Extracts a human-readable message from an unknown catch value. */
type ApiError = { response?: { data?: { error?: string } }; message?: string };
export const getErrorMessage = (err: unknown, fallback = 'Something went wrong.'): string => {
  const e = err as ApiError;
  return e?.response?.data?.error ?? e?.message ?? fallback;
};
