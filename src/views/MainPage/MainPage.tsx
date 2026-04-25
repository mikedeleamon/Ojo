import { useState, useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../../components/primitives';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import { useSettings } from '../../hooks/useSettings';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import { colors } from '../../theme/tokens';

export default function MainPage() {
  const { settings, settingsReady } = useSettings();
  const [location,    setLocation]   = useState('');
  const [geoLoading,  setGeoLoading] = useState(true);
  const [refreshKey,  setRefreshKey] = useState(0);

  useEffect(() => {
    getCurrentLocation(8000).then(coords => {
      setLocation(coords ? formatCoords(coords.lat, coords.lng) : settings.location);
      setGeoLoading(false);
    });
  }, [settings.location, refreshKey]);

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  if (!settingsReady || geoLoading) return <Loading />;

  return (
    <View style={st.root}>
      <WeatherHUD
        location={location}
        settings={settings}
        refreshKey={refreshKey}
        onRefresh={handleRefresh}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDefault },
});
