import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from './LoginPage';

// Mock react-router-dom's useNavigate hook
const mockedNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockedNavigate,
}));

describe('LoginPage', () => {
    let setLoggedInMock: jest.Mock;

    beforeEach(() => {
        setLoggedInMock = jest.fn();
        mockedNavigate.mockReset();
    });

    test('renders email and password inputs and buttons', () => {
        render(<LoginPage setLoggedIn={setLoggedInMock} />);

        expect(screen.getByPlaceholderText(/Username/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Password/i)).toBeInTheDocument();

        expect(
            screen.getByRole('button', { name: /submit/i })
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Don't have an account\?/i)
        ).toBeInTheDocument();
        expect(screen.getByText(/Sign Up/i)).toBeInTheDocument();
    });

    test('clicking Submit calls setLoggedIn(true) and navigates to "/"', () => {
        render(<LoginPage setLoggedIn={setLoggedInMock} />);

        const submitButton = screen.getByRole('button', { name: /submit/i });
        fireEvent.click(submitButton);

        expect(setLoggedInMock).toHaveBeenCalledWith(true);
        expect(mockedNavigate).toHaveBeenCalledWith('/');
    });

    test('clicking Sign Up link navigates to "/signup"', () => {
        render(<LoginPage setLoggedIn={setLoggedInMock} />);

        const signUpLink = screen.getByText(/Sign Up/i);
        fireEvent.click(signUpLink);

        expect(mockedNavigate).toHaveBeenCalledWith('/signup');
        expect(setLoggedInMock).not.toHaveBeenCalled();
    });
});
