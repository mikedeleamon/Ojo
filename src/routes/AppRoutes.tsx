import { Routes, Route, Navigate } from 'react-router-dom';
import MainPage from '../views/MainPage/MainPage';
import SignupPage from '../views/SignupPage/Signup';
import LoginPage from '../views/LoginPage/LoginPage';
import SettingsPage from '../views/SettingsPage/SettingsPage';

interface AppRoutesProps {
    loggedIn: boolean;
    setLoggedIn: (value: boolean) => void;
}

function AppRoutes({ loggedIn, setLoggedIn }: AppRoutesProps) {
    return (
        <Routes>
            <Route
                path='/'
                element={loggedIn ? <MainPage /> : <Navigate to='/login' />}
            />
            <Route
                path='/login'
                element={<LoginPage setLoggedIn={setLoggedIn} />}
            />
            <Route
                path='/signup'
                element={<SignupPage setLoggedIn={setLoggedIn} />}
            />
            <Route
                path='/settings'
                element={<SettingsPage setLoggedIn={setLoggedIn} />}
            />
            {loggedIn && (
                <Route
                    index
                    element={<MainPage />}
                />
            )}
        </Routes>
    );
}

export default AppRoutes;
