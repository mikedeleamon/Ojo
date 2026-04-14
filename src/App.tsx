import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { useSettings } from './hooks/useSettings';

const AUTH_KEY = 'ojo_auth';

const isLoggedIn = (): boolean => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return !!raw && !!JSON.parse(raw).token;
  } catch {
    return false;
  }
};

const App = () => {
  const [loggedIn, setLoggedIn] = useState<boolean>(isLoggedIn);
  const { settings, saveSettings } = useSettings();

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setLoggedIn(false);
  };

  return (
    <Router>
      <AppRoutes
        loggedIn={loggedIn}
        setLoggedIn={setLoggedIn}
        onLogout={handleLogout}
        settings={settings}
        saveSettings={saveSettings}
      />
    </Router>
  );
};

export default App;
