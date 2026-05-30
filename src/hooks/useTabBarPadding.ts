/**
 * useTabBarPadding — bottom padding to clear the native tab bar.
 *
 * Expo Router's NativeTabs render via UITabBarController. On iOS 26 the bar
 * floats above the safe-area inset with its own glass material, so a
 * ScrollView whose content reaches the bottom of the screen gets occluded
 * unless we add explicit bottom padding to its contentContainerStyle.
 *
 * Use this hook in every tab-rendered screen's main ScrollView / FlatList:
 *
 *   const tabPad = useTabBarPadding();
 *   <ScrollView contentContainerStyle={{ paddingBottom: tabPad, ... }} />
 *
 * The returned value is safe-area-bottom plus a platform-appropriate bar
 * height that covers both the standard iOS tab bar (49pt) and the iOS 26
 * floating glass bar.
 */

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Tab bar visible height above the safe-area inset.
// iOS standard:   49pt
// iOS 26 floating glass: ~49pt content + ~16pt floating margin
// Android Material 3 bottom navigation: 80pt (includes its own padding)
const TAB_BAR_HEIGHT = Platform.select({
  ios:     64, // covers both standard and iOS 26 floating layouts
  android: 80,
  default: 64,
});

export const useTabBarPadding = (): number => {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_HEIGHT;
};
