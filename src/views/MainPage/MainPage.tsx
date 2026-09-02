import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../../components/primitives';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import { useSettings } from '../../hooks/useSettings';
import { useActiveLocation } from '../../context/ActiveLocationContext';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import { getToken } from '../../lib/auth';
import { CURRENT_LOCATION_ID } from '../../lib/savedLocations';
import { getAllSnapshots, setSnapshot } from '../../lib/weatherCache';
import { refreshClosets } from '../../hooks/useClosets';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { ForceDarkPalette } from '../../theme/ThemeContext';
import { darkColors } from '../../theme/tokens';
import type { WeatherSnapshot } from '../../types';

export default function MainPage() {
  const st = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: darkColors.bgDefault },
  }), []);

  const { settings, settingsReady } = useSettings();
  const { activeId, setActiveId } = useActiveLocation();
  const nav = useAppNavigation();

  const [gpsLocation, setGpsLocation] = useState('');
  const [refreshKey,  setRefreshKey]  = useState(0);
  // In-memory mirror of the per-city snapshot cache, so the seed for the active
  // city is available synchronously when switching (no async flash).
  const [snapshots, setSnapshots] = useState<Record<string, WeatherSnapshot>>({});

  const savedLocations = settings.savedLocations ?? [];
  const active = activeId === CURRENT_LOCATION_ID
    ? null
    : savedLocations.find(l => l.id === activeId) ?? null;

  // If the active saved city was deleted elsewhere, fall back to My Location.
  //
  // Gated on settingsReady: `savedLocations` is empty until settings resolve,
  // so before that EVERY saved-city id looks deleted. Now that
  // ActiveLocationContext actually restores a persisted city on launch, an
  // ungated check would race it — reset the restored id to My Location and
  // persist that reset, undoing the restore on every cold start.
  useEffect(() => {
    if (!settingsReady) return;
    if (activeId !== CURRENT_LOCATION_ID && !active) setActiveId(CURRENT_LOCATION_ID);
  }, [settingsReady, activeId, active, setActiveId]);

  // Prime the in-memory snapshot map from cache once on mount.
  useEffect(() => {
    let cancelled = false;
    getAllSnapshots().then(all => { if (!cancelled) setSnapshots(all); });
    return () => { cancelled = true; };
  }, []);

  // Resolve GPS only while My Location is the active destination. Saved cities
  // use their stored query directly (no device location needed).
  //
  // NOT keyed on refreshKey: a pull-to-refresh resolves its own fresh fix in
  // handleRefresh below, sequenced BEFORE refreshKey bumps (see the race this
  // avoids there). This effect covers the other triggers — mount, switching
  // INTO My Location, or the settings fallback changing.
  useEffect(() => {
    if (!settingsReady || activeId !== CURRENT_LOCATION_ID) return;
    // Signed-out users never resolve GPS. AuthGate redirects them to the login
    // screen, but this screen still mounts for a beat behind that redirect —
    // long enough to fire the OS location prompt on top of the sign-in form.
    // iOS grants exactly one such prompt per install, and onboarding now spends
    // it deliberately, with an explanation and a manual city fallback (see
    // OnboardingPage step 2). Spending it here first, on a stranger looking at
    // a password field, is the worst possible moment and cannot be retried.
    if (!getToken()) return;
    getCurrentLocation(8000).then(coords => {
      setGpsLocation(coords ? formatCoords(coords.lat, coords.lng) : settings.location);
    });
  }, [settingsReady, settings.location, activeId]);

  // For saved cities, pass stored coordinates as a "lat,lng" string so
  // geocodeCity skips the CLGeocoder network call entirely (parseLatLng fast
  // path). CLGeocoder can hang or fail in production; stored coords are exact.
  const location = active
    ? `${active.lat},${active.lon}`
    : (gpsLocation || settings.location);
  const seed = snapshots[activeId] ?? null;

  // Pull-to-refresh on Home refetches weather (refreshKey) AND force-refreshes
  // the closet cache, so the outfit suggestion below the fold reflects any
  // wardrobe edits made on another device without waiting for the focus timer.
  //
  // In My Location mode, GPS is re-resolved BEFORE refreshKey bumps. WeatherHUD
  // keys its fetch off [location, refreshKey] — if refreshKey bumped first, it
  // would fire immediately against whatever `gpsLocation` was already in state
  // (the PREVIOUS fix), kicking off a real fetch for stale coordinates. That
  // fetch and the corrected one (triggered once gpsLocation actually updates)
  // then race in WeatherHUD, and on an unlucky response order the stale one
  // resolving last silently overwrites fresh data — while the UI still reads
  // "Just now". Saved cities have no such race: their coords are already known
  // synchronously, so they bump immediately.
  const handleRefresh = useCallback(() => {
    if (activeId === CURRENT_LOCATION_ID) {
      getCurrentLocation(8000).then(coords => {
        setGpsLocation(coords ? formatCoords(coords.lat, coords.lng) : settings.location);
        setRefreshKey(k => k + 1);
      });
    } else {
      setRefreshKey(k => k + 1);
    }
    void refreshClosets();
  }, [activeId, settings.location]);

  // Persist each fresh payload to the cache and the in-memory mirror.
  const handleSnapshot = useCallback((snap: WeatherSnapshot) => {
    setSnapshots(prev => ({ ...prev, [activeId]: snap }));
    setSnapshot(activeId, snap);
  }, [activeId]);

  const openLocations = useCallback(() => nav.push('/account/locations'), [nav]);

  // WeatherHUD owns its loading state via showInlineLoader (default true):
  // a spinning sun sits on the dark gradient while GPS + weather fetch,
  // then fades out (400 ms) as the gradient transitions to the weather colour.
  // The settings gate is kept so WeatherHUD never mounts without a location.
  if (!settingsReady) return <ForceDarkPalette><View style={st.root} /></ForceDarkPalette>;

  return (
    <ForceDarkPalette>
      <View style={st.root}>
        {/* key={activeId} remounts on city switch so each city paints from its
            own synchronous seed (and uncached cities cold-load cleanly). */}
        <WeatherHUD
          key={activeId}
          location={location}
          settings={settings}
          refreshKey={refreshKey}
          onRefresh={handleRefresh}
          seedSnapshot={seed}
          onSnapshot={handleSnapshot}
          onOpenLocations={openLocations}
        />
      </View>
    </ForceDarkPalette>
  );
}
