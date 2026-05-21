import { useEffect, useState } from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { WeatherProvider } from './src/context/WeatherContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { darkColors, lightColors } from './src/theme/tokens';
import RootNavigator from './src/navigation/RootNavigator';
import {
    initAuthCache,
    isTokenExpiringSoon,
    refreshToken,
    getToken,
} from './src/lib/auth';
import { registerPushToken } from './src/lib/notifications';

SplashScreen.preventAutoHideAsync();

function CustomSplash() {
    const scheme = useColorScheme();
    const dark = scheme === 'dark';

    return (
        <View style={[styles.splashContainer, { backgroundColor: dark ? '#000000' : '#FFFFFF' }]}>
            <Image
                source={dark
                    ? require('./assets/ojoLogo.png')
                    : require('./assets/ojo_word_logo_2.png')
                }
                style={styles.splashLogo}
                resizeMode='contain'
            />
        </View>
    );
}

const styles = StyleSheet.create({
    splashContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    splashLogo: {
        width: 160,
        height: 160,
    },
});

export default function App() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Dismiss native splash immediately so CustomSplash is visible while loading
        SplashScreen.hideAsync();

        const init = async () => {
            try {
                await Font.loadAsync({
                    // Display font
                    DMSerifDisplay: require('./assets/fonts/DMSerifDisplay-Regular.ttf'),
                    // Outfit — static weights (variable font unavailable in this env)
                    Outfit: require('./assets/fonts/Outfit_400Regular.ttf'),
                    'Outfit-Light': require('./assets/fonts/Outfit_300Light.ttf'),
                    'Outfit-Regular': require('./assets/fonts/Outfit_400Regular.ttf'),
                    'Outfit-Medium': require('./assets/fonts/Outfit_500Medium.ttf'),
                    'Outfit-SemiBold': require('./assets/fonts/Outfit_600SemiBold.ttf'),
                    'Outfit-Bold': require('./assets/fonts/Outfit_700Bold.ttf'),
                });
                await initAuthCache();
                if (isTokenExpiringSoon(86_400)) {
                    await refreshToken().catch(() => {});
                }
                // Re-register push token on each cold start so it stays current
                if (getToken()) {
                    registerPushToken().catch(() => {});
                }
            } finally {
                await new Promise((r) => setTimeout(r, 2500));
                setReady(true);
                //TODO:add this line back (maybe?)
                //await SplashScreen.hideAsync();
            }
        };
        init();
    }, []);

    if (!ready) return <CustomSplash />;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
            <SafeAreaProvider>
                <SettingsProvider>
                    <WeatherProvider>
                        <ThemedNavigationShell />
                    </WeatherProvider>
                </SettingsProvider>
            </SafeAreaProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}

/** Renders NavigationContainer + StatusBar inside ThemeProvider so useTheme() works. */
function ThemedNavigationShell() {
    const { colors, isDark } = useTheme();

    const navTheme = isDark
        ? {
              ...DarkTheme,
              colors: {
                  ...DarkTheme.colors,
                  background: colors.bgDefault,
                  card: colors.bgDefault,
                  border: colors.glassBorder,
                  text: colors.textPrimary,
              },
          }
        : {
              ...DefaultTheme,
              colors: {
                  ...DefaultTheme.colors,
                  background: colors.bgDefault,
                  card: colors.bgDefault,
                  border: colors.glassBorder,
                  text: colors.textPrimary,
              },
          };

    return (
        <NavigationContainer theme={navTheme}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <RootNavigator />
        </NavigationContainer>
    );
}
