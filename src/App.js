import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';

function App() {
    const [loggedIn, setLoggedIn] = useState(false);

    useEffect(() => {
        // Simulating login logic
        setTimeout(() => {
            setLoggedIn(false);
        }, 2000);
    }, []);

    return (
        <Router>
            <AppRoutes loggedIn={loggedIn} setLoggedIn={setLoggedIn}/>
        </Router>
    );
}

export default App;
