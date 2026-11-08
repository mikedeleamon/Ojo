/**
 * sideRail.ts — whether iOS has moved the bars to a side column.
 *
 * On the iPhone Duo (either display, in its usual pose) the system puts the tab
 * bar, the toolbar and the nav-bar buttons in a column on the right and reserves
 * that edge as a right safe-area inset. A regular iPhone is portrait-only with no
 * right inset, so this is false there. Pure so it can be tested; useSideRail()
 * is the hook form.
 */
export function hasSideRail(os: string, insets: { right: number }): boolean {
  return os === 'ios' && insets.right > 0;
}
