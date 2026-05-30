import { View } from 'react-native';
import { NativeTabs, Label, Icon } from 'expo-router/unstable-native-tabs';

// ─── Tab layout ──────────────────────────────────────────────────────────────
// The `camera` trigger points to a thin redirect screen at app/(tabs)/camera.tsx
// that immediately presents the fullScreenModal at app/camera.tsx — this is the
// only way to keep the camera icon in the native tab bar AND have iOS hide the
// bar while the camera UI is active. See plan: there-s-got-to-be-joyful-garden.

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Label>Home</Label>
          <Icon sf="sun.max.fill" />
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
