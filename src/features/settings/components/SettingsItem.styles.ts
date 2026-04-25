/**
 * SettingsItem.styles.ts — cross-platform style definitions
 *
 * Web:  imported by SettingsItem.module.css which overrides with hover/transitions
 * RN:   replace the .module.css import with this file and wrap in StyleSheet.create()
 *
 * RN migration steps:
 *   1. import { styles } from './SettingsItem.styles';
 *   2. Replace className={styles.x} → style={styles.x}
 *   3. Add StyleSheet.create() wrapper around the export
 *   4. Delete SettingsItem.module.css
 *   5. Web-only: cursor, transition, text-overflow are automatically dropped by RN
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, fonts, fontSizes, fontWeights } from '../../../theme/tokens';

export const styles = StyleSheet.create({
  row: {
    flexDirection:   'row'    as const,
    alignItems:      'center' as const,
    width:           '100%'   as const,
    paddingVertical:  14,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
    // Web-only in .module.css: cursor, transition, :hover, :active
    // RN: borderTopWidth set per-sibling via FlatList separator or conditional
    borderTopWidth:  1,
    borderTopColor:  colors.glassBorder,
  },

  rowFirst: {
    // Applied to the first item to remove the top divider
    // RN: pass as array: style={[styles.row, isFirst && styles.rowFirst]}
    borderTopWidth: 0,
  },

  disabled: {
    opacity: 0.4,
    // Web-only in .module.css: cursor: default
  },

  label: {
    flex:        1,
    fontFamily:  fonts.body,
    fontSize:    fontSizes.base,      // 15px
    fontWeight:  fontWeights.regular,
    lineHeight:  fontSizes.base * 1.2,
    color:       colors.textPrimary,
  },

  right: {
    flexDirection: 'row'    as const,
    alignItems:    'center' as const,
    gap:           8,                  // RN 0.71+ supports gap
    flexShrink:    0,
  },

  sublabel: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,          // 13px
    color:      colors.textSecondary,
    lineHeight: fontSizes.sm * 1.2,
    // Web-only in .module.css: maxWidth, overflow, text-overflow, white-space
    // RN: use numberOfLines={1} on the <Text> component instead
  },

  chevron: {
    color:     colors.textSecondary,
    opacity:   0.4,
    flexShrink: 0,
  },
});
