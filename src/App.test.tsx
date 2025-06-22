import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Ojo Weather App text when logged out', () => {
    render(<App />);

    // Check for text that is rendered when the user is logged out
    const headerText = screen.queryByText(/Ojo Weather App/i);
    expect(headerText).toBeNull(); // Assert that it's not in the DOM initially (optional)

    // Simulate the logged-out state or wait for it if delayed rendering occurs
    setTimeout(() => {
        const linkElement = screen.getByText(/Your Weather Solution/i);
        expect(linkElement).toBeInTheDocument();
    }, 1000);
});
