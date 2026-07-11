import Slider from '@react-native-community/slider';
import type { ViewStyle } from 'react-native';

interface AppSliderProps {
    value: number;
    minimumValue: number;
    maximumValue: number;
    step?: number;
    onValueChange?: (v: number) => void;
    onSlidingComplete?: (v: number) => void;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    style?: ViewStyle;
    accessibilityLabel?: string;
}

/**
 * Android counterpart to AppSlider.tsx — @expo/ui's `swift-ui` Slider has no
 * Android implementation, so this uses @react-native-community/slider
 * (already a dependency, used by NotificationsScreen) behind the same props
 * so call sites need no Platform branching.
 */
export function AppSlider({
    value,
    minimumValue,
    maximumValue,
    step = 1,
    onValueChange,
    onSlidingComplete,
    minimumTrackTintColor,
    maximumTrackTintColor,
    thumbTintColor,
    style,
    accessibilityLabel,
}: AppSliderProps) {
    return (
        <Slider
            style={[{ width: '100%' }, style]}
            minimumValue={minimumValue}
            maximumValue={maximumValue}
            step={step}
            value={value}
            onValueChange={onValueChange}
            onSlidingComplete={onSlidingComplete}
            minimumTrackTintColor={minimumTrackTintColor}
            maximumTrackTintColor={maximumTrackTintColor}
            thumbTintColor={thumbTintColor}
            accessibilityLabel={accessibilityLabel}
        />
    );
}
