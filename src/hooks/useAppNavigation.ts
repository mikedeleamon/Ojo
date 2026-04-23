/**
 * useAppNavigation — platform-agnostic navigation hook.
 *
 * Web:  wraps React Router's useNavigate()
 * RN:   replace this file with the React Navigation version below —
 *       every call site stays identical, zero other changes needed.
 *
 * ─── React Native replacement ────────────────────────────────────────────────
 *
 *   import { useNavigation } from '@react-navigation/native';
 *
 *   export const useAppNavigation = () => {
 *     const nav = useNavigation<any>();
 *     return {
 *       push:    (route: string, params?: Record<string, unknown>) =>
 *                  nav.navigate(route, params),
 *       goBack:  ()              => nav.goBack(),
 *       replace: (route: string) => nav.replace(route),
 *       reset:   (route: string) => nav.reset({ index: 0, routes: [{ name: route }] }),
 *     };
 *   };
 */

import { useNavigate } from 'react-router-dom';

export const useAppNavigation = () => {
  const navigate = useNavigate();

  return {
    /** Push a new screen onto the stack. */
    push: (route: string, _params?: Record<string, unknown>) => navigate(route),

    /** Go back one step in the history stack. */
    goBack: () => navigate(-1 as never),

    /** Replace the current screen (no back entry added). */
    replace: (route: string) => navigate(route, { replace: true }),

    /** Reset the stack to a single root screen. */
    reset: (route: string) => navigate(route, { replace: true }),
  };
};
