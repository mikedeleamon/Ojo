import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/ThemeContext';

const BackButton = ({ color, onPress }: { color: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={{ padding: 8, marginLeft: -8 }}
    accessibilityLabel="Back"
    accessibilityRole="button"
    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
  >
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none"
      accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M11 14l-5-5 5-5" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </Pressable>
);

export default function AccountLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  const subScreen = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.bgDefault },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    headerBackVisible: false,
    headerLeft: () => <BackButton color={colors.textPrimary} onPress={() => router.back()} />,
  };

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" options={subScreen} />
      <Stack.Screen name="password" options={{ ...subScreen, title: 'Password' }} />
      <Stack.Screen name="history" options={{ ...subScreen, title: 'History' }} />
      <Stack.Screen name="preferences" options={{ ...subScreen, title: 'Style Preferences' }} />
      <Stack.Screen name="location" options={{ ...subScreen, title: 'Location' }} />
      <Stack.Screen name="locations" options={{ ...subScreen, title: 'Locations' }} />
      <Stack.Screen name="units" options={{ ...subScreen, title: 'Units' }} />
      <Stack.Screen name="notifications" options={{ ...subScreen, title: 'Notifications' }} />
      <Stack.Screen name="permissions" options={{ ...subScreen, title: 'Permissions' }} />
      <Stack.Screen name="data-usage" options={{ ...subScreen, title: 'Data Usage' }} />
      <Stack.Screen name="legal" options={{ ...subScreen, title: 'Legal' }} />
      <Stack.Screen name="tripfit" options={{ headerShown: false }} />
    </Stack>
  );
}
