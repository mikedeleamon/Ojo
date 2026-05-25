import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../../components/primitives';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import { useSettings } from '../../hooks/useSettings';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import { useTheme } from '../../theme/ThemeContext';

export default function MainPage() {
  const { colors } = useTheme();
  const st = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDefault },
  }), [colors]);

  const { settings, settingsReady } = useSettings();
  const [location,   setLocation]  = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!settingsReady) return;
    getCurrentLocation(8000).then(coords => {
      setLocation(coords ? formatCoords(coords.lat, coords.lng) : settings.location);
    });
  }, [settingsReady, settings.location, refreshKey]);

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Block only on settings (fast AsyncStorage read). WeatherHUD owns its own
  // loading state — showing a second outer spinner causes a position jerk on
  // mount and adds unnecessary latency while GPS resolves (up to 8 s).
  if (!settingsReady) return <Loading />;

  return (
    <View style={st.root}>
      <WeatherHUD
        location={location || settings.location}
        settings={settings}
        refreshKey={refreshKey}
        onRefresh={handleRefresh}
      />
    </View>
  );
}
