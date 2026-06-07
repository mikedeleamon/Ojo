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
  const [activeId, setActiveIdState] = useState<string>(CURRENT_LOCATION_ID);

  // Restore the last-viewed location on mount.
  useEffect(() => {
    let cancelled = false;
    storage.getItem(storageKey()).then((saved) => {
      if (!cancelled && saved) setActiveIdState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
