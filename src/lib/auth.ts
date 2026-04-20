/** Single source of truth for auth-token access and header construction. */

export const AUTH_KEY = 'ojo_auth';

export const getToken = (): string | null => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').token ?? null;
  } catch {
    return null;
  }
};

export const authHeaders = () => {
  const token = getToken();
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

/** Convenience alias used by ClosetPage-style callers that need the full config object. */
export const auth = authHeaders;

/** Extracts a human-readable message from an unknown catch value. */
type ApiError = { response?: { data?: { error?: string } }; message?: string };
export const getErrorMessage = (err: unknown, fallback = 'Something went wrong.'): string => {
  const e = err as ApiError;
  return e?.response?.data?.error ?? e?.message ?? fallback;
};
