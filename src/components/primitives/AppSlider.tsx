import { useRef } from 'react';
import { Host, Slider } from '@expo/ui/swift-ui';
import { accessibilityLabel as a11yLabel, tint } from '@expo/ui/swift-ui/modifiers';
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

/**
 * Wraps @expo/ui's SwiftUI Slider so it presents the true native iOS control.
 * Chosen over @react-native-community/slider because the latter does not
 * reliably re-sync when value/min/max all change in the same render (the
 * °F ↔ °C toggle case).
 *
 * `onSlidingComplete` fires from SwiftUI's editing-changed callback, with the
 * last value the thumb reported.
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
    const lastValue = useRef(value);
    lastValue.current = value;

    return (
        <Host matchContents={{ vertical: true }} style={[{ width: '100%' }, style]}>
            <Slider
                value={value}
                min={minimumValue}
                max={maximumValue}
                step={step > 0 ? step : undefined}
                modifiers={[
                    ...(minimumTrackTintColor ? [tint(minimumTrackTintColor)] : []),
                    ...(accessibilityLabel ? [a11yLabel(accessibilityLabel)] : []),
                ]}
                onValueChange={(v) => {
                    lastValue.current = v;
                    onValueChange?.(v);
                }}
                onEditingChanged={(editing) => {
                    if (!editing) onSlidingComplete?.(lastValue.current);
                }}
            />
        </Host>
    );
}
