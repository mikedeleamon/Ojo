import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable } from '../components/primitives';
import { Svg, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

import SettingsScreen from '../features/settings/SettingsScreen';
import ProfileScreen from '../features/settings/screens/ProfileScreen';
import PasswordScreen from '../features/settings/screens/PasswordScreen';
import PreferencesScreen from '../features/settings/screens/PreferencesScreen';
import LocationScreen from '../features/settings/screens/LocationScreen';
import UnitsScreen from '../features/settings/screens/UnitsScreen';
import LegalWebViewScreen from '../features/settings/screens/LegalWebViewScreen';
import NotificationsScreen from '../features/settings/screens/NotificationsScreen';
import {
    PermissionsScreen,
    DataUsageScreen,
    HistoryScreen,
} from '../features/settings/screens/SimpleScreens';
import TripFitScreen from '../views/TripFit/TripFitScreen';

const Stack = createNativeStackNavigator();

interface Props {
    onLogout?: () => void;
}

const BackButton = ({ onPress, color }: { onPress: () => void; color: string }) => (
    <Pressable
        onPress={onPress}
        style={{ padding: 8, marginLeft: -8 }}
        accessibilityLabel='Back'
        accessibilityRole="button"
        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
    >
        <Svg
            width={18}
            height={18}
            viewBox='0 0 18 18'
            fill='none'
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
        >
            <Path
                d='M11 14l-5-5 5-5'
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
            />
        </Svg>
    </Pressable>
);

export default function AccountStack({ onLogout }: Props) {
    const { colors } = useTheme();

    const subScreen = ({ navigation }: any) => ({
        headerShown: true,
        headerStyle: { backgroundColor: colors.bgDefault },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerBackVisible: false,
        headerLeft: () => <BackButton onPress={() => navigation.goBack()} color={colors.textPrimary} />,
    });

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

            <Stack.Screen
                name='TripFit'
                options={(p) => ({ ...subScreen(p), title: 'TripFit', headerShown: false })}
                component={TripFitScreen}
            />
        </Stack.Navigator>
    );
}
