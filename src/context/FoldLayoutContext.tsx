import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { computeFoldLayout, type FoldLayout } from '../lib/layout/foldLayout';

const initial = computeFoldLayout({ width: 0, height: 0 });
const FoldLayoutContext = createContext<FoldLayout>(initial);

/**
 * Publishes the window's layout once, near the root, so screens don't each
 * subscribe. The value keeps its identity until the window size changes, which
 * means folding is the only thing here that re-renders consumers.
 */
export function FoldLayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const layout = useMemo(() => computeFoldLayout({ width, height }), [width, height]);
  return <FoldLayoutContext.Provider value={layout}>{children}</FoldLayoutContext.Provider>;
}

export const useFoldLayout = (): FoldLayout => useContext(FoldLayoutContext);
