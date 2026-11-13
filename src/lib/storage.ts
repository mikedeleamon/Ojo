/**
 * Storage abstraction layer — React Native implementation.
 * Replaces the web version (localStorage) with AsyncStorage + expo-secure-store.
 * All consuming code is unchanged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ─── General storage ──────────────────────────────────────────────────────────
// Use for: settings cache, outfit history, user preferences, onboarding flag

export const storage = {
  getItem:    (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  setItem:    (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
  removeItem: (key: string): Promise<void> => AsyncStorage.removeItem(key),
  clear:      (): Promise<void> => AsyncStorage.clear(),
};

// ─── Secure storage ───────────────────────────────────────────────────────────
// Use for: auth token + user object (AUTH_KEY)
// Maps to Keychain (iOS) / Keystore (Android) via expo-secure-store.
// SecureStore has no bulk clear — callers must removeItem(AUTH_KEY) explicitly.

//
// Written with AFTER_FIRST_UNLOCK rather than the WHEN_UNLOCKED default: the
// background refresh (lib/background) runs while the phone is locked — that is
// most of the time iOS grants it — and with WHEN_UNLOCKED the keychain refuses
// the read, so it would see no session and do nothing. AFTER_FIRST_UNLOCK is
// still encrypted at rest until the first unlock after a restart. Items written
// before this change keep their old setting until rewritten; see
// migrateAuthKeychainAccess in lib/auth.ts.
const SECURE_WRITE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureStorage = {
  getItem:    (key: string): Promise<string | null> => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string): Promise<void> =>
    SecureStore.setItemAsync(key, value, SECURE_WRITE_OPTIONS),
  removeItem: (key: string): Promise<void> => SecureStore.deleteItemAsync(key),
};

// ─── Typed helpers ─────────────────────────────────────────────────────────────

export async function storageGetJSON<T>(
  store: typeof storage | typeof secureStorage,
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await store.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function storageSetJSON(
  store: typeof storage | typeof secureStorage,
  key: string,
  value: unknown,
): Promise<void> {
  try {
    await store.setItem(key, JSON.stringify(value));
  } catch {}
}
