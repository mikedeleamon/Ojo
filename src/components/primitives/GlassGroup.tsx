/**
 * GlassGroup — groups adjacent glass surfaces so iOS 26 merges their materials.
 *
 * iOS 26+  → expo-glass-effect GlassContainer (native merged-glass grouping)
 * All else → plain View (children render independently)
 *
 * The in-app theme is propagated to native materials via the ojo-ui-style
 * module (UIWindow.overrideUserInterfaceStyle), so GlassContainer's merged
 * backdrop automatically follows the app's theme. No per-component theme
 * plumbing is required here.
 */

import { forwardRef } from 'react';
import { View, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { GlassContainer, isGlassEffectAPIAvailable } from 'expo-glass-effect';

const LIQUID_GLASS = isGlassEffectAPIAvailable();

interface GlassGroupProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  /** Max gap (pts) at which adjacent glass children still merge (iOS 26 only) */
  spacing?: number;
  children?: React.ReactNode;
}

const GlassGroup = forwardRef<View, GlassGroupProps>(
  ({ style, spacing, children, ...rest }, ref) => {
    if (LIQUID_GLASS) {
      return (
        <GlassContainer
          ref={ref}
          spacing={spacing}
          style={style}
          {...rest}
        >
          {children}
        </GlassContainer>
      );
    }

    return (
      <View ref={ref} style={style} {...rest}>
        {children}
      </View>
    );
  },
);

GlassGroup.displayName = 'GlassGroup';

export { GlassGroup };
