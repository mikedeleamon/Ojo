import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

/**
 * Slides a swipeable row's action in from the right edge as the row is dragged
 * left. ReanimatedSwipeable hands over its drag distance as a shared value, so
 * this has to be a component: useAnimatedStyle can't run inside the
 * renderRightActions callback.
 */
export function SwipeActionReveal({
  translation,
  width,
  style,
  children,
}: {
  translation: SharedValue<number>;
  width: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reveal = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(translation.value, [-width, 0], [0, width], Extrapolation.CLAMP),
    }],
  }));
  return <Animated.View style={[style, reveal]}>{children}</Animated.View>;
}
