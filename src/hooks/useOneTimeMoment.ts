import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'ojo_moment_';

/**
 * A quiet prompt that appears at most once, ever.
 *
 * When `eligible` first turns true and the moment has never been shown, it is
 * shown and recorded straight away, so it stays up for this visit and never
 * comes back on the next one. `dismiss` hides it early. A storage failure
 * keeps it hidden: missing a prompt costs nothing, repeating one nags.
 */
export const useOneTimeMoment = (key: string, eligible: boolean) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!eligible || visible) return;
    let cancelled = false;
    const storageKey = KEY_PREFIX + key;
    AsyncStorage.getItem(storageKey)
      .then(async (seen) => {
        if (cancelled || seen) return;
        await AsyncStorage.setItem(storageKey, new Date().toISOString());
        if (!cancelled) setVisible(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key, eligible, visible]);

  const dismiss = useCallback(() => setVisible(false), []);

  return { visible: visible && eligible, dismiss };
};
