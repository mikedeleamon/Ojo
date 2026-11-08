import { useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoldLayout } from '../context/FoldLayoutContext';

/**
 * Styles for a single scroll view whose content sits in two columns, one on each
 * side of the fold. Columns of equal width won't do: the tab rail takes space on
 * the right only, so equal columns push the right one across the fold. These are
 * measured from the fold instead.
 *
 * The right column gets an explicit width too. A scroll view's content container
 * is not width-bound in a row, so `flex: 1` let it grow to its text's natural width
 * and run off the screen.
 *
 * `padding` is the content's existing horizontal padding. Pass `railPadded` when
 * the screen already insets its right edge (a SafeAreaView with a right edge).
 */
export function useFoldColumns(padding: number, { railPadded = false } = {}): {
  twoPane: boolean;
  row: ViewStyle | null;
  left: ViewStyle | null;
  right: ViewStyle | null;
} {
  const { mode, axis, panes, gutter, window } = useFoldLayout();
  const { right: rightInset } = useSafeAreaInsets();
  return useMemo(() => {
    if (mode !== 'two-pane' || axis !== 'row' || !panes) {
      return { twoPane: false, row: null, left: null, right: null };
    }
    return {
      twoPane: true,
      row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: gutter * 2,
        paddingRight: padding + (railPadded ? 0 : rightInset),
      },
      left: { width: panes.primary.width - padding - gutter },
      // Ends at the padding inside the rail, whether or not the screen insets it.
      right: {
        width: Math.max(0, window.width - rightInset - padding - panes.primary.width - gutter),
      },
    };
  }, [mode, axis, panes, gutter, window.width, padding, railPadded, rightInset]);
}
