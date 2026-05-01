import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { WeatherProvider } from './src/context/WeatherContext';
import { SettingsProvider } from './src/context/SettingsContext';
import RootNavigator from './src/navigation/RootNavigator';
import {
    initAuthCache,
    isTokenExpiringSoon,
    refreshToken,
} from './src/lib/auth';

SplashScreen.preventAutoHideAsync();

function CustomSplash() {
    return (
        <LinearGradient
            colors={['#00C853', '#2979FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.splashGradient}
        >
            <Image
                source={require('./assets/ojoLogo.png')}
                style={styles.splashLogo}
                resizeMode='contain'
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    splashGradient: {
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
        <SafeAreaProvider>
            <SettingsProvider>
                <WeatherProvider>
                    <NavigationContainer>
                        <StatusBar style='light' />
                        <RootNavigator />
                    </NavigationContainer>
                </WeatherProvider>
            </SettingsProvider>
        </SafeAreaProvider>
    );
}
