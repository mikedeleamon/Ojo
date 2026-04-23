import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('./routes/AppRoutes', () => (props: { loggedIn: boolean }) => (
  <div data-testid="app-routes">
    loggedIn:{props.loggedIn ? 'true' : 'false'}
  </div>
));

jest.mock('./components/BottomNav/BottomNav', () => () => (
  <nav data-testid="bottom-nav" />
));

// useSettings is async — return safe defaults synchronously so App renders
jest.mock('./hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      clothingStyle: 'Casual',
      location: '',
      temperatureScale: 'Imperial',
      hiTempThreshold: 85,
      lowTempThreshold: 50,
      humidityPreference: 70,
    },
    settingsReady: true,
    saveSettings: jest.fn(),
  }),
  clearSettingsCache: jest.fn(),
}));

// Prevent real localStorage reads during tests
jest.mock('./lib/auth', () => ({
  AUTH_KEY:        'ojo_auth',
  getToken:        jest.fn(() => null),
  getTokenAsync:   jest.fn(async () => null),
  auth:            jest.fn(() => ({})),
  authHeaders:     jest.fn(() => ({})),
  saveAuth:        jest.fn(),
  updateAuthUser:  jest.fn(),
  clearAuth:       jest.fn(),
  getErrorMessage: jest.fn((_err: unknown, fb = 'Error') => fb),
}));

jest.mock('./lib/storage', () => ({
  storage: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(),
    removeItem: jest.fn(),
    clear:      jest.fn(),
  },
  secureStorage: {
    getItem:    jest.fn(async () => null),
    setItem:    jest.fn(),
    removeItem: jest.fn(),
  },
  storageGetJSON: jest.fn(async (_s: unknown, _k: string, fb: unknown) => fb),
  storageSetJSON: jest.fn(),
}));

jest.mock('./helpers/cookieUtils', () => ({
  clearCookiesIfOversized: jest.fn(),
  detectOversizedCookies:  jest.fn(() => null),
  clearAllCookies:         jest.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('App', () => {
  it('renders AppRoutes with loggedIn:false when no token is stored', () => {
    render(<App />);
    expect(screen.getByTestId('app-routes')).toHaveTextContent('loggedIn:false');
  });

  it('does not render BottomNav when logged out', () => {
    render(<App />);
    expect(screen.queryByTestId('bottom-nav')).toBeNull();
  });
});
