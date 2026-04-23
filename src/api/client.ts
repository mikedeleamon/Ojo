import axios, { AxiosError } from 'axios';

const rawBase = process.env.REACT_APP_SERVER_BASE ?? '';
const base    = rawBase.replace(/\/+$/g, '');

const client = axios.create({
  baseURL:         base,
  withCredentials: false,
  headers:         { 'Content-Type': 'application/json' },
});

/**
 * Response interceptor — catches 431 Request Header Fields Too Large.
 *
 * 431 is almost always caused by oversized browser cookies being forwarded
 * through the dev proxy. The fix is to clear cookies and retry once.
 *
 * In production (where there is no proxy), 431 can't happen this way because
 * withCredentials: false prevents cross-origin cookies. This interceptor is
 * therefore a dev-time safety net.
 */
client.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    const status = err.response?.status;

    if (status === 431 && !(err.config as any)?._retried431) {
      // Import lazily to avoid circular dep
      const { clearAllCookies } = await import('../helpers/cookieUtils');
      clearAllCookies();
      console.warn('[Ojo] 431 intercepted — cleared cookies and retrying request.');

      const retryConfig = { ...err.config, _retried431: true };
      return client.request(retryConfig);
    }

    return Promise.reject(err);
  }
);

export default client;
