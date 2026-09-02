import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    ReactNode,
} from 'react';
import axios from '../api/client';
import { Settings } from '../types';
import { getToken, authHeaders, getErrorMessage } from '../lib/auth';
import { useAuth } from './AuthContext';
import { storage, storageGetJSON } from '../lib/storage';

const CACHE_KEY = 'ojo_settings_cache';

export const defaults: Settings = {
    clothingStyles: ['Casual'],
    location: '',
    temperatureScale: 'Imperial',
    hiTempThreshold: 85,
    lowTempThreshold: 50,
    humidityPreference: 70,
    tripModeEnabled: true,
    tripModeRadiusMi: 30,
};

// Ensures clothingStyles is always present — old server payloads only have
// clothingStyle (string). Converts them so the rest of the app never has to
// guard against the missing field.
const normalize = (s: Settings): Settings => ({
    ...s,
    clothingStyles: s.clothingStyles?.length
        ? s.clothingStyles
        : s.clothingStyle
          ? [s.clothingStyle]
          : ['Casual'],
});

const readCache = async (): Promise<Settings | null> => {
    const data = await storageGetJSON<Partial<Settings>>(
        storage,
        CACHE_KEY,
        {},
    );
    return Object.keys(data).length > 0 ? { ...defaults, ...data } : null;
};

const writeCache = async (s: Settings): Promise<void> => {
    await storage.setItem(CACHE_KEY, JSON.stringify(s));
};

export const clearSettingsCache = async (): Promise<void> => {
    await storage.removeItem(CACHE_KEY);
};

interface SettingsCtx {
    settings: Settings;
    settingsReady: boolean;
    saveSettings: (next: Settings) => Promise<void>;
    refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsCtx>({
    settings: defaults,
    settingsReady: false,
    saveSettings: async () => {},
    refreshSettings: async () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const { isReady, isLoggedIn } = useAuth();
    const [settings, setSettings] = useState<Settings>(defaults);
    const [settingsReady, setSettingsReady] = useState(false);

    // Keep the settings object's identity stable when a revalidation returns
    // the same values. Settings feed effect deps across the app (outfit
    // generation, the widget sync, screen-local form state), so a fresh-but-
    // equal object from every Account-screen focus used to cascade into
    // re-renders and state resets everywhere.
    const applySettings = useCallback((next: Settings) => {
        setSettings((prev) =>
            JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
        );
    }, []);

    // Keyed on the auth state rather than running once on mount, for two
    // reasons. First, this provider never unmounts (it sits above AuthGate), so
    // without a re-run the previous account's settings stayed in memory after a
    // logout/login — clearing the on-disk cache alone would not have dropped
    // them. Second, getToken() reads a cache that initAuthCache() only fills
    // after a SecureStore round-trip; reading it at mount raced that round-trip
    // and, on the common outcome, took the `!token` branch and skipped server
    // revalidation entirely for the whole launch.
    useEffect(() => {
        if (!isReady) return;

        let cancelled = false;

        const init = async () => {
            if (!isLoggedIn) {
                // Signed out: drop to defaults AND drop the on-disk copy. The
                // cache key is global, not per-user like history/trips/weather,
                // so without this the next account to sign in on this device
                // reads the previous user's location, temperature thresholds
                // and gender straight out of it.
                applySettings(defaults);
                setSettingsReady(true);
                await clearSettingsCache();
                return;
            }

            const cached = await readCache();
            if (cached && !cancelled) {
                applySettings(normalize(cached));
                setSettingsReady(true);
            }

            const token = getToken();
            if (!token) {
                if (!cancelled) setSettingsReady(true);
                return;
            }

            try {
                const { data } = await axios.get(
                    '/api/user/settings',
                    authHeaders(),
                );
                const fresh = normalize({ ...defaults, ...(cached ?? {}), ...data });
                if (!cancelled) {
                    applySettings(fresh);
                    setSettingsReady(true);
                }
                await writeCache(fresh);
            } catch (err: unknown) {
                console.warn(
                    '[Ojo] Could not revalidate settings:',
                    getErrorMessage(err),
                );
                if (!cancelled) setSettingsReady(true);
            }
        };

        init();
        return () => {
            cancelled = true;
        };
    }, [isReady, isLoggedIn, applySettings]);

    const saveSettings = useCallback(
        async (next: Settings) => {
            const previous = settings;
            setSettings(next);
            await writeCache(next);

            if (!getToken()) return;

            try {
                await axios.put('/api/user/settings', next, authHeaders());
            } catch (err: unknown) {
                console.error(
                    '[Ojo] Settings save failed — rolling back:',
                    getErrorMessage(err),
                );
                setSettings(previous);
                await writeCache(previous);
                throw err;
            }
        },
        [settings],
    );

    const refreshSettings = useCallback(async () => {
        const cached = await readCache();
        if (cached) applySettings(normalize(cached));

        const token = getToken();
        if (!token) return;

        try {
            const { data } = await axios.get(
                '/api/user/settings',
                authHeaders(),
            );
            const fresh = normalize({ ...defaults, ...(cached ?? {}), ...data });
            applySettings(fresh);
            await writeCache(fresh);
        } catch (err: unknown) {
            console.warn(
                '[Ojo] Could not refresh settings:',
                getErrorMessage(err),
            );
        }
    }, []);

    return (
        <SettingsContext.Provider
            value={{ settings, settingsReady, saveSettings, refreshSettings }}
        >
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
