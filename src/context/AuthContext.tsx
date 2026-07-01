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
      await initAuthCache();
      if (isTokenExpiringSoon(86_400)) {
        await refreshToken().catch(() => {});
      }
      // Re-register push token on each cold start so it stays current
      if (getToken()) {
        registerPushToken().catch(() => {});
      }
      setIsLoggedIn(!!getToken());
      setIsReady(true);
    };
    init();
  }, []);

  // A rejected-and-unrefreshable token (surfaced by the axios 401 interceptor)
  // clears the session; flip the app to logged-out so AuthGate routes to login.
  useEffect(() => onSessionExpired(() => setIsLoggedIn(false)), []);

  const login = useCallback(() => setIsLoggedIn(true), []);
  const logout = useCallback(() => {
    clearAuth();
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isReady, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
