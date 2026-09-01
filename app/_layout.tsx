import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { redirectSystemPath } from './+native-intent';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { SettingsProvider } from '../src/context/SettingsContext';
import { ActiveLocationProvider } from '../src/context/ActiveLocationContext';
import { WeatherProvider } from '../src/context/WeatherContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ConfirmProvider } from '../src/components/ConfirmDialog';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { isOnboardingComplete, isOnboardingPending } from '../src/lib/onboarding';
import { isAgeVerificationNeeded } from '../src/lib/ageGate';
import { recordAppOpen } from '../src/services/reviewManager';
import { reconcileWeeklyRecap, reconcileMorningBriefs, reconcileSameDayNudges } from '../src/lib/notifications';
import * as Sentry from '@sentry/react-native';
import { scrubBreadcrumb, scrubEvent } from '../src/lib/sentryScrub';

// Crash and error reporting. Off in development so local work doesn't burn
// quota or bury real production events.
//
// What we send is deliberately narrow: it matches what the privacy policy
// already declares in src/config/legal.ts §2.2 — device info, app version,
// and error reports, nothing more. The wizard's defaults collected more than
// that, and each one is off for a specific reason noted below. Turning any of
// them on means updating the policy and the App Store privacy labels first.
Sentry.init({
  dsn: 'https://06b067cae6dd4e7ec877a2b838d5ee7a@o4511952303423488.ingest.us.sentry.io/4511952313712640',

  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : 'production',

  // Would attach IP addresses and user context to every event. The policy's
  // "Information We Do NOT Collect" section doesn't carve out room for it.
  sendDefaultPii: false,

  // Would forward console output. This app logs enough user-adjacent detail
  // that it isn't safe to ship off-device wholesale.
  enableLogs: false,

  // Session Replay records the screen — closet photos, name, email, city.
  // Undeclared, and this app gates to 13+ under COPPA, so replay of a minor's
  // session is not something to enable casually.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Coordinates travel as query params on the weather and trip endpoints, and
  // Sentry records request URLs verbatim. Both hooks strip query strings — see
  // src/lib/sentryScrub.ts for why a crash report never needs that precision.
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
});

SplashScreen.preventAutoHideAsync();

// Launch-scoped guard mirroring useTripPlans' reconcile pattern — AuthGate's
// effect can re-run on every segment change, but the recap re-schedule only
// needs to happen once per app process.
let weeklyRecapReconciledThisLaunch = false;

// Same guard for the Morning Outfit Brief. This one only ever *cancels* — it
// catches the case where the brief was switched off on another device, since
// settings sync through the server but scheduled notifications don't. Refilling
// the window needs weather and closet data, so that stays with
// useMorningBriefScheduler on the home screen.
let morningBriefReconciledThisLaunch = false;

// Same guard for the Same-Day Weather Nudge — cancel-only, same reasoning as
// the Brief's reconcile above.
let sameDayNudgeReconciledThisLaunch = false;

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
    const onAgeGate      = segs[1] === 'verify-age';

    // Reset-password deep link must always reach its screen, even for users
    // who are already signed in.
    if (onResetScreen) return;

    // `onAgeGate` is called out explicitly because the gate offers a sign-out.
    // Every other (auth) screen is already somewhere a signed-out user belongs,
    // but the gate is not — without this it would keep rendering after logout
    // and the button would look broken.
    if (!isLoggedIn && (!inAuthGroup || onAgeGate)) {
      router.replace('/(auth)/login');
      return;
    }

    if (isLoggedIn) {
      Promise.all([
        isAgeVerificationNeeded(),
        isOnboardingPending(),
        isOnboardingComplete(),
      ]).then(([needsAge, pending, done]) => {
        // The age gate outranks everything else. The server refuses every data
        // route until it's satisfied, so there is nothing for onboarding or the
        // tabs to load until this clears.
        if (needsAge) {
          if (!onAgeGate) router.replace('/(auth)/verify-age');
          return;
        }

        // Deferred until past the gate so an unverified account doesn't spend
        // every launch firing requests the server is going to 403.
        if (!weeklyRecapReconciledThisLaunch) {
          weeklyRecapReconciledThisLaunch = true;
          reconcileWeeklyRecap().catch(() => {});
        }

        if (!morningBriefReconciledThisLaunch) {
          morningBriefReconciledThisLaunch = true;
          reconcileMorningBriefs().catch(() => {});
        }

        if (!sameDayNudgeReconciledThisLaunch) {
          sameDayNudgeReconciledThisLaunch = true;
          reconcileSameDayNudges().catch(() => {});
        }

        // Onboarding is shown only when it was explicitly requested by completing
        // the sign-up form (the `pending` flag) and hasn't been finished yet.
        // Users signed in from remembered credentials or the login screen have no
        // pending flag, so they skip straight to the tabs.
        if (pending && !done && !onOnboarding) {
          router.replace('/(auth)/onboarding');
        } else if ((!pending || done) && inAuthGroup && !onOnboarding) {
          router.replace('/(tabs)');
        }
      });
    }
  }, [isReady, isLoggedIn, segments]);

  if (!isReady) return null;

  return <>{children}</>;
}

// ─── Notification tap routing ────────────────────────────────────────────────
// Local notifications carry an optional `data.url` (`ojo://…`) — the same
// scheme the widget deep links use, mapped through the same +native-intent
// table so notification taps and widget taps can't drift apart. Covers both
// cold starts (the response that launched the app) and warm taps. Renders
// nothing; lives inside AuthGate so the login redirect still wins when
// signed out.
function NotificationDeepLinkRouter() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const url = response.notification.request.content.data?.url;
    if (typeof url !== 'string') return;

    // Each tap is one response object; dedupe so re-renders don't re-navigate.
    const id = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handledId.current === id) return;
    handledId.current = id;

    try {
      const mapped = redirectSystemPath({ path: url, initial: false });
      if (mapped && mapped.startsWith('/')) router.push(mapped as never);
    } catch {
      // Never let a bad link crash launch — the app just opens normally.
    }
  }, [response, router]);

  return null;
}

// ─── Root layout ─────────────────────────────────────────────────────────────
export default Sentry.wrap(function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Counts cold starts only (this effect runs once per process launch, not
  // per foreground resume) — feeds the in-app review eligibility check.
  useEffect(() => {
    recordAppOpen().catch(() => {});
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync();

    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          DMSerifDisplay: require('../assets/fonts/DMSerifDisplay-Regular.ttf'),
          'Fraunces-SemiBold': require('../assets/fonts/Fraunces-SemiBold.ttf'),
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
                <ActiveLocationProvider>
                <WeatherProvider>
                  <ConfirmProvider>
                    <AuthGate>
                      <ThemedStatusBar />
                      <NotificationDeepLinkRouter />
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
                  </ConfirmProvider>
                </WeatherProvider>
                </ActiveLocationProvider>
              </SettingsProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
});

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
