import { useEffect, useRef } from 'react';
import { Slider } from '@expo/ui/swift-ui';
import type { ViewStyle } from 'react-native';

interface AppSliderProps {
    value: number;
    minimumValue: number;
    maximumValue: number;
    step?: number;
    onValueChange?: (v: number) => void;
    onSlidingComplete?: (v: number) => void;
    // Tint props are kept for API compatibility with the previous wrapper.
    // SwiftUI's Slider only accepts a single accent color; we map
    // `minimumTrackTintColor` to it and ignore the others.
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    style?: ViewStyle;
    accessibilityLabel?: string;
}

const COMMIT_DEBOUNCE_MS = 250;

/**
 * Wraps @expo/ui's SwiftUI Slider so it presents the true native iOS 26
 * control. Chosen over @react-native-community/slider because the latter
 * does not reliably re-sync when value/min/max all change in the same
 * render (the °F ↔ °C toggle case).
 *
 * Two API gaps from the previous wrapper are bridged here:
 *
 * 1. `step` (increment) → `steps` (count). @expo/ui takes the *number*
 *    of discrete stops between min and max, so we compute it.
 * 2. `onSlidingComplete` — @expo/ui 0.1.1-alpha.10 does not expose an
 *    editing-changed callback, so we debounce the last value from
 *    `onValueChange` and emit it as the commit signal.
 */
export function AppSlider({
    value,
    minimumValue,
    maximumValue,
    step = 1,
    onValueChange,
    onSlidingComplete,
    minimumTrackTintColor,
    style,
    accessibilityLabel,
}: AppSliderProps) {
    const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onCompleteRef = useRef(onSlidingComplete);
    onCompleteRef.current = onSlidingComplete;

    useEffect(() => () => {
        if (commitTimer.current) clearTimeout(commitTimer.current);
    }, []);

    const steps = step > 0 ? Math.round((maximumValue - minimumValue) / step) : 0;

    return (
        <Slider
            value={value}
            min={minimumValue}
            max={maximumValue}
            steps={steps}
            color={minimumTrackTintColor}
            onValueChange={(v) => {
                onValueChange?.(v);
                if (commitTimer.current) clearTimeout(commitTimer.current);
                commitTimer.current = setTimeout(() => {
                    onCompleteRef.current?.(v);
                }, COMMIT_DEBOUNCE_MS);
            }}
            style={[{ width: '100%' }, style]}
            // Slider's props type omits accessibilityLabel even though it
            // forwards to the underlying View. Cast via `as` so the prop
            // still reaches VoiceOver without a TS escape hatch on the
            // component itself.
            {...({ accessibilityLabel } as { accessibilityLabel?: string })}
        />
    );
}
