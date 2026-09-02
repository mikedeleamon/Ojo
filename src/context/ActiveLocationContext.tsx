/**
 * ActiveLocationContext
 * ─────────────────────
 * Tracks which saved city (or GPS "My Location") the weather HUD is currently
 * showing. The id is persisted so the last-viewed city is restored on relaunch.
 * Defaults to CURRENT_LOCATION_ID ('current' = live GPS).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { storage } from '../lib/storage';
import { getUserId } from '../lib/auth';
import { useAuth } from './AuthContext';
import { CURRENT_LOCATION_ID } from '../lib/savedLocations';

const storageKey = () => `ojo_active_location_${getUserId() ?? 'anon'}`;

interface ActiveLocationCtx {
  activeId: string;
  setActiveId: (id: string) => void;
}

const ActiveLocationContext = createContext<ActiveLocationCtx>({
  activeId: CURRENT_LOCATION_ID,
  setActiveId: () => {},
});

export const ActiveLocationProvider = ({ children }: { children: ReactNode }) => {
  const { isReady, isLoggedIn } = useAuth();
  const [activeId, setActiveIdState] = useState<string>(CURRENT_LOCATION_ID);

  // Restore the last-viewed location once the auth cache is warm.
  //
  // This deliberately does NOT run on mount. storageKey() calls getUserId(),
  // which reads the in-memory token cache — and that cache is only populated
  // after initAuthCache()'s SecureStore round-trip resolves, which is strictly
  // later than this provider's mount no matter how the effects are ordered. So
  // a mount-time read always looked under `..._anon`, while every write (from
  // setActiveId, by which point auth is warm) went to `..._<userId>`. The two
  // keys never matched and the last-viewed city was silently never restored.
  //
  // Keyed on isLoggedIn too, so switching accounts re-reads under the new
  // user's key rather than leaving the previous account's city on screen.
  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn) {
      setActiveIdState(CURRENT_LOCATION_ID);
      return;
    }
    let cancelled = false;
    storage.getItem(storageKey()).then((saved) => {
      if (!cancelled && saved) setActiveIdState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [isReady, isLoggedIn]);

  // Writes need no such gate: every caller is a user interaction on a screen
  // that only renders past AuthGate, so the token cache is warm by then.
  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    storage.setItem(storageKey(), id).catch(() => {});
  }, []);

  return (
    <ActiveLocationContext.Provider value={{ activeId, setActiveId }}>
      {children}
    </ActiveLocationContext.Provider>
  );
};

export const useActiveLocation = () => useContext(ActiveLocationContext);
