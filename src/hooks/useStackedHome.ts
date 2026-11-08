import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useFoldLayout } from '../context/FoldLayoutContext';
import { stackedHomeSplit } from '../lib/layout/foldLayout';

/** Where Home splits around the fold on the rotated Duo, else null. See foldLayout.ts. */
export const useStackedHome = () => {
  const fold = useFoldLayout();
  return useMemo(() => stackedHomeSplit(Platform.OS, fold), [fold]);
};
