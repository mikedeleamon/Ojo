import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { useSettings } from './hooks/useSettings';

const App = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const { settings, saveSettings } = useSettings();

  return (
    <Router>
      <AppRoutes
        loggedIn={loggedIn}
        setLoggedIn={setLoggedIn}
        settings={settings}
        saveSettings={saveSettings}
      />
    </Router>
  );
};

export default App;
