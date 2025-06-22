import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router } from 'react-router';
import AppRoutes from './routes/AppRoutes';
const App = () => {
    const [loggedIn, setLoggedIn] = useState(false);
    useEffect(() => {
        //TODO make fake users
        //TODO add some login logic after creating a User account
        // Simulating login logic
        setTimeout(() => {
            setLoggedIn(false);
        }, 2000);
    }, []);
    return (_jsx(Router, { children: _jsx(AppRoutes, { loggedIn: loggedIn, setLoggedIn: setLoggedIn }) }));
};
export default App;
