import { Routes, Route, Navigate } from 'react-router-dom';
import { Settings } from '../types';

// Existing views
import MainPage from '../views/MainPage/MainPage';
import LoginPage from '../views/LoginPage/LoginPage';
import SignupPage from '../views/SignupPage/Signup';
import ClosetPage from '../views/ClosetPage/ClosetPage';
import OnboardingPage from '../views/OnboardingPage/OnboardingPage';

// New flat settings architecture
import SettingsScreen from '../features/settings/SettingsScreen';
import ProfileScreen from '../features/settings/screens/ProfileScreen';
import PasswordScreen from '../features/settings/screens/PasswordScreen';
import PreferencesScreen from '../features/settings/screens/PreferencesScreen';
import {
    NotificationsScreen,
    PermissionsScreen,
    DataUsageScreen,
    HistoryScreen,
} from '../features/settings/screens/SimpleScreens';

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
    loggedIn,
    setLoggedIn,
    onLogout,
    settings,
    settingsReady,
    saveSettings,
    needsOnboarding,
    setNeedsOnboarding,
}: Props) => {
    const guard = (el: React.ReactElement) =>
        loggedIn ? (
            el
        ) : (
            <Navigate
                to='/login'
                replace
            />
        );

    return (
        <Routes>
            {/* ── Home ── */}
            <Route
                path='/'
                element={
                    loggedIn ? (
                        needsOnboarding ? (
                            <Navigate
                                to='/onboarding'
                                replace
                            />
                        ) : (
                            <MainPage
                                settings={settings}
                                settingsReady={settingsReady}
                            />
                        )
                    ) : (
                        <Navigate
                            to='/login'
                            replace
                        />
                    )
                }
            />

            {/* ── Auth ── */}
            <Route
                path='/login'
                element={<LoginPage setLoggedIn={setLoggedIn} />}
            />
            <Route
                path='/signup'
                element={
                    <SignupPage
                        setLoggedIn={setLoggedIn}
                        setNeedsOnboarding={setNeedsOnboarding}
                    />
                }
            />
            <Route
                path='/onboarding'
                element={
                    loggedIn ? (
                        <OnboardingPage
                            settings={settings}
                            saveSettings={saveSettings}
                            setNeedsOnboarding={setNeedsOnboarding}
                        />
                    ) : (
                        <Navigate
                            to='/login'
                            replace
                        />
                    )
                }
            />

            {/* ── Legacy routes (kept for backwards compat) ── */}
            <Route
                path='/settings'
                element={guard(<PreferencesScreen />)}
            />
            <Route
                path='/closet'
                element={guard(<ClosetPage />)}
            />

            {/* ── Account / Settings flat-list architecture ── */}
            <Route
                path='/account'
                element={guard(<SettingsScreen onLogout={onLogout} />)}
            />

            {/* Detail screens — each 1 level deep, matching SETTINGS_CONFIG routes */}
            <Route
                path='/account/profile'
                element={guard(<ProfileScreen onLogout={onLogout} />)}
            />
            <Route
                path='/account/password'
                element={guard(<PasswordScreen />)}
            />
            <Route
                path='/account/history'
                element={guard(<HistoryScreen />)}
            />
            <Route
                path='/account/preferences'
                element={guard(<PreferencesScreen />)}
            />
            <Route
                path='/account/notifications'
                element={guard(<NotificationsScreen />)}
            />
            <Route
                path='/account/permissions'
                element={guard(<PermissionsScreen />)}
            />
            <Route
                path='/account/data-usage'
                element={guard(<DataUsageScreen />)}
            />

            {/* Closet navigated to from the settings list */}
            <Route
                path='*'
                element={
                    <Navigate
                        to='/'
                        replace
                    />
                }
            />
        </Routes>
    );
};

export default AppRoutes;
