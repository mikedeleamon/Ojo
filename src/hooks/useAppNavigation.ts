import { useMemo } from 'react';
import { useRouter } from 'expo-router';

/**
 * Thin, stable wrapper over expo-router's imperative navigation.
 *
 * The returned object and its methods are memoized so `nav` keeps a stable
 * identity across renders — screens that capture it in a useCallback/useEffect
 * dependency (e.g. MainPage's `openLocations`) no longer re-create those on
 * every render.
 *
 * In development, `push` measures how long the JS thread is blocked immediately
 * after the navigation is dispatched — i.e. the destination screen's synchronous
 * mount/render cost. If a tap feels unresponsive, the console line tells you
 * whether the JS thread stalled (a heavy synchronous render we can defer) or
 * whether it was idle (the jank is native/GPU — e.g. glass compositing during
 * the transition). Compiled out of production by the `__DEV__` guard.
 */
export const useAppNavigation = () => {
  const router = useRouter();

  return useMemo(
    () => ({
      push: (route: string, params?: Record<string, unknown>) => {
        if (__DEV__) {
          const t0 = Date.now();
          router.push({ pathname: route as any, params: params as any });
          const dispatched = Date.now();
          // A 0ms timer fires only once the JS thread is free again; how late it
          // runs ≈ how long the destination's synchronous work blocked JS.
          setTimeout(() => {
            const stall = Date.now() - dispatched;
            if (stall > 80) {
              console.log(
                `[nav] push ${route} — dispatch ${dispatched - t0}ms, JS stalled ${stall}ms after`,
              );
            }
          }, 0);
          return;
        }
        router.push({ pathname: route as any, params: params as any });
      },
      goBack: () => router.back(),
      replace: (route: string) => router.replace(route as any),
      reset: (route: string) => router.replace(route as any),
    }),
    [router],
  );
};
