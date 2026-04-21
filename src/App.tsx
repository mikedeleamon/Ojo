import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { useSettings, clearSettingsCache } from './hooks/useSettings';
import { AUTH_KEY, clearAuth } from './lib/auth';
import { storage } from './lib/storage';

const ONBOARD_KEY = 'ojo_onboarding_done';

// Synchronous boot check — reads localStorage directly once on startup.
// RN migration: replace with SplashScreen + async SecureStore.getItemAsync().
const isLoggedIn = (): boolean => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return !!raw && !!JSON.parse(raw).token;
  } catch {
    return false;
  }
};

const App = () => {
  const [loggedIn,        setLoggedIn]        = useState<boolean>(isLoggedIn);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const { settings, settingsReady, saveSettings } = useSettings();

  const handleLogout = async () => {
    await clearAuth();
    await clearSettingsCache();
    await storage.removeItem(ONBOARD_KEY);
    setLoggedIn(false);
    setNeedsOnboarding(false);
  };

  return (
    <Router>
      <AppRoutes
        loggedIn={loggedIn}
        setLoggedIn={setLoggedIn}
        onLogout={handleLogout}
        settings={settings}
        settingsReady={settingsReady}
        saveSettings={saveSettings}
        needsOnboarding={needsOnboarding}
        setNeedsOnboarding={setNeedsOnboarding}
      />
    </Router>
  );
};

export default App;
