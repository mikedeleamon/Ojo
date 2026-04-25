/**
 * SettingsSection.styles.ts — cross-platform style definitions
 *
 * RN migration steps:
 *   1. import { styles } from './SettingsSection.styles';
 *   2. Replace className={styles.x} → style={styles.x}
 *   3. Add StyleSheet.create() wrapper around the export
 *   4. Delete SettingsSection.module.css
 *   5. backdrop-filter on .group → use @react-native-community/blur <BlurView>
 *      or drop it and use a plain semi-transparent backgroundColor
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';

export const styles = StyleSheet.create({
  section: {
    flexDirection: 'column' as const,
    gap:           6,
  },

  title: {
    fontFamily:     fonts.body,
    fontSize:       fontSizes.xs,      // 11px
    fontWeight:     fontWeights.semibold,
    letterSpacing:  0.08 * fontSizes.xs,
    textTransform:  'uppercase' as const,
    color:          colors.textSecondary,
    opacity:        0.45,
    paddingHorizontal: 4,
  },

  group: {
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.sm,
    // Web-only in .module.css: backdrop-filter, overflow: hidden
    // RN: overflow hidden works but clips shadows — use with care
    overflow: 'hidden' as const,
  },
});
