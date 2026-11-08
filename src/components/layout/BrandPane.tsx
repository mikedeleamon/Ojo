import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OjoLogoIcon from '../icons/OjoLogoIcon';
import { useFoldLayout } from '../../context/FoldLayoutContext';
import { ForceDarkPalette } from '../../theme/ThemeContext';
import { darkColors, fonts, fontSizes, spacing } from '../../theme/tokens';

/**
 * The left pane of sign-in, sign-up, password reset and onboarding when two
 * panes fit: the logo and tagline on the standard navy background, with room for
 * anything a screen wants beside the brand, like Sign in with Apple. (The
 * green-to-navy field is reserved for Ojo Pro, so it isn't used here.)
 */
export function BrandPane({ children }: { children?: ReactNode }) {
  const { panes } = useFoldLayout();
  return (
    <ForceDarkPalette>
      <SafeAreaView edges={['top', 'left', 'bottom']} style={[styles.root, { width: panes?.primary.width }]}>
        <View style={styles.inner}>
          <OjoLogoIcon width={120} height={48} />
          <Text style={styles.tagline}>Dress for the weather.</Text>
          {children ? <View style={styles.extra}>{children}</View> : null}
        </View>
      </SafeAreaView>
    </ForceDarkPalette>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: darkColors.bgDefault },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: darkColors.textSecondary,
  },
  extra: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.lg },
});
