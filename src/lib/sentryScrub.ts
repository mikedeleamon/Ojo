/**
 * sentryScrub.ts
 * --------------
 * Removes query strings from URLs before they leave the device inside a Sentry
 * event.
 *
 * Why this exists: the weather and trip endpoints take coordinates as query
 * params (`/api/weather/current?lat=…&lon=…`, see WeatherHUD and useTripMode),
 * and Sentry's breadcrumb integration records request URLs verbatim. Without
 * this, a precise coordinate — for most users, their home — rides along on
 * every error event, and src/config/legal.ts §5 tells users it does not.
 *
 * The product genuinely needs that precision. Debugging never does: the only
 * location-dependent failure class here is polar latitudes, where sunrise and
 * sunset can be absent, and that needs a latitude *band*, not a point.
 * server/src/lib/weatherKit.ts already snaps coordinates to a ~1 km grid for
 * caching on the same reasoning — this is the same judgement one layer out.
 *
 * Deliberately free of any @sentry import so it stays unit-testable under the
 * node test environment. The shapes below are structural on purpose: they
 * describe the parts of a Sentry breadcrumb/event this touches, and nothing
 * else.
 */

/** The slice of a Sentry breadcrumb this module reads. */
export interface ScrubbableBreadcrumb {
  data?: Record<string, unknown>;
}

/** The slice of a Sentry event this module reads. */
export interface ScrubbableEvent {
  request?: { url?: string };
}

/**
 * Drop everything from the first `?` or `#` onward.
 *
 * Done by hand rather than with `new URL()`, which throws on the relative URLs
 * ('/api/weather/current?…') that axios records. Fragments go too: nothing here
 * puts data in one, and a scrubber that only half-covers a URL is worse than an
 * obvious one.
 */
export const stripQuery = (url: string): string => {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
};

/**
 * Scrub the URL on an outgoing breadcrumb. Returns the same object so it can be
 * handed straight back from Sentry's `beforeBreadcrumb`, which treats the
 * return value as the breadcrumb to keep (null would drop it entirely).
 */
export const scrubBreadcrumb = <T extends ScrubbableBreadcrumb>(breadcrumb: T): T => {
  const url = breadcrumb.data?.url;
  if (typeof url === 'string' && breadcrumb.data) {
    breadcrumb.data.url = stripQuery(url);
  }
  return breadcrumb;
};

/**
 * Scrub the request URL recorded on the event itself. Breadcrumbs are the noisy
 * path, but an event carries its own `request.url`, and missing it would leak
 * the same coordinates from a quieter place.
 */
export const scrubEvent = <T extends ScrubbableEvent>(event: T): T => {
  if (typeof event.request?.url === 'string') {
    event.request.url = stripQuery(event.request.url);
  }
  return event;
};
