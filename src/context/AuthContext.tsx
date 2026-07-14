import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initAuthCache,
  getToken,
  clearAuth,
  isTokenExpiringSoon,
  refreshToken,
  onSessionExpired,
} from '../lib/auth';
import { registerPushToken } from '../lib/notifications';
import { loadHistory } from '../lib/outfitHistory';
import { clearWidgetSnapshot } from '../lib/widget/updateWidgetSnapshot';
import { resetClosetsCache } from '../hooks/useClosets';
import { resetOnboardingCache } from '../lib/onboarding';

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
    // Onboarding's "done" flag is keyed by userId; clearing the in-memory
    // mirror forces the next account to read its own state fresh from storage.
    resetOnboardingCache();
    // Wipe the widget so a signed-out device doesn't keep showing the last
    // user's outfit/trip. No-ops off-iOS / without the native bridge.
    void clearWidgetSnapshot();
  }, []);

  return (
    <AuthContext.Provider value={{ isReady, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
