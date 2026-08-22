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

        <NativeTabs.Trigger name="style">
          <Label>Style</Label>
          <Icon sf="sparkles" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="insights">
          <Label>Insights</Label>
          <Icon sf="chart.bar.fill" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  );
}
