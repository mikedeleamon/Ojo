import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFoldLayout } from '../../context/FoldLayoutContext';

/**
 * Lays `primary` and `secondary` out on either side of the fold in two-pane
 * mode, and one after the other (primary first) in the compact modes.
 *
 * The tree is the same in every mode, so folding only changes styles: neither
 * child remounts, and form input, scroll position and selections all survive.
 * Set `hideSecondaryWhenCompact` when the compact layout reaches the secondary
 * content another way (a modal, a pushed screen). It stays mounted, just hidden.
 */
export function TwoPane({
  primary,
  secondary,
  hideSecondaryWhenCompact = false,
  style,
  primaryStyle,
  secondaryStyle,
}: {
  primary: ReactNode;
  secondary: ReactNode;
  hideSecondaryWhenCompact?: boolean;
  style?: StyleProp<ViewStyle>;
  primaryStyle?: StyleProp<ViewStyle>;
  secondaryStyle?: StyleProp<ViewStyle>;
}) {
  const layout = useFoldLayout();
  const twoPane = layout.mode === 'two-pane';
  const row = layout.axis === 'row';
  const gutter = layout.gutter;

  return (
    <View style={[styles.root, twoPane && (row ? styles.row : styles.column), style]}>
      <View
        style={[
          twoPane ? styles.pane : styles.compactPane,
          twoPane && (row ? { paddingRight: gutter } : { paddingBottom: gutter }),
          primaryStyle,
        ]}
      >
        {primary}
      </View>
      <View
        style={[
          twoPane ? styles.pane : styles.compactPane,
          twoPane && (row ? { paddingLeft: gutter } : { paddingTop: gutter }),
          !twoPane && hideSecondaryWhenCompact && styles.hidden,
          secondaryStyle,
        ]}
      >
        {secondary}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
  pane: { flex: 1, minWidth: 0, minHeight: 0 },
  compactPane: { flexGrow: 1 },
  hidden: { display: 'none' },
});
