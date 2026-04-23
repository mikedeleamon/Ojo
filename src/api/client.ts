import axios, { AxiosError } from 'axios';

const rawBase = process.env.REACT_APP_SERVER_BASE ?? '';
const base    = rawBase.replace(/\/+$/g, '');

const client = axios.create({
  baseURL:         base,
  withCredentials: false,
  headers:         { 'Content-Type': 'application/json' },
});

/**
 * Response interceptor — handles two error cases:
 *
 * 431 Request Header Fields Too Large (dev only):
 *   Caused by oversized localhost cookies forwarded through the dev proxy.
 *   Fix: clear cookies and retry the request once.
 *
 * 401 Unauthorised:
 *   Token has expired mid-session. Attempt a silent refresh, then retry
 *   the original request with the new token. If the refresh also fails
 *   (e.g. the refresh token itself is expired) the 401 propagates and
 *   callers can handle logout.
 */
client.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const config = err.config as any;

    // ── 431: clear cookies and retry once ─────────────────────────────────
    if (status === 431 && !config?._retried431) {
      const { clearAllCookies } = await import('../helpers/cookieUtils');
      clearAllCookies();
      console.warn('[Ojo] 431 intercepted — cleared cookies and retrying request.');
      return client.request({ ...config, _retried431: true });
    }

    // ── 401: attempt silent token refresh, then retry once ────────────────
    if (status === 401 && !config?._retried401) {
      const { refreshToken, getToken, authHeaders } = await import('../lib/auth');
      const newToken = await refreshToken();
      if (newToken) {
        // Update Authorization header with the fresh token and retry
        const retryConfig = {
          ...config,
          _retried401: true,
          headers: {
            ...config.headers,
            ...authHeaders().headers,
          },
        };
        return client.request(retryConfig);
      }
      // Refresh failed — let the 401 propagate so the caller can log out
    }

    return Promise.reject(err);
  }
);

export default client;
