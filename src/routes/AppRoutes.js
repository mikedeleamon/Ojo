import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainPage from '../views/MainPage/MainPage.tsx';
import SignupPage from '../views/SignupPage/Signup.tsx';
import LoginPage from '../views/LoginPage/LoginPage.tsx';
import Settings from '../views/Settings/Settings.tsx';

const AppRoutes = ({ loggedIn, setLoggedIn }) => {
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
                element={<Settings setLoggedIn={setLoggedIn} />}
            />
            {loggedIn && (
                <Route
                    index
                    element={<MainPage />}
                />
            )}
        </Routes>
    );
};

export default AppRoutes;
