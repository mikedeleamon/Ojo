/**
 * ShareCardFrame — the one branded shell every Instagram-Story share template
 * renders inside (TodayOutfitShareCard, TripFitShareCard,
 * WeatherForecastShareCard). Fixes the 9:16 size, keeps content out of
 * Instagram's own chrome (profile chip / reply bar), and stamps the Ojo
 * footer, so "what a shared Ojo card looks like" only has one definition.
 *
 * Deliberately ignores the user's in-app light/dark theme — a shared card is
 * public-facing brand surface, not a personal settings reflection, so it
 * always renders on the dark gradient regardless of ThemeContext.
 */

import { forwardRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text } from '../primitives';
import OjoLogo from '../OjoLogo';
import styles from './ShareCardFrame.styles';

interface ShareCardFrameProps {
  /** Top→bottom gradient stops. Defaults to Ojo's standard dark brand gradient. */
  gradientColors?: readonly [string, string, ...string[]];
  children: React.ReactNode;
}

const BRAND_GRADIENT = ['#0F172A', '#1E293B', '#0F172A'] as const;

const ShareCardFrame = forwardRef<View, ShareCardFrameProps>(
  ({ gradientColors, children }, ref) => (
    <View ref={ref} style={styles.frame} collapsable={false}>
      <LinearGradient
        colors={gradientColors ?? BRAND_GRADIENT}
        style={styles.gradient}
      />
      <View style={styles.safeArea}>
        <View style={styles.content}>{children}</View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Styled by</Text>
          <OjoLogo size={24} />
        </View>
      </View>
    </View>
  ),
);

ShareCardFrame.displayName = 'ShareCardFrame';

export default ShareCardFrame;
