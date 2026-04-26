import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Svg, Path } from 'react-native-svg';
import { useWeatherTheme } from '../context/WeatherContext';
import { colors } from '../theme/tokens';
import MainPage from '../views/MainPage/MainPage';
import ClosetPage from '../views/ClosetPage/ClosetPage';
import PreferencesScreen from '../features/settings/screens/PreferencesScreen';

const Tab = createBottomTabNavigator();

const HangerIcon = ({ color }: { color: string }) => (
    <Svg
        width={26}
        height={26}
        viewBox='0 0 24 24'
        fill='none'
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <Path
            d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </Svg>
);

const SparklesIcon = ({ color }: { color: string }) => (
    <Svg
        width={26}
        height={26}
        viewBox='0 0 24 24'
        fill='none'
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <Path d='M15 4l1.5 3L20 8.5 16.5 10 15 13l-1.5-3L10 8.5 13.5 7z' />
        <Path d='M6 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z' />
    </Svg>
);


export default function AppTabs() {
    const { footerBg } = useWeatherTheme();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: footerBg,
                    borderTopColor: colors.glassBorder,
                    borderTopWidth: 1,
                },
                tabBarActiveTintColor: colors.textPrimary,
                tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
                tabBarLabelStyle: {
                    fontFamily: 'Outfit',
                    fontSize: 10,
                    fontWeight: '500',
                },
            }}
        >
            <Tab.Screen
                name='Home'
                component={MainPage}
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ focused }) => (
                        <Image
                            source={require('../../assets/images/weatherIcons/Sunny.png')}
                            style={{
                                width: 26,
                                height: 26,
                                opacity: focused ? 1 : 0.45,
                            }}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name='Closet'
                component={ClosetPage}
                options={{
                    tabBarLabel: 'Closet',
                    tabBarIcon: ({ color }) => <HangerIcon color={color} />,
                }}
            />
            <Tab.Screen
                name='Style'
                options={{
                    tabBarLabel: 'Style',
                    tabBarIcon: ({ color }) => <SparklesIcon color={color} />,
                }}
            >
                {() => (
                    <SafeAreaView
                        style={styles.tabRoot}
                        edges={['top']}
                    >
                        <PreferencesScreen />
                    </SafeAreaView>
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabRoot: { flex: 1, backgroundColor: colors.bgDefault },
});
