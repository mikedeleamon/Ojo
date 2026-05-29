import { View } from 'react-native';
import { NativeTabs, Label, Icon } from 'expo-router/unstable-native-tabs';

// ─── Tab layout ──────────────────────────────────────────────────────────────
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
      </NativeTabs>
    </View>
  );
}
