import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hasSideRail } from '../lib/layout/sideRail';

/** True when iOS shows the bars in a side column (iPhone Duo). See sideRail.ts. */
export const useSideRail = (): boolean => hasSideRail(Platform.OS, useSafeAreaInsets());
