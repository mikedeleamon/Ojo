import { Pressable, View } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { Stack, useRouter, useSegments } from 'expo-router';
import SettingsScreen from '../../src/features/settings/SettingsScreen';
import { useFoldLayout } from '../../src/context/FoldLayoutContext';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/theme/ThemeContext';

function AccountBackButton({ color }: { color: string }) {
    const router = useRouter();
    return (
        <Pressable
            onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/account')
            }
            hitSlop={12}
            style={{ paddingRight: 12, paddingVertical: 4 }}
            accessibilityRole='button'
            accessibilityLabel='Go back'
        >
            <Svg
                width={22}
                height={22}
                viewBox='0 0 24 24'
                fill='none'
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <Path d='M15 6l-6 6 6 6' />
            </Svg>
        </Pressable>
    );
}

// These run full screen in every layout, and lay themselves out in two panes.
const FULL_SCREEN_ROUTES = new Set(['recap', 'upgrade', 'locations']);

export default function AccountLayout() {
    const { colors } = useTheme();
    const fold = useFoldLayout();
    const { logout } = useAuth();
    const segments = useSegments() as string[];
    const route = segments[segments.length - 1];
    // Two panes: the settings list stays on the left and the stack runs on the
    // right, so a row opens beside the list. The stack keeps its place in the
    // tree (by key), which means folding can't remount it and lose a form.
    const showList = fold.mode === 'two-pane' && fold.axis === 'row' && !FULL_SCREEN_ROUTES.has(route);

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
        // Beside the list there's nothing to go back to.
        headerLeft: showList ? undefined : () => <AccountBackButton color={colors.textPrimary} />,
        headerBackVisible: showList ? false : undefined,
    };

    return (
        <View style={{ flex: 1, flexDirection: showList ? 'row' : 'column', backgroundColor: colors.bgDefault }}>
        {showList && (
            <View key='list' style={{ width: fold.panes?.primary.width }}>
                <SettingsScreen onLogout={logout} embedded activeRoute={route} />
            </View>
        )}
        <View key='stack' style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgDefault } }}>
            <Stack.Screen name='index' />
            <Stack.Screen
                name='profile'
                options={{ ...subScreen, title: 'Profile' }}
            />
            <Stack.Screen
                name='upgrade'
                options={{ ...subScreen, title: 'Ojo Pro' }}
            />
            <Stack.Screen
                name='password'
                options={{ ...subScreen, title: 'Password' }}
            />
            <Stack.Screen
                name='history'
                options={{ ...subScreen, title: 'Wear Calendar' }}
            />
            {/* Recap ships its own always-dark masthead + nav row (redesign). */}
            <Stack.Screen
                name='recap'
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name='preferences'
                options={{ ...subScreen, title: 'Style Preferences' }}
            />
            <Stack.Screen
                name='location'
                options={{ ...subScreen, title: 'Default City' }}
            />
            <Stack.Screen
                name='locations'
                options={{ ...subScreen, title: 'Locations' }}
            />
            <Stack.Screen
                name='price-backfill'
                options={{ ...subScreen, title: 'Add Prices' }}
            />
            <Stack.Screen
                name='notifications'
                options={{ ...subScreen, title: 'Notifications' }}
            />
            <Stack.Screen
                name='trip-mode'
                options={{ ...subScreen, title: 'Trip Mode' }}
            />
            <Stack.Screen
                name='permissions'
                options={{ ...subScreen, title: 'Permissions' }}
            />
            <Stack.Screen
                name='data-usage'
                options={{ ...subScreen, title: 'Data Usage' }}
            />
            <Stack.Screen
                name='legal'
                options={{ ...subScreen, title: 'Legal' }}
            />
        </Stack>
        </View>
        </View>
    );
}
