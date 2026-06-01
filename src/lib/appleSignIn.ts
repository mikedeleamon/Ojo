/**
 * appleSignIn.ts — client-side helper for Sign in with Apple.
 *
 * Wraps expo-apple-authentication so callers don't need to remember the
 * requestedScopes, error codes, or server endpoint. Returns the saved auth
 * state on success or null if the user cancelled.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import axios from '../api/client';
import { AuthState, Settings } from '../types';
import { saveAuth } from './auth';

export const isAppleSignInAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};

export interface AppleSignInResult {
  ok: true;
}

export interface AppleSignInCancelled {
  ok: false;
  cancelled: true;
}

export interface AppleSignInError {
  ok: false;
  cancelled: false;
  error: string;
}

export type AppleSignInOutcome = AppleSignInResult | AppleSignInCancelled | AppleSignInError;

/**
 * Trigger the native Sign in with Apple sheet. On success, posts the
 * identity token to /api/auth/apple and persists the returned JWT via
 * saveAuth(). Caller should then invoke their `onLogin()` to flip the
 * AuthContext.
 */
export const signInWithApple = async (): Promise<AppleSignInOutcome> => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { ok: false, cancelled: false, error: 'No identity token returned from Apple.' };
    }

    const { data } = await axios.post<AuthState & { settings: Settings }>(
      '/api/auth/apple',
      {
        identityToken: credential.identityToken,
        fullName: credential.fullName
          ? {
              givenName:  credential.fullName.givenName  ?? '',
              familyName: credential.fullName.familyName ?? '',
            }
          : undefined,
      },
    );

    await saveAuth(data.token, data.user);
    return { ok: true };
  } catch (err: any) {
    // ERR_REQUEST_CANCELED is fired when the user dismisses the sheet
    if (err?.code === 'ERR_REQUEST_CANCELED') {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      cancelled: false,
      error: err?.response?.data?.error ?? err?.message ?? 'Apple sign-in failed.',
    };
  }
};
