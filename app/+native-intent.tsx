/**
 * +native-intent — maps external deep links (widget taps, notifications) to
 * in-app expo-router routes. Runs for both cold-start and warm links.
 *
 * Widget contract (see src/lib/widget/deepLinks.ts):
 *   ojo://outfit     → "/"                              (home tab · today's outfit)
 *   ojo://trip/<id>  → "/account/tripfit?planId=<id>"   (opens the saved trip)
 *
 * expo-router hands us the FULL incoming URL as `path` (which may be null).
 * Anything we don't recognize is returned unchanged so normal routing/linking
 * still applies (e.g. reset-password links and already-internal paths).
 *
 * Never throw here — a thrown error can crash launch; we wrap in try/catch and
 * fall back to the original path.
 */
export function redirectSystemPath({
  path,
}: {
  path: string | null;
  initial: boolean;
}): string | null {
  if (!path) return path;

  try {
    // "<scheme>://<rest>" → "<rest>" (host + path + query). Non-scheme inputs
    // (already-internal paths) fall through unchanged.
    const schemeSplit = path.match(/^[a-zA-Z][\w+.-]*:\/\/(.*)$/);
    if (!schemeSplit) return path;

    const rest = schemeSplit[1];
    const beforeHash = rest.split('#')[0];
    const route = beforeHash.split('?')[0];
    // Collapse leading/trailing slashes: "outfit" and "/trip/123/" both normalize.
    const normalized = '/' + route.replace(/^\/+/, '').replace(/\/+$/, '');

    // Home / today's outfit
    if (normalized === '/outfit') return '/';

    // Trip → open the saved plan in TripFit
    const trip = normalized.match(/^\/trip\/([^/]+)$/);
    if (trip) {
      const planId = decodeURIComponent(trip[1]);
      return `/account/tripfit?planId=${encodeURIComponent(planId)}`;
    }

    return path;
  } catch {
    return path;
  }
}
