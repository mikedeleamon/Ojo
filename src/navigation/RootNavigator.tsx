import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getToken } from '../lib/auth';
import AppTabs from './AppTabs';
import AccountStack from './AccountStack';
import LoginPage from '../views/LoginPage/LoginPage';
import SignupPage from '../views/SignupPage/Signup';
import OnboardingPage from '../views/OnboardingPage/OnboardingPage';
import { colors } from '../theme/tokens';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // getToken() is synchronous after initAuthCache() ran in App.tsx
    setIsLoggedIn(!!getToken());
  }, []);

  if (isLoggedIn === null) {
    return (
      <View style={st.splash}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <>
          <Stack.Screen name="App" component={AppTabs} />
          <Stack.Screen name="Account">
            {() => <AccountStack onLogout={() => setIsLoggedIn(false)} />}
          </Stack.Screen>
        </>
      ) : (
        <>
          <Stack.Screen name="Login">
            {() => <LoginPage onLogin={() => setIsLoggedIn(true)} />}
          </Stack.Screen>
          <Stack.Screen name="Signup"     component={SignupPage} />
          <Stack.Screen name="Onboarding">
            {() => <OnboardingPage onComplete={() => setIsLoggedIn(true)} />}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
}

const st = StyleSheet.create({
  splash: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.bgDefault,
  },
});
