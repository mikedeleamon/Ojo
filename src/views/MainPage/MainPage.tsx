import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable, GlassCard } from '../../components/primitives';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import { getPermissionStatus, requestPermission } from '../../lib/notifications';
import { useSettings } from '../../hooks/useSettings';
import { useActiveLocation } from '../../context/ActiveLocationContext';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import { CURRENT_LOCATION_ID } from '../../lib/savedLocations';
import { getAllSnapshots, setSnapshot } from '../../lib/weatherCache';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { ForceDarkPalette } from '../../theme/ThemeContext';
import { darkColors, spacing, radius, fonts, fontSizes } from '../../theme/tokens';
import type { WeatherSnapshot } from '../../types';

const notifBannerStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  body: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: darkColors.textSecondary,
    lineHeight: fontSizes.sm * 1.5,
  },
  enableBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: darkColors.saveBtnBg,
    borderRadius: radius.pill,
  },
  enableText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontWeight: '600' as const,
    color: darkColors.saveBtnText,
  },
  dismissBtn: { padding: 6 },
  dismissText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: darkColors.textMuted,
  },
});

export default function MainPage() {
  const st = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: darkColors.bgDefault },
  }), []);

  const { settings, settingsReady } = useSettings();
  const { activeId, setActiveId } = useActiveLocation();
  const nav = useAppNavigation();

  const [gpsLocation, setGpsLocation] = useState('');
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [weatherReady,         setWeatherReady]         = useState(false);
  const [notifStatus,          setNotifStatus]          = useState<'undetermined' | 'granted' | 'denied' | null>(null);
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);
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

  // After weather loads for the first time, check notification permission. If
  // still undetermined, show a contextual nudge instead of asking on cold open.
  useEffect(() => {
    if (!weatherReady) return;
    let cancelled = false;
    getPermissionStatus().then(status => {
      if (!cancelled) setNotifStatus(status);
    });
    return () => { cancelled = true; };
  }, [weatherReady]);

  const handleNotifEnable = useCallback(async () => {
    const status = await requestPermission();
    setNotifStatus(status);
    setNotifBannerDismissed(true);
  }, []);

  // WeatherHUD owns its loading state via showInlineLoader (default true):
  // a spinning sun sits on the dark gradient while GPS + weather fetch,
  // then fades out (400 ms) as the gradient transitions to the weather colour.
  // The settings gate is kept so WeatherHUD never mounts without a location.
  if (!settingsReady) return <ForceDarkPalette><View style={st.root} /></ForceDarkPalette>;

  const showNotifBanner = weatherReady && notifStatus === 'undetermined' && !notifBannerDismissed;

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
          onReady={() => setWeatherReady(true)}
          seedSnapshot={seed}
          onSnapshot={handleSnapshot}
          onOpenLocations={openLocations}
        />

        {/* Contextual notification nudge — shown only after weather loads */}
        {showNotifBanner && (
          <View style={notifBannerStyles.wrap} pointerEvents="box-none">
            <GlassCard style={notifBannerStyles.card}>
              <Text style={notifBannerStyles.body}>
                Get your morning outfit brief delivered daily.
              </Text>
              <Pressable
                style={notifBannerStyles.enableBtn}
                onPress={handleNotifEnable}
                accessibilityRole="button"
                accessibilityLabel="Enable notifications"
              >
                <Text style={notifBannerStyles.enableText}>Enable</Text>
              </Pressable>
              <Pressable
                style={notifBannerStyles.dismissBtn}
                onPress={() => setNotifBannerDismissed(true)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification prompt"
              >
                <Text style={notifBannerStyles.dismissText}>✕</Text>
              </Pressable>
            </GlassCard>
          </View>
        )}
      </View>
    </ForceDarkPalette>
  );
}
