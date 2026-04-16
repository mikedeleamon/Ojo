import { Routes, Route, Navigate } from 'react-router-dom';
import { Settings } from '../types';
import MainPage from '../views/MainPage/MainPage';
import LoginPage from '../views/LoginPage/LoginPage';
import SignupPage from '../views/SignupPage/Signup';
import SettingsPage from '../views/SettingsPage/SettingsPage';
import AccountPage from '../views/AccountPage/AccountPage';
import ClosetPage from '../views/ClosetPage/ClosetPage';
import OnboardingPage from '../views/OnboardingPage/OnboardingPage';

const ONBOARD_KEY = 'ojo_onboarding_done';

interface Props {
  loggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
  onLogout: () => void;
  settings: Settings;
  settingsReady: boolean;
  saveSettings: (s: Settings) => Promise<void>;
  needsOnboarding: boolean;
  setNeedsOnboarding: (v: boolean) => void;
}

const AppRoutes = ({
  loggedIn, setLoggedIn, onLogout,
  settings, settingsReady, saveSettings,
  needsOnboarding, setNeedsOnboarding,
}: Props) => (
  <Routes>
    <Route path='/' element={
      loggedIn
        ? needsOnboarding
          ? <Navigate to='/onboarding' replace />
          : <MainPage settings={settings} settingsReady={settingsReady} />
        : <Navigate to='/login' replace />
    } />
    <Route path='/onboarding' element={
      loggedIn
        ? <OnboardingPage settings={settings} saveSettings={saveSettings} setNeedsOnboarding={setNeedsOnboarding} />
        : <Navigate to='/login' replace />
    } />
    <Route path='/settings' element={loggedIn ? <SettingsPage settings={settings} saveSettings={saveSettings} /> : <Navigate to='/login' replace />} />
    <Route path='/account'  element={loggedIn ? <AccountPage settings={settings} saveSettings={saveSettings} onLogout={onLogout} /> : <Navigate to='/login' replace />} />
    <Route path='/closet'   element={loggedIn ? <ClosetPage /> : <Navigate to='/login' replace />} />
    <Route path='/login'    element={<LoginPage setLoggedIn={setLoggedIn} />} />
    <Route path='/signup'   element={<SignupPage setLoggedIn={setLoggedIn} setNeedsOnboarding={setNeedsOnboarding} />} />
  </Routes>
);

export default AppRoutes;
