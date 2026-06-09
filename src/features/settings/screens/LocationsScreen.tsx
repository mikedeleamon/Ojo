import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, Pressable, GlassCard } from '../../../components/primitives';
import { StatusMessage } from '../../../components/shared';
import type { SubmitStatus } from '../../../hooks/useFormSubmit';
import WeatherIconDisplay from '../../../components/WeatherIconDisplay/WeatherIconDisplay';
import { gradientFor } from '../../../components/WeatherHUD/weatherPalette';
import { useSettings } from '../../../hooks/useSettings';
import { useActiveLocation } from '../../../context/ActiveLocationContext';
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import {
  spacing,
  radius,
  fonts,
  fontSizes,
  fontWeights,
  darkColors,
} from '../../../theme/tokens';
import { useTheme, ForceDarkPalette } from '../../../theme/ThemeContext';
import { geocodeCity } from '../../../lib/geocoding';
import {
  CURRENT_LOCATION_ID,
  addLocation,
  removeLocation,
} from '../../../lib/savedLocations';
import { getAllSnapshots } from '../../../lib/weatherCache';
import type { SavedLocation, WeatherSnapshot } from '../../../types';

function LocationSubText({ summary, style }: { summary: string | null; style: object }) {
  const opacity = useRef(new Animated.Value(summary ? 1 : 0.5)).current;

  useEffect(() => {
    if (summary) {
      opacity.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.75, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [summary]);

  return (
    <Animated.Text style={[style, { opacity }]}>
      {summary ?? '· · ·'}
    </Animated.Text>
  );
}

export default function LocationsScreen() {
  const { colors } = useTheme();
  const st = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bgDefault },
        content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
        section: { gap: spacing.sm },
        sectionLabel: {
          fontFamily: fonts.body,
          fontSize: fontSizes.xs,
          fontWeight: fontWeights.medium,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        hint: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.textMuted,
          lineHeight: fontSizes.sm * 1.6,
        },
        // Tiles are forced to the dark palette (see renderRow) so they read well
        // over the vibrant weather gradient — text colors are applied inline
        // from darkColors rather than baked into these structural styles.
        rowWrap: { borderRadius: radius.sm, overflow: 'hidden' },
        rowActive: { borderWidth: 1.5, borderColor: darkColors.textPrimary },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
        },
        rowMain: { flex: 1, gap: 2 },
        rowName: {
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
          fontWeight: fontWeights.semibold,
        },
        rowSub: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
        },
        activeTag: {
          fontFamily: fonts.body,
          fontSize: fontSizes.xs,
          fontWeight: fontWeights.medium,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        deleteBtn: { padding: 8, marginRight: -8 },
        deleteText: { fontFamily: fonts.body, fontSize: fontSizes.sm },
        input: {
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
          color: colors.textPrimary,
          backgroundColor: colors.glassBg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.sm,
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
        },
        addBtn: {
          paddingVertical: 14,
          backgroundColor: colors.saveBtnBg,
          borderRadius: radius.sm,
          alignItems: 'center',
        },
        addBtnText: {
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
          fontWeight: fontWeights.semibold,
          color: colors.saveBtnText,
        },
      }),
    [colors],
  );

  const { settings, saveSettings } = useSettings();
  const { activeId, setActiveId } = useActiveLocation();
  const nav = useAppNavigation();

  const savedLocations = settings.savedLocations ?? [];
  const isMetric = settings.temperatureScale === 'Metric';

  const [snapshots, setSnapshots] = useState<Record<string, WeatherSnapshot>>({});
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<SubmitStatus>(null);
  const [loading, setLoading] = useState(false);

  // Refresh the cached mini-summaries whenever the screen is focused.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getAllSnapshots().then(all => { if (!cancelled) setSnapshots(all); });
      return () => { cancelled = true; };
    }, []),
  );

  const summaryFor = (id: string): string | null => {
    const snap = snapshots[id];
    if (!snap) return null;
    const t = isMetric
      ? snap.weather.Temperature.Metric.Value
      : snap.weather.Temperature.Imperial.Value;
    const unit = isMetric ? 'C' : 'F';
    return `${Math.round(t)}°${unit}`;
  };

  const select = (id: string) => {
    setActiveId(id);
    nav.goBack();
  };

  const add = async () => {
    const q = city.trim();
    if (!q) { setStatus({ type: 'error', msg: 'Enter a city name.' }); return; }
    setStatus(null);
    setLoading(true);
    try {
      const coords = await geocodeCity(q);
      if (!coords) {
        setStatus({ type: 'error', msg: 'City not found. Check the name.' });
        return;
      }
      const next = addLocation(savedLocations, coords, q);
      if (next.length === savedLocations.length) {
        setStatus({ type: 'error', msg: 'That city is already saved.' });
        return;
      }
      await saveSettings({ ...settings, savedLocations: next });
      setCity('');
      setStatus({ type: 'success', msg: 'City added.' });
    } catch {
      setStatus({ type: 'error', msg: 'Could not add that city.' });
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    const next = removeLocation(savedLocations, id);
    if (activeId === id) setActiveId(CURRENT_LOCATION_ID);
    await saveSettings({ ...settings, savedLocations: next });
  };

  const renderRow = (
    id: string,
    name: string,
    loc?: SavedLocation,
  ) => {
    const summary = summaryFor(id);
    const snap = snapshots[id];
    // Vibrant gradient for the city's condition; a flat dark base when there's
    // no cached weather yet so the glass + light text still read cleanly.
    const grad = (
      snap
        ? gradientFor(snap.weather.WeatherText, snap.weather.IsDayTime)
        : [darkColors.bgDefault, darkColors.bgDefault, darkColors.bgDefault]
    ) as [string, string, ...string[]];

    return (
      // Forced dark (like the TripFit HeroBanner) so the glass material and text
      // match dark mode regardless of the app theme.
      <ForceDarkPalette key={id}>
        <Pressable
          onPress={() => select(id)}
          accessibilityRole="button"
          accessibilityLabel={`Show weather for ${name}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <View style={[st.rowWrap, id === activeId && st.rowActive]}>
            <LinearGradient
              colors={grad}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <GlassCard glassStyle="regular" style={st.row}>
              <View style={st.rowMain}>
                <Text style={[st.rowName, { color: darkColors.textPrimary }]}>
                  {name}
                </Text>
                <LocationSubText
                  summary={summary}
                  style={[st.rowSub, { color: darkColors.textMuted }]}
                />
              </View>
              {id === activeId && (
                <Text style={[st.activeTag, { color: darkColors.textSecondary }]}>
                  Active
                </Text>
              )}
              {snap && (
                <WeatherIconDisplay
                  condition={snap.weather.WeatherText}
                  isDay={snap.weather.IsDayTime}
                  size="small"
                />
              )}
              {loc && (
                <Pressable
                  onPress={() => remove(loc.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${name}`}
                  style={st.deleteBtn}
                >
                  <Text style={[st.deleteText, { color: darkColors.textMuted }]}>
                    Remove
                  </Text>
                </Pressable>
              )}
            </GlassCard>
          </View>
        </Pressable>
      </ForceDarkPalette>
    );
  };

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.section}>
            <Text style={st.sectionLabel}>Destinations</Text>
            <Text style={st.hint}>
              Tap a place to show its weather on the main screen. "My Location"
              uses your device's current position.
            </Text>
            {renderRow(CURRENT_LOCATION_ID, 'My Location')}
            {savedLocations.map(l => renderRow(l.id, l.name, l))}
          </View>

          <View style={st.section}>
            <Text style={st.sectionLabel}>Add a city</Text>
            <TextInput
              style={st.input}
              placeholder="City name (e.g. London)"
              placeholderTextColor={colors.textMuted}
              value={city}
              onChangeText={setCity}
              returnKeyType="done"
              onSubmitEditing={add}
              accessibilityLabel="City to add"
            />
            <StatusMessage status={status} />
            <Pressable
              style={[st.addBtn, loading && { opacity: 0.5 }]}
              onPress={add}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={loading ? 'Adding' : 'Add city'}
              accessibilityState={{ busy: loading, disabled: loading }}
            >
              <Text style={st.addBtnText}>{loading ? 'Adding…' : 'Add city'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
