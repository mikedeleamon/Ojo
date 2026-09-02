import axios, { AxiosError } from 'axios';

/**
 * Base URL for the API, inlined by Metro at bundle time from the build
 * profile's `EXPO_PUBLIC_API_URL` (see eas.json).
 *
 * A release build that reaches here without one is unshippable, so it fails
 * loudly at import instead of falling back. The old `?? 'http://localhost:4000'`
 * default made a misconfigured production build look healthy: every request
 * would quietly go nowhere, and NSAllowsLocalNetworking is true in
 * ios/Ojo/Info.plist, so the OS wouldn't even flag the cleartext localhost call.
 * The failure would surface as "the app just doesn't load anything" — in
 * TestFlight, or in review.
 *
 * The localhost default is kept for __DEV__ only, where it is the correct
 * behaviour for `npm run dev`.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? 'http://localhost:4000' : '');

if (!API_URL) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. A release build cannot reach the API without it — ' +
    'set it in the eas.json build profile.',
  );
}

const client = axios.create({
  baseURL: API_URL,
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

    // The account owes us a date of birth and the server is refusing its data
    // routes until it gets one. This is the backstop for a cold start with a
    // remembered token, where no auth response carried the flag. Setting it
    // here routes the user to the age gate on the next navigation.
    if (status === 403 && (err.response?.data as any)?.code === 'AGE_VERIFICATION_REQUIRED') {
      const { setAgeVerificationNeeded } = await import('../lib/ageGate');
      await setAgeVerificationNeeded(true);
    }

    return Promise.reject(err);
  },
);

export default client;
