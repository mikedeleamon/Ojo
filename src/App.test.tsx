import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Mock LoginPage to ensure it includes "Don't have an account"
jest.mock('react-router-dom', () => ({
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ), // Mock BrowserRouter
    Route: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ), // Mock Route
    Switch: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ), // Mock Switch
    useHistory: jest.fn(), // Mock any necessary hooks (e.g., useHistory)
}));

test('renders login page', () => {
    render(
        <BrowserRouter>
            <App />
        </BrowserRouter>
    );
    const linkElement = screen.getByText(/Don't have an account/i);
    expect(linkElement).toBeInTheDocument();
});
