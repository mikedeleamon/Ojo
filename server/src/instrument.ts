/**
 * instrument.ts — Sentry initialisation for the API.
 *
 * Imported for its side effect only, and imported *before* express, mongoose,
 * and the routes so Sentry's auto-instrumentation can patch them as they load.
 * It sits after dotenv.config() in index.ts because it reads SENTRY_DSN from
 * the same .env — see the ordering note there.
 *
 * Inert until SENTRY_DSN is set (Railway → Variables). Same shape as
 * src/lib/share/deepLinks.ts on the client: an unset variable disables the
 * feature quietly rather than throwing at boot, so a missing variable can never
 * be the reason the API fails to start.
 */

import * as Sentry from '@sentry/node';

const DSN = process.env.SENTRY_DSN;

/**
 * Coordinates reach Sentry two different ways here, and only one of them is a
 * query string:
 *
 *   inbound   /api/weather/current?lat=…&lon=…   raw client coordinates
 *   outbound  weatherkit.apple.com/api/v1/weather/en/40.71/-74.01
 *
 * The outbound pair is already snapped to the ~1 km cache grid by
 * lib/weatherKit.ts, but it sits in the URL *path*, where stripping a query
 * string accomplishes nothing. Both get handled. Mirrors src/lib/sentryScrub.ts
 * on the client; kept separate because the two packages don't share a tsconfig.
 */
const stripQuery = (url: string): string => {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
};

const redactWeatherKitPath = (url: string): string =>
  url.replace(
    /(weatherkit\.apple\.com\/api\/v1\/weather\/[^/]+)\/-?\d+(?:\.\d+)?\/-?\d+(?:\.\d+)?/,
    '$1/<lat>/<lon>',
  );

const scrubUrl = (url: string): string => redactWeatherKitPath(stripQuery(url));

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',

    // Off for the same reason as the client (see app/_layout.tsx): IP addresses
    // and request headers aren't declared in the privacy policy. Leaving this
    // false is also what keeps Authorization headers and request bodies — which
    // on this server carry JWTs and plaintext passwords — out of events by
    // default. The scrubber below is a second line of defence, not the first.
    sendDefaultPii: false,

    // Performance tracing is a separate data stream and a separate cost. Errors
    // are what we actually need at launch; turn this up deliberately later.
    tracesSampleRate: 0,

    beforeBreadcrumb(breadcrumb) {
      const url = breadcrumb.data?.url;
      if (typeof url === 'string' && breadcrumb.data) {
        breadcrumb.data.url = scrubUrl(url);
      }
      return breadcrumb;
    },

    beforeSend(event) {
      if (typeof event.request?.url === 'string') {
        event.request.url = scrubUrl(event.request.url);
      }
      const headers = event.request?.headers;
      if (headers) {
        for (const k of Object.keys(headers)) {
          if (/^(authorization|cookie|x-api-key)$/i.test(k)) headers[k] = '[redacted]';
        }
      }
      // Never ship a request body from this API. Auth routes carry passwords,
      // and no error here is worth more than that guarantee.
      if (event.request) delete event.request.data;
      return event;
    },
  });
  console.log('[sentry] initialised');
} else {
  console.log('[sentry] SENTRY_DSN unset — error reporting disabled');
}

export const sentryEnabled = Boolean(DSN);
