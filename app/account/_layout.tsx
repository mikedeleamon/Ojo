import { Pressable } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';

function AccountBackButton({ color }: { color: string }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))}
      hitSlop={12}
      style={{ paddingRight: 12, paddingVertical: 4 }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M15 6l-6 6 6 6" />
      </Svg>
    </Pressable>
  );
}

export default function AccountLayout() {
  const { colors } = useTheme();

  const subScreen = {
    headerShown: true,
    headerStyle: { backgroundColor: colors.bgDefault },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    // Custom chevron rather than the native default: headerBackVisible has no
    // effect when a screen is pushed directly from outside this stack (e.g.
    // Insights -> price-backfill, Main -> locations), which makes it screen #1
    // of this navigator's own history and hides the native back button. This
    // renders unconditionally and falls back to /account when there's nothing
    // to pop.
    headerLeft: () => <AccountBackButton color={colors.textPrimary} />,
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
    </Stack>
  );
}
