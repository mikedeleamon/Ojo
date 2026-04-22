/**
 * ScreenShell.styles.ts — cross-platform style definitions
 *
 * RN migration steps:
 *   1. DELETE this component entirely in RN — React Navigation provides the
 *      header natively. Configure via Stack.Screen options:
 *
 *      <Stack.Screen
 *        name="Profile"
 *        component={ProfileScreen}
 *        options={{
 *          title: 'Profile',
 *          headerStyle: { backgroundColor: colors.bgDefault },
 *          headerTitleStyle: {
 *            fontFamily: fonts.display,
 *            fontSize: 24,
 *            fontWeight: '400',
 *            color: colors.textPrimary,
 *            letterSpacing: -0.02 * 24,
 *          },
 *          headerTintColor: colors.textSecondary,
 *          headerBackTitle: '',
 *        }}
 *      />
 *
 *   2. Remove <ScreenShell> wrapper from each screen component
 *   3. Each screen's root View gets styles.content applied directly
 */

import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';

export const styles = {
  root: {
    flex:            1,
    flexDirection:   'column' as const,
    backgroundColor: colors.bgDefault,
  },

  embedded: {
    // When rendered inline on desktop — no background, no minHeight
    backgroundColor: 'transparent',
  },

  header: {
    flexDirection: 'row'    as const,
    alignItems:    'center' as const,
    gap:           12,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    // Web-only in .module.css: position: sticky, z-index, background repeat
  },

  backBtn: {
    alignItems:      'center' as const,
    justifyContent:  'center' as const,
    width:           38,
    height:          38,
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    999,              // pill / circle
    // Web-only: cursor, transition, :hover
  },

  title: {
    fontFamily:    fonts.display,
    fontSize:      32,                 // 2rem at 16px base
    fontWeight:    fontWeights.regular,
    color:         colors.textPrimary,
    letterSpacing: -0.02 * 32,        // -0.02em
    // margin: 0 is default in RN
  },

  content: {
    flexDirection:  'column' as const,
    gap:            spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xl,
    maxWidth:       520,
    width:          '100%' as const,
    flex:           1,
    // Web-only in .module.css: animation fadeUp
  },

  embeddedContent: {
    padding: spacing.xl,
    maxWidth: 520,
    // Web-only: animation
  },
};
