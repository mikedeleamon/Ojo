import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../../components/primitives';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import { useSettings } from '../../hooks/useSettings';
import { useActiveLocation } from '../../context/ActiveLocationContext';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import { CURRENT_LOCATION_ID } from '../../lib/savedLocations';
import { getAllSnapshots, setSnapshot } from '../../lib/weatherCache';
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
  useEffect(() => {
    if (activeId !== CURRENT_LOCATION_ID && !active) setActiveId(CURRENT_LOCATION_ID);
  }, [activeId, active, setActiveId]);

  // Prime the in-memory snapshot map from cache once on mount.
  useEffect(() => {
    let cancelled = false;
    getAllSnapshots().then(all => { if (!cancelled) setSnapshots(all); });
    return () => { cancelled = true; };
  }, []);

  // Resolve GPS only while My Location is the active destination. Saved cities
  // use their stored query directly (no device location needed).
  useEffect(() => {
    if (!settingsReady || activeId !== CURRENT_LOCATION_ID) return;
    getCurrentLocation(8000).then(coords => {
      setGpsLocation(coords ? formatCoords(coords.lat, coords.lng) : settings.location);
    });
  }, [settingsReady, settings.location, activeId, refreshKey]);

  const location = active ? active.query : (gpsLocation || settings.location);
  const seed = snapshots[activeId] ?? null;

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

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
