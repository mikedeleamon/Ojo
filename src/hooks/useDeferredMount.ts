import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Returns false on first render, then flips to true once the current
 * interactions/animations have settled (or after `maxDelayMs`, whichever comes
 * first). Use it to keep an expensive, below-the-fold subtree off the critical
 * path so it doesn't compete with the initial paint and first scroll.
 *
 * On MainPage the outfit engine (generateOutfits ×2, trip-mode GPS, the widget
 * write) is mounted below the weather hero; deferring its mount lets the HUD
 * paint and scroll smoothly, then the outfit work runs a beat later — invisible
 * to the user since it's off-screen until they scroll.
 */
export const useDeferredMount = (maxDelayMs = 600): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const task = InteractionManager.runAfterInteractions(finish);
    // Hard cap so a long-running interaction handle can't defer indefinitely.
    const timer = setTimeout(finish, maxDelayMs);
    return () => {
      task.cancel();
      clearTimeout(timer);
    };
  }, [maxDelayMs]);

  return ready;
};
