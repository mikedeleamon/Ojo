import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../../components/primitives';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import { useSettings } from '../../hooks/useSettings';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import { ForceDarkPalette } from '../../theme/ThemeContext';
import { darkColors } from '../../theme/tokens';

export default function MainPage() {
  const st = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: darkColors.bgDefault },
  }), []);

  const { settings, settingsReady } = useSettings();
  const [location,    setLocation]    = useState('');
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [weatherReady, setWeatherReady] = useState(false);

  useEffect(() => {
    if (!settingsReady) return;
    getCurrentLocation(8000).then(coords => {
      setLocation(coords ? formatCoords(coords.lat, coords.lng) : settings.location);
    });
  }, [settingsReady, settings.location, refreshKey]);

  const handleRefresh      = useCallback(() => setRefreshKey(k => k + 1), []);
  const handleWeatherReady = useCallback(() => setWeatherReady(true), []);

  // Single loading gate for the whole home screen. The spinner is mounted on
  // the very first render — before WeatherHUD's heavy gradient/GlassView tree
  // exists — so its native spin loop starts on an idle JS thread and keeps
  // rotating continuously until weather settles. Previously there were two
  // short-lived spinners (this settings gate, then WeatherHUD's own overlay),
  // neither of which lived long enough on a free thread to visibly spin.
  const loading = !settingsReady || !weatherReady;

  return (
    <ForceDarkPalette>
      <View style={st.root}>
        {settingsReady && (
          <WeatherHUD
            location={location || settings.location}
            settings={settings}
            refreshKey={refreshKey}
            onRefresh={handleRefresh}
            onReady={handleWeatherReady}
            showInlineLoader={false}
          />
        )}
        {loading && (
          <View style={StyleSheet.absoluteFill}>
            <Loading />
          </View>
        )}
      </View>
    </ForceDarkPalette>
  );
}
