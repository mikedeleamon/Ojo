/**
 * googleSignIn.ts — client-side helper for Sign in with Google.
 *
 * NATIVE MODULE SETUP REQUIRED:
 * This file is a stub that keeps the app running without the native binary.
 * To activate the Google button:
 *
 *   1. npm install @react-native-google-signin/google-signin
 *   2. Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID + EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env
 *   3. Rebuild the dev client:  npx expo prebuild && npx expo run:ios
 *   4. Uncomment the real implementation in the ACTIVE block below and delete the stub.
 *
 * The button in LoginPage auto-hides until isGoogleSignInAvailable() returns true,
 * so the app works normally with this stub in place.
 */

import axios from '../api/client';
import { AuthState, Settings } from '../types';
import { saveAuth } from './auth';

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export interface GoogleSignInResult    { ok: true; }
export interface GoogleSignInCancelled { ok: false; cancelled: true; }
export interface GoogleSignInError     { ok: false; cancelled: false; error: string; }
export type GoogleSignInOutcome =
  | GoogleSignInResult
  | GoogleSignInCancelled
  | GoogleSignInError;

// ─── STUB (native module not linked) ─────────────────────────────────────────
// Remove this block and uncomment ACTIVE once you have rebuilt the dev client.

export const isGoogleSignInAvailable = (): boolean => true;

export const signInWithGoogle = async (): Promise<GoogleSignInOutcome> => ({
  ok: false,
  cancelled: false,
  error: 'Google sign-in is not available on this build yet.',
});

// ─── ACTIVE (uncomment after npm install + dev-client rebuild) ────────────────
/*
let configured = false;

function getGoogleSignin(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    return null;
  }
}

function ensureConfigured(GoogleSignin: any): void {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: IOS_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export const isGoogleSignInAvailable = (): boolean => {
  if (!IOS_CLIENT_ID && !WEB_CLIENT_ID) return false;
  return getGoogleSignin() != null;
};

export const signInWithGoogle = async (): Promise<GoogleSignInOutcome> => {
  const GoogleSignin = getGoogleSignin();
  if (!GoogleSignin) {
    return { ok: false, cancelled: false, error: 'Google sign-in is unavailable on this build.' };
  }

  try {
    ensureConfigured(GoogleSignin);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (response?.type === 'cancelled') return { ok: false, cancelled: true };

    const idToken: string | undefined = response?.data?.idToken ?? response?.idToken;
    if (!idToken) {
      return { ok: false, cancelled: false, error: 'No identity token returned from Google.' };
    }

    const { data } = await axios.post<AuthState & { settings: Settings }>(
      '/api/auth/google',
      { idToken },
    );
    await saveAuth(data.token, data.user);
    return { ok: true };
  } catch (err: any) {
    const code = err?.code;
    if (code === '-5' || code === '12501' || code === 'SIGN_IN_CANCELLED') {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      cancelled: false,
      error: err?.response?.data?.error ?? err?.message ?? 'Google sign-in failed.',
    };
  }
};
*/
