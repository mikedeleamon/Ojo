import { View } from 'react-native';
import { NativeTabs, Label, Icon } from 'expo-router/unstable-native-tabs';
import { useWeatherTheme } from '../../src/context/WeatherContext';

// ─── Tab layout ──────────────────────────────────────────────────────────────
// The `camera` trigger points to a thin redirect screen at app/(tabs)/camera.tsx
// that immediately presents the fullScreenModal at app/capture.tsx — this is the
// only way to keep the camera icon in the native tab bar AND have iOS hide the
// bar while the camera UI is active. See plan: there-s-got-to-be-joyful-garden.
//
// `tintColor` replaces iOS's default system blue with an accent derived from the
// live weather gradient, so the active tab tracks the sky behind it. The value
// changes only when the gradient does (see WeatherHUD → WeatherContext.accent).
//
// Home and TripFit use brand marks instead of SF Symbols. Both are pure-white
// PNG template sets (40/80/120px) whose shape lives in the alpha channel — iOS
// tints them with `tintColor` when active and system gray when not, so they
// track the sky exactly like the SF Symbol tabs do. The TripFit mark is a raster
// of TripFitIcon (src/components/icons/ClosetIcons.tsx); the gradient fill is
// deliberately dropped, since a template image discards color anyway. Regenerate
// with scripts/render-tripfit-tab-icon.py if the logo's geometry changes.

export default function TabLayout() {
  const { accent } = useWeatherTheme();

  return (
    <View style={{ flex: 1 }}>
      <NativeTabs tintColor={accent}>
        <NativeTabs.Trigger name="index">
          <Label>Home</Label>
          <Icon src={require('../../assets/images/ojo_home_tab_icon.png')} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="closet">
          <Label>Closet</Label>
          <Icon sf="hanger" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="camera">
          <Label>Add</Label>
          <Icon sf="camera" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="tripfit">
          <Label>TripFit</Label>
          <Icon src={require('../../assets/images/ojo_tripfit_tab_icon.png')} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="insights">
          <Label>Insights</Label>
          <Icon sf="chart.bar.fill" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  );
}
