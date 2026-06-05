import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../../components/primitives';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import { useSettings } from '../../hooks/useSettings';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import { ForceDarkPalette } from '../../theme/ThemeContext';
import { darkColors } from '../../theme/tokens';

export default function MainPage() {
  const st = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: darkColors.bgDefault },
  }), []);

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

  // WeatherHUD owns its loading state via showInlineLoader (default true):
  // a spinning sun sits on the dark gradient while GPS + weather fetch,
  // then fades out (400 ms) as the gradient transitions to the weather colour.
  // The settings gate is kept so WeatherHUD never mounts without a location.
  if (!settingsReady) return <ForceDarkPalette><View style={st.root} /></ForceDarkPalette>;

  return (
    <ForceDarkPalette>
      <View style={st.root}>
        <WeatherHUD
          location={location || settings.location}
          settings={settings}
          refreshKey={refreshKey}
          onRefresh={handleRefresh}
        />
      </View>
    </ForceDarkPalette>
  );
}
