/**
 * GlassCard — adaptive glass surface primitive.
 *
 * iOS 26+  → expo-glass-effect GlassView (native UIGlassMaterial)
 * All else → existing glassmorphism View (rgba bg + border)
 *
 * Background/border styles are stripped before forwarding to GlassView so they
 * don't add a semi-transparent overlay on top of the native glass material.
 *
 * The in-app theme is propagated to the system via the ojo-ui-style module
 * (UIWindow.overrideUserInterfaceStyle), so `colorScheme="auto"` resolves to
 * the correct appearance for both system-driven and user-overridden themes.
 */

import { forwardRef } from 'react';
import { View, ViewProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useTheme } from '../../theme/ThemeContext';

const LIQUID_GLASS = isGlassEffectAPIAvailable();

interface GlassCardProps extends ViewProps {
  style?:      StyleProp<ViewStyle>;
  /** 'regular' = standard iOS 26 material; 'clear' = more subtle */
  glassStyle?: 'regular' | 'clear';
  children?:   React.ReactNode;
}

const GlassCard = forwardRef<View, GlassCardProps>(
  ({ style, glassStyle = 'regular', children, ...rest }, ref) => {
    const { colors } = useTheme();

    if (LIQUID_GLASS) {
      // Strip properties that would muddy the native glass material
      const {
        backgroundColor: _bg,
        borderColor: _bc,
        borderWidth: _bw,
        borderStyle: _bs,
        borderTopColor: _btc,
        borderBottomColor: _bbc,
        borderLeftColor: _blc,
        borderRightColor: _brc,
        ...passStyle
      } = StyleSheet.flatten(style) ?? {};

      return (
        <GlassView
          ref={ref}
          glassEffectStyle={glassStyle}
          // 'auto' resolves to the window's overrideUserInterfaceStyle, which
          // ThemeContext drives via the ojo-ui-style native module. So this
          // tracks the in-app theme without needing any prop plumbing here.
          colorScheme="auto"
          style={[styles.base, passStyle]}
          {...rest}
        >
          {children}
        </GlassView>
      );
    }

    // Glassmorphism fallback — same visual as before
    return (
      <View
        ref={ref}
        style={[
          styles.base,
          { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    );
  },
);

GlassCard.displayName = 'GlassCard';

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});

export { GlassCard };
