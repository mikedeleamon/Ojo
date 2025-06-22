import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import App from './App';
// Mock LoginPage to ensure it includes "Don't have an account"
jest.mock('react-router', () => ({
    BrowserRouter: ({ children }) => (_jsx("div", { children: children })),
    Route: ({ children }) => (_jsx("div", { children: children })),
    Switch: ({ children }) => (_jsx("div", { children: children })),
    useHistory: jest.fn(), // Mock any necessary hooks (e.g., useHistory)
}));
test('renders login page', () => {
    render(_jsx(BrowserRouter, { children: _jsx(App, {}) }));
    const linkElement = screen.getByText(/Don't have an account/i);
    expect(linkElement).toBeInTheDocument();
});
