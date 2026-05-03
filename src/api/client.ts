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

    if (status === 401 && !config?._retried401) {
      const { refreshToken, authHeaders } = await import('../lib/auth');
      const newToken = await refreshToken();
      if (newToken) {
        return client.request({
          ...config,
          _retried401: true,
          headers: { ...config.headers, ...authHeaders().headers },
        });
      }
    }

    return Promise.reject(err);
  },
);

export default client;
