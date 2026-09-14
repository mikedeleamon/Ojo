import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initAuthCache,
  getToken,
  clearAuth,
  isTokenExpiringSoon,
  refreshToken,
  onSessionExpired,
} from '../lib/auth';
import { registerPushToken, cancelAllLocalNotifications } from '../lib/notifications';
import { resetLaunchReconcilers } from '../lib/launchReconcile';
import { clearTripPresenceCache } from '../lib/tripPresence';
import { loadHistory } from '../lib/outfitHistory';
import { clearWidgetSnapshot } from '../lib/widget/updateWidgetSnapshot';
import { resetClosetsCache } from '../hooks/useClosets';
import { resetTripPlansCache } from '../hooks/useTripPlans';
import { resetOnboardingCache } from '../lib/onboarding';
import { resetAgeGateCache } from '../lib/ageGate';
import { clearGapHistory } from '../lib/wardrobeGaps';

interface AuthState {
  isReady: boolean;
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  isReady: false,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Only the local secure-storage read gates first render. Everything that
      // touches the network stays OFF the critical path — otherwise a slow or
      // unreachable API holds the entire app on a blank splash until the 15s
      // request timeout, on every cold start.
      await initAuthCache();
      const loggedIn = !!getToken();
      setIsLoggedIn(loggedIn);
      setIsReady(true);

      if (loggedIn) {
        // Background, non-blocking. A token that's merely "expiring soon" is
        // still valid now, so screens fetch fine with it while this resolves;
        // an already-dead token is handled per-request by the 401 interceptor
        // (refresh + retry). Either way, launch never waits on the network.
        if (isTokenExpiringSoon(86_400)) {
          refreshToken().catch(() => {});
        }
        // Re-register push token on each cold start so it stays current.
        registerPushToken().catch(() => {});
      }
    };
    init();
  }, []);

  // A rejected-and-unrefreshable token (surfaced by the axios 401 interceptor)
  // clears the session; flip the app to logged-out so AuthGate routes to login.
  useEffect(() => onSessionExpired(() => setIsLoggedIn(false)), []);

  const login = useCallback(() => {
    setIsLoggedIn(true);
    // Re-arm the per-session notification reconcilers for this account. Also
    // covers the one sign-out that doesn't run `logout` below — a rejected
    // token expiring the session through the 401 interceptor.
    resetLaunchReconcilers();
    // Migrate any locally-accumulated (anon) entries to the server immediately
    // so history isn't stranded if the user authenticated after using the app.
    loadHistory().catch(() => {});
  }, []);
  const logout = useCallback(() => {
    clearAuth();
    setIsLoggedIn(false);
    // Drop the shared closet cache so the next account doesn't briefly see the
    // previous user's wardrobe before its own fetch resolves.
    resetClosetsCache();
    // Same reason for the shared trip-plan cache: it is keyed per user in
    // storage, but the in-memory copy outlives the account it was loaded for.
    resetTripPlansCache();
    // Onboarding's "done" flag is keyed by userId; clearing the in-memory
    // mirror forces the next account to read its own state fresh from storage.
    resetOnboardingCache();
    // Same reason: the next account must not inherit this account's age-gate
    // state, in either direction.
    resetAgeGateCache();
    // Wardrobe-gap events live under a single global key rather than a per-user
    // one, so nothing else scopes them to an account and the next user to sign
    // in on this device would inherit the previous user's gap history.
    // (The settings cache has the same problem; SettingsProvider clears that
    // one itself off isLoggedIn, rather than importing it here — AuthContext
    // importing SettingsContext would close an import cycle, since
    // SettingsContext consumes useAuth.)
    void clearGapHistory().catch(() => {});
    // Wipe the widget so a signed-out device doesn't keep showing the last
    // user's outfit/trip. No-ops off-iOS / without the native bridge.
    void clearWidgetSnapshot();
    // Same reasoning, for the other thing this device keeps showing on the
    // previous account's behalf: scheduled local notifications. They are device
    // state, not account state, so nothing here used to touch them — the last
    // user's morning briefs, recap and Trip Mode nudges kept firing for whoever
    // signed in next, naming a city and a trip the new account has no record
    // of, and stacking with that account's own once it saved a trip of its own.
    // Trip plans are stored per user, so those notifications were also
    // unreachable by every cancel path, which all need a live plan id.
    //
    // Everything cancelled here is re-scheduled for the next account by the
    // reconcilers the reset below re-arms.
    void cancelAllLocalNotifications();
    resetLaunchReconcilers();
    // The cache that suppresses redundant trip-presence posts is per-device,
    // not per-account: left in place, the next account would inherit "already
    // told them" for someone else's trip and skip its own first report.
    void clearTripPresenceCache().catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ isReady, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
