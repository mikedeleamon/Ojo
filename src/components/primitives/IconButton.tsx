import { ReactNode } from 'react';
import { AccessibilityState, GestureResponderEvent, Pressable, StyleProp, ViewStyle } from 'react-native';

interface IconButtonProps {
  icon: ReactNode;
  onPress: (event: GestureResponderEvent) => void;
  accessibilityLabel: string;
  accessibilityRole?: 'button';
  accessibilityState?: AccessibilityState;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  style?: StyleProp<ViewStyle>;
}

export const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
  style,
}: IconButtonProps) => (
  <Pressable
    onPress={onPress}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole={accessibilityRole}
    accessibilityState={accessibilityState}
    hitSlop={hitSlop}
    style={style}
  >
    {icon}
  </Pressable>
);
