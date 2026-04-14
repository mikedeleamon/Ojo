import { Routes, Route, Navigate } from 'react-router-dom';
import { Settings } from '../types';
import MainPage from '../views/MainPage/MainPage';
import LoginPage from '../views/LoginPage/LoginPage';
import SignupPage from '../views/SignupPage/Signup';
import SettingsPage from '../views/SettingsPage/SettingsPage';
import AccountPage from '../views/AccountPage/AccountPage';

interface Props {
  loggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
  onLogout: () => void;
  settings: Settings;
  settingsReady: boolean;
  saveSettings: (s: Settings) => Promise<void>;
}

const AppRoutes = ({ loggedIn, setLoggedIn, onLogout, settings, settingsReady, saveSettings }: Props) => (
  <Routes>
    <Route path='/'         element={loggedIn ? <MainPage settings={settings} settingsReady={settingsReady} /> : <Navigate to='/login' replace />} />
    <Route path='/settings' element={loggedIn ? <SettingsPage settings={settings} saveSettings={saveSettings} /> : <Navigate to='/login' replace />} />
    <Route path='/account'  element={loggedIn ? <AccountPage settings={settings} saveSettings={saveSettings} onLogout={onLogout} /> : <Navigate to='/login' replace />} />
    <Route path='/login'    element={<LoginPage setLoggedIn={setLoggedIn} />} />
    <Route path='/signup'   element={<SignupPage setLoggedIn={setLoggedIn} />} />
  </Routes>
);

export default AppRoutes;
