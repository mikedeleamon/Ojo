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
import { darkColors } from '../../theme/tokens';

const LIQUID_GLASS = isGlassEffectAPIAvailable();

interface GlassCardProps extends ViewProps {
  style?:      StyleProp<ViewStyle>;
  /** 'regular' = standard iOS 26 material; 'clear' = more subtle */
  glassStyle?: 'regular' | 'clear';
  /** Optional solid tint applied over the glass material (native path) or
   *  as the background colour (fallback path). Use for cases where the default
   *  glass bg is too subtle, e.g. on a light-coloured page. */
  tintColor?:  string;
  /**
   * Render the translucent fallback surface even where the native glass
   * material is available.
   *
   * A native glass view re-samples and re-blurs whatever sits behind it on
   * every frame that content changes, and a blur is several GPU passes. That is
   * affordable for a handful of surfaces over a static background; it is not
   * affordable for a dozen of them over an animating one. The hourly strip put
   * fourteen glass tiles above the full-screen star field and storm rain, so
   * every twinkle invalidated all fourteen at once — the single largest cost in
   * those scenes, and the reason they were the only ones that stuttered.
   *
   * Use this for surfaces that are numerous, small, or sit above a moving
   * backdrop. Real glass is worth keeping for the few large, prominent ones.
   */
  disableGlass?: boolean;
  children?:   React.ReactNode;
}

const GlassCard = forwardRef<View, GlassCardProps>(
  ({ style, glassStyle = 'regular', tintColor, disableGlass = false, children, ...rest }, ref) => {
    const { colors, isDark } = useTheme();

    if (LIQUID_GLASS && !disableGlass) {
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
          // Drive the material's appearance from our React context's isDark
          // rather than the native UIWindow style. This lets ForceDarkPalette
          // (used by MainPage) flip nested glass to dark even when the user's
          // selected app theme is light.
          colorScheme={isDark ? 'dark' : 'light'}
          style={[styles.base, passStyle]}
          {...rest}
        >
          {tintColor && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} pointerEvents='none' />
          )}
          {children}
        </GlassView>
      );
    }

    // Glassmorphism fallback — tintColor replaces glassBg; border flips to white
    // so it stays visible against a dark tile background.
    return (
      <View
        ref={ref}
        style={[
          styles.base,
          {
            backgroundColor: tintColor ?? colors.glassBg,
            borderWidth: 1,
            borderColor: tintColor ? darkColors.glassBorder : colors.glassBorder,
          },
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
