import axios, { AxiosError } from 'axios';

const client = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});
/**
 * 401 Unauthorised: attempt silent token refresh, then retry once.
 * The 431 cookie handler from the web version is omitted — no cookies in RN.
 */
client.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const config = err.config as any;
    const url: string = config?.url ?? '';

    // Auth endpoints (login / signup / oauth / refresh) legitimately return 401
    // for bad or missing credentials. Those must not trigger a token refresh or a
    // forced logout — and excluding /api/auth/refresh also prevents the interceptor
    // from recursing into itself when the refresh call itself 401s.
    const isAuthEndpoint = url.includes('/api/auth/');

    if (status === 401 && !isAuthEndpoint && !config?._retried401) {
      const { refreshToken, authHeaders, handleSessionExpired } = await import(
        '../lib/auth'
      );
      const newToken = await refreshToken();
      if (newToken) {
        return client.request({
          ...config,
          _retried401: true,
          headers: { ...config.headers, ...authHeaders().headers },
        });
      }
      // Refresh failed — the stored token is dead. Clear it and notify AuthContext
      // so the user is routed to login instead of silently 401ing on every request.
      await handleSessionExpired();
    }

    return Promise.reject(err);
  },
);

export default client;
