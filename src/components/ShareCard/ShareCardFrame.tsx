/**
 * ShareCardFrame — the one branded shell every Instagram-Story share template
 * renders inside (TodayOutfitShareCard, TripFitShareCard,
 * WeatherForecastShareCard). Fixes the 9:16 size, keeps content out of
 * Instagram's own chrome (profile chip / reply bar), and stamps the Ojo
 * footer, so "what a shared Ojo card looks like" only has one definition.
 * The 'sticker' variant is the same card as a rounded sticker, laid over a
 * video loop in a video Story (ShareToInstagramSheet).
 *
 * Deliberately ignores the user's in-app light/dark theme — a shared card is
 * public-facing brand surface, not a personal settings reflection, so it
 * always renders on the dark gradient regardless of ThemeContext.
 */

import { forwardRef } from 'react';
import { Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text } from '../primitives';
import OjoLogo from '../OjoLogo';
import styles, { STICKER_LOGO, type ShareCardVariant } from './ShareCardFrame.styles';

interface ShareCardFrameProps {
  /** Top→bottom gradient stops. Defaults to Ojo's standard dark brand gradient. */
  gradientColors?: readonly [string, string, ...string[]];
  /** 'sticker' drops the 9:16 size and gradient: the Story's video loop is the background. */
  variant?: ShareCardVariant;
  children: React.ReactNode;
}

const BRAND_GRADIENT = ['#0F172A', '#1E293B', '#0F172A'] as const;

const Footer = ({ style, sticker }: { style?: object; sticker?: boolean }) => (
  <View style={[styles.footer, style]}>
    <Text style={styles.footerText}>Styled by</Text>
    {sticker
      ? <Image source={STICKER_LOGO} style={styles.stickerLogo} accessibilityLabel='Ojo' />
      : <OjoLogo size={24} />}
  </View>
);

const ShareCardFrame = forwardRef<View, ShareCardFrameProps>(
  ({ gradientColors, variant = 'poster', children }, ref) => variant === 'sticker' ? (
    <View ref={ref} style={styles.sticker} collapsable={false}>
      {children}
      <Footer style={styles.stickerFooter} sticker />
    </View>
  ) : (
    <View ref={ref} style={styles.frame} collapsable={false}>
      <LinearGradient
        colors={gradientColors ?? BRAND_GRADIENT}
        style={styles.gradient}
      />
      <View style={styles.safeArea}>
        <View style={styles.content}>{children}</View>
        <Footer />
      </View>
    </View>
  ),
);

ShareCardFrame.displayName = 'ShareCardFrame';

export default ShareCardFrame;
