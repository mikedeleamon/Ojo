import { useEffect, useState } from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
import { Slot, Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { WeatherProvider } from '../src/context/WeatherContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { isOnboardingComplete, isOnboardingPending } from '../src/lib/onboarding';

SplashScreen.preventAutoHideAsync();

// ─── Splash ──────────────────────────────────────────────────────────────────
function CustomSplash() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return (
    <View style={[styles.splashContainer, { backgroundColor: dark ? '#000000' : '#FFFFFF' }]}>
      <Image
        source={dark ? require('../assets/images/logos/ojoLogo.png') : require('../assets/images/logos/ojo_word_logo_2.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 160, height: 160 },
});

// ─── Auth redirect ───────────────────────────────────────────────────────────
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isReady, isLoggedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    const segs = segments as readonly string[];
    const inAuthGroup    = segs[0] === '(auth)';
    const onResetScreen  = segs[1] === 'reset-password';
    const onOnboarding   = segs[1] === 'onboarding';

    // Reset-password deep link must always reach its screen, even for users
    // who are already signed in.
    if (onResetScreen) return;

    if (!isLoggedIn && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isLoggedIn) {
      // Onboarding is shown only when it was explicitly requested by completing
      // the sign-up form (the `pending` flag) and hasn't been finished yet.
      // Users signed in from remembered credentials or the login screen have no
      // pending flag, so they skip straight to the tabs.
      Promise.all([isOnboardingPending(), isOnboardingComplete()]).then(
        ([pending, done]) => {
          if (pending && !done && !onOnboarding) {
            router.replace('/(auth)/onboarding');
          } else if ((!pending || done) && inAuthGroup && !onOnboarding) {
            router.replace('/(tabs)');
          }
        },
      );
    }
  }, [isReady, isLoggedIn, segments]);

  if (!isReady) return null;

  return <>{children}</>;
}

// ─── Root layout ─────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync();

    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          DMSerifDisplay: require('../assets/fonts/DMSerifDisplay-Regular.ttf'),
          Outfit:          require('../assets/fonts/Outfit_400Regular.ttf'),
          'Outfit-Light':    require('../assets/fonts/Outfit_300Light.ttf'),
          'Outfit-Regular':  require('../assets/fonts/Outfit_400Regular.ttf'),
          'Outfit-Medium':   require('../assets/fonts/Outfit_500Medium.ttf'),
          'Outfit-SemiBold': require('../assets/fonts/Outfit_600SemiBold.ttf'),
          'Outfit-Bold':     require('../assets/fonts/Outfit_700Bold.ttf'),
        });
      } finally {
        setFontsLoaded(true);
      }
    };
    loadFonts();
  }, []);

  if (!fontsLoaded) return <CustomSplash />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <SafeAreaProvider>
            <AuthProvider>
              <SettingsProvider>
                <WeatherProvider>
                  <AuthGate>
                    <ThemedStatusBar />
                    {/* Stack so the camera screen can present as a fullScreenModal
                        that covers the native tab bar. All other routes are
                        auto-discovered and inherit default options. */}
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen
                        name="capture"
                        options={{
                          presentation: 'fullScreenModal',
                          animation: 'slide_from_bottom',
                          gestureEnabled: false,
                        }}
                      />
                    </Stack>
                  </AuthGate>
                </WeatherProvider>
              </SettingsProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
