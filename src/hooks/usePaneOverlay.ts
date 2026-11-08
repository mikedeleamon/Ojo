import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoldLayout } from '../context/FoldLayoutContext';

/**
 * Left and right offsets that keep a dialog or sheet inside the right-hand pane,
 * so nothing interactive ever straddles the fold. Null when there's no fold to
 * avoid; spread it last into the overlay's style.
 */
export function usePaneOverlay(edgePadding = 0): { left: number; right: number } | null {
  const { mode, axis, panes } = useFoldLayout();
  const { right } = useSafeAreaInsets();
  if (mode !== 'two-pane' || axis !== 'row' || !panes) return null;
  return { left: panes.secondary.x + edgePadding, right: right + edgePadding };
}
