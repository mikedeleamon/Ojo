import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { useSettings, clearSettingsSession } from './hooks/useSettings';

const AUTH_KEY      = 'ojo_auth';
const OLD_LOCAL_KEY = 'ojo_settings'; // legacy key from previous localStorage approach

const isLoggedIn = (): boolean => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return !!raw && !!JSON.parse(raw).token;
  } catch {
    return false;
  }
};

// One-time migration: remove any stale settings from localStorage
// so the old approach never silently takes precedence over MongoDB.
localStorage.removeItem(OLD_LOCAL_KEY);

const App = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(isLoggedIn);
  const { settings, settingsReady, saveSettings } = useSettings();

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    clearSettingsSession();
    setLoggedIn(false);
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
      />
    </Router>
  );
};

export default App;
