/**
 * Storage abstraction layer.
 *
 * All persistence in the app goes through these two objects — never call
 * localStorage directly. This makes the React Native migration a single-file
 * swap with zero changes to consuming code.
 *
 * ─── Web (current) ──────────────────────────────────────────────────────────
 *   storage      → localStorage  (general key-value, synchronous wrapped async)
 *   secureStorage → localStorage  (same on web — no secure store needed)
 *
 * ─── React Native (migration) ───────────────────────────────────────────────
 *   Replace this file's implementations:
 *
 *   storage:
 *     import AsyncStorage from '@react-native-async-storage/async-storage';
 *     getItem:    await AsyncStorage.getItem(key)
 *     setItem:    await AsyncStorage.setItem(key, value)
 *     removeItem: await AsyncStorage.removeItem(key)
 *     clear:      await AsyncStorage.clear()
 *
 *   secureStorage (auth tokens):
 *     import * as SecureStore from 'expo-secure-store';
 *     getItem:    await SecureStore.getItemAsync(key)
 *     setItem:    await SecureStore.setItemAsync(key, value)
 *     removeItem: await SecureStore.deleteItemAsync(key)
 *     clear:      (iterate known keys, no bulk clear in SecureStore)
 *
 * All methods are async so call sites are already awaiting — no changes needed
 * when swapping the underlying implementation.
 */

// ─── General storage ──────────────────────────────────────────────────────────
// Use for: settings cache, outfit history, user preferences, onboarding flag

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {}
  },

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch {}
  },
};

// ─── Secure storage ───────────────────────────────────────────────────────────
// Use for: auth token + user object (AUTH_KEY)
// On web this is identical to storage — the distinction matters in RN only,
// where this maps to Keychain (iOS) / Keystore (Android) via expo-secure-store.

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

// ─── Typed helpers ─────────────────────────────────────────────────────────────
// Convenience wrappers for JSON payloads — avoids JSON.parse boilerplate at call sites.

export async function storageGetJSON<T>(
  store: typeof storage | typeof secureStorage,
  key: string,
  fallback: T
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
  value: unknown
): Promise<void> {
  try {
    await store.setItem(key, JSON.stringify(value));
  } catch {}
}
