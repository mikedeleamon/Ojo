import { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getToken } from '../lib/auth';
import AppTabs from './AppTabs';
import LoginPage from '../views/LoginPage/LoginPage';
import SignupPage from '../views/SignupPage/Signup';
import OnboardingPage from '../views/OnboardingPage/OnboardingPage';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // getToken() is synchronous after initAuthCache() ran in App.tsx
    setIsLoggedIn(!!getToken());
  }, []);

  if (isLoggedIn === null) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <Stack.Screen name="App">
          {() => <AppTabs onLogout={() => setIsLoggedIn(false)} />}
        </Stack.Screen>
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
