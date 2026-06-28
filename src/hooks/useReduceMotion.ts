import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Reduce-motion flag, backed by a single module-level subscription.
 *
 * Previously every caller registered its own AccessibilityInfo listener and ran
 * its own async `isReduceMotionEnabled()` query. With a forecast strip of a
 * dozen animated icons (each WeatherIconDisplay → useSpinAnimation →
 * useReduceMotion), that meant a dozen listeners for one global, rarely-changing
 * flag. Now all callers share one listener and one initial query.
 */

let reduceMotion = false;
let initialized = false;
const listeners = new Set<() => void>();

function setReduceMotion(value: boolean) {
    if (value === reduceMotion) return;
    reduceMotion = value;
    for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
    if (!initialized) {
        initialized = true;
        AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
        // Kept for the app lifetime — re-subscribing per mount is exactly the
        // cost this singleton avoids, so the native listener is never removed.
        AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    }
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const getSnapshot = () => reduceMotion;

export function useReduceMotion(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
