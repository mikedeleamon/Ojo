import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable } from '../components/primitives';
import { Svg, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

import SettingsScreen from '../features/settings/SettingsScreen';
import ProfileScreen from '../features/settings/screens/ProfileScreen';
import PasswordScreen from '../features/settings/screens/PasswordScreen';
import PreferencesScreen from '../features/settings/screens/PreferencesScreen';
import LocationScreen from '../features/settings/screens/LocationScreen';
import UnitsScreen from '../features/settings/screens/UnitsScreen';
import LegalWebViewScreen from '../features/settings/screens/LegalWebViewScreen';
import {
    NotificationsScreen,
    PermissionsScreen,
    DataUsageScreen,
    HistoryScreen,
} from '../features/settings/screens/SimpleScreens';

const Stack = createNativeStackNavigator();

interface Props {
    onLogout?: () => void;
}

const BackButton = ({ onPress }: { onPress: () => void }) => (
    <Pressable
        onPress={onPress}
        style={{ padding: 8, marginLeft: -8 }}
        accessibilityLabel='Back'
    >
        <Svg
            width={18}
            height={18}
            viewBox='0 0 18 18'
            fill='none'
        >
            <Path
                d='M11 14l-5-5 5-5'
                stroke={colors.textPrimary}
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
            />
        </Svg>
    </Pressable>
);

const subScreen = ({ navigation }: any) => ({
    headerShown: true,
    headerStyle: { backgroundColor: colors.bgDefault },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    headerBackVisible: false,
    headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
});

export default function AccountStack({ onLogout }: Props) {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name='Settings'>
                {() => <SettingsScreen onLogout={onLogout} />}
            </Stack.Screen>

            <Stack.Screen
                name='Profile'
                options={subScreen}
            >
                {() => <ProfileScreen onLogout={onLogout} />}
            </Stack.Screen>

            <Stack.Screen
                name='Password'
                options={subScreen}
                component={PasswordScreen}
            />

            <Stack.Screen
                name='History'
                options={subScreen}
                component={HistoryScreen}
            />

            <Stack.Screen
                name='PreferencesScreen'
                options={(p) => ({
                    ...subScreen(p),
                    title: 'Style Preferences',
                })}
                component={PreferencesScreen}
            />

            <Stack.Screen
                name='Location'
                options={subScreen}
                component={LocationScreen}
            />
            <Stack.Screen
                name='Units'
                options={subScreen}
                component={UnitsScreen}
            />
            <Stack.Screen
                name='Notifications'
                options={subScreen}
                component={NotificationsScreen}
            />
            <Stack.Screen
                name='Permissions'
                options={subScreen}
                component={PermissionsScreen}
            />

            <Stack.Screen
                name='DataUsage'
                options={(p) => ({ ...subScreen(p), title: 'Data Usage' })}
                component={DataUsageScreen}
            />

            <Stack.Screen
                name='Legal'
                options={subScreen}
            >
                {({ route }: any) => (
                    <LegalWebViewScreen doc={(route.params as any)?.doc} />
                )}
            </Stack.Screen>
        </Stack.Navigator>
    );
}
