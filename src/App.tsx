import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';

const App = () => {
    const [loggedIn, setLoggedIn] = useState<boolean>(false);

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
            <AppRoutes
                loggedIn={loggedIn}
                setLoggedIn={setLoggedIn}
            />
        </Router>
    );
};

export default App;
