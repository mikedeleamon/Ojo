import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { useSettings, clearSettingsSession } from './hooks/useSettings';
import { AUTH_KEY } from './lib/auth';

const ONBOARD_KEY = 'ojo_onboarding_done';

const isLoggedIn = (): boolean => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return !!raw && !!JSON.parse(raw).token;
  } catch {
    return false;
  }
};


const App = () => {
  const [loggedIn,          setLoggedIn]          = useState<boolean>(isLoggedIn);
  const [needsOnboarding,   setNeedsOnboarding]   = useState<boolean>(false);
  const { settings, settingsReady, saveSettings } = useSettings();

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    clearSettingsSession();
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
