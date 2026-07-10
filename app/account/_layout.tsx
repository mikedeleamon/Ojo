import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';

export default function AccountLayout() {
  const { colors } = useTheme();

  const subScreen = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.bgDefault },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    // Native platform back button (system chevron, no title text).
    headerBackVisible: true,
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" options={subScreen} />
      <Stack.Screen name="password" options={{ ...subScreen, title: 'Password' }} />
      <Stack.Screen name="history" options={{ ...subScreen, title: 'History' }} />
      {/* Recap ships its own always-dark masthead + nav row (redesign). */}
      <Stack.Screen name="recap" options={{ headerShown: false }} />
      <Stack.Screen name="preferences" options={{ ...subScreen, title: 'Style Preferences' }} />
      <Stack.Screen name="location" options={{ ...subScreen, title: 'Location' }} />
      <Stack.Screen name="locations" options={{ ...subScreen, title: 'Locations' }} />
      <Stack.Screen name="units" options={{ ...subScreen, title: 'Units' }} />
      <Stack.Screen name="price-backfill" options={{ ...subScreen, title: 'Add Prices' }} />
      <Stack.Screen name="notifications" options={{ ...subScreen, title: 'Notifications' }} />
      <Stack.Screen name="trip-mode" options={{ ...subScreen, title: 'Trip Mode' }} />
      <Stack.Screen name="permissions" options={{ ...subScreen, title: 'Permissions' }} />
      <Stack.Screen name="data-usage" options={{ ...subScreen, title: 'Data Usage' }} />
      <Stack.Screen name="legal" options={{ ...subScreen, title: 'Legal' }} />
      <Stack.Screen name="tripfit" options={{ headerShown: false }} />
    </Stack>
  );
}
