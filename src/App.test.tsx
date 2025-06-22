import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Mock child components to isolate App test
jest.mock('./routes/AppRoutes', () => (props: any) => {
    return (
        <div data-testid='app-routes'>
            loggedIn: {props.loggedIn ? 'true' : 'false'}
        </div>
    );
});

jest.mock('./pages/HomePage', () => (props: any) => (
    <div data-testid='home-page'>
        Cold threshold: {props.preferences.coldThreshold}
    </div>
));

jest.mock('./pages/SettingsPage', () => (props: any) => (
    <div data-testid='settings-page'>
        Warm threshold: {props.preferences.warmThreshold}
    </div>
));

describe('App component', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('renders AppRoutes and initial preferences', () => {
        render(<App />);

        // AppRoutes should initially show loggedIn: false
        const appRoutes = screen.getByTestId('app-routes');
        expect(appRoutes).toHaveTextContent('loggedIn: false');
    });

    test('loggedIn state remains false after 2 seconds', async () => {
        render(<App />);

        // Fast-forward 2 seconds
        jest.advanceTimersByTime(2000);

        // Wait for possible re-renders
        await waitFor(() => {
            const appRoutes = screen.getByTestId('app-routes');
            expect(appRoutes).toHaveTextContent('loggedIn: false');
        });
    });
});
