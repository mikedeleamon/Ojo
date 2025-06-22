import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AppRoutes from './routes/AppRoutes';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
    const [loggedIn, setLoggedIn] = useState<boolean>(false);

    const [preferences, setPreferences] = useState({
        coldThreshold: 15,
        warmThreshold: 25,
    });

    useEffect(() => {
        //TODO make fake users
        //TODO add some login logic after creating a User account
        // Simulating login logic
        setTimeout(() => {
            setLoggedIn(false);
        }, 2000);
    }, []);

    return (
        <Router>
            <div>
                <AppRoutes
                    loggedIn={loggedIn}
                    setLoggedIn={setLoggedIn}
                />
                <Routes>
                    <Route
                        path='/fakehome'
                        element={<HomePage preferences={preferences} />}
                    />
                    <Route
                        path='/fakesettings'
                        element={
                            <SettingsPage
                                preferences={preferences}
                                setPreferences={setPreferences}
                            />
                        }
                    />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
