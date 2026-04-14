import { Routes, Route, Navigate } from 'react-router-dom';
import { Settings } from '../types';
import MainPage from '../views/MainPage/MainPage';
import LoginPage from '../views/LoginPage/LoginPage';
import SignupPage from '../views/SignupPage/Signup';
import SettingsPage from '../views/SettingsPage/SettingsPage';

interface Props {
  loggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
  settings: Settings;
  saveSettings: (s: Settings) => void;
}

const AppRoutes = ({ loggedIn, setLoggedIn, settings, saveSettings }: Props) => (
  <Routes>
    <Route path='/' element={loggedIn ? <MainPage settings={settings} /> : <Navigate to='/login' replace />} />
    <Route path='/login' element={<LoginPage setLoggedIn={setLoggedIn} />} />
    <Route path='/signup' element={<SignupPage setLoggedIn={setLoggedIn} />} />
    <Route path='/settings' element={<SettingsPage settings={settings} saveSettings={saveSettings} />} />
  </Routes>
);

export default AppRoutes;
