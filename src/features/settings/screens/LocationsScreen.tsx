import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  PanResponder,
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
import CityAutocomplete from '../components/CityAutocomplete';
import type { CitySuggestion } from '../../../lib/citySearch';
import { hapticSuccess, hapticSelection, hapticWarning } from '../../../lib/haptics';
import {
  CURRENT_LOCATION_ID,
  addLocation,
  removeLocation,
} from '../../../lib/savedLocations';
import { getAllSnapshots } from '../../../lib/weatherCache';
import type { SavedLocation, WeatherSnapshot } from '../../../types';

const SWIPE_ACTION_WIDTH = 80;
const SWIPE_THRESHOLD    = 65; // px left to trigger delete on release

function SwipeableLocationRow({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const translateX        = useRef(new Animated.Value(0)).current;
  const didPassThreshold  = useRef(false);
  const onDeleteRef       = useRef(onDelete);
  onDeleteRef.current     = onDelete;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Only steal the gesture when movement is clearly horizontal-left.
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx < -6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,

      onPanResponderGrant: () => {
        translateX.stopAnimation();
        translateX.setValue(0);
        didPassThreshold.current = false;
      },

      onPanResponderMove: (_, gs) => {
        const next = Math.min(Math.max(gs.dx, -SWIPE_ACTION_WIDTH * 1.6), 0);
        translateX.setValue(next);
        // Haptic tick the moment the full action is revealed.
        if (gs.dx < -SWIPE_THRESHOLD && !didPassThreshold.current) {
          didPassThreshold.current = true;
          hapticSelection();
        }
      },

      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          // Fly the row off to the left then remove.
          hapticWarning();
          Animated.timing(translateX, {
            toValue: -600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onDeleteRef.current());
        } else {
          // Not far enough — snap back.
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  // Delete-action opacity fades in as the row slides left.
  const actionOpacity = translateX.interpolate({
    inputRange: [-SWIPE_ACTION_WIDTH, -20, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });
  // Subtle scale-up on the label as it becomes fully revealed.
  const actionScale = translateX.interpolate({
    inputRange: [-SWIPE_ACTION_WIDTH, -SWIPE_THRESHOLD, 0],
    outputRange: [1, 0.85, 0.7],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ position: 'relative' }}>
      {/* Red delete strip — sits behind the row, revealed as it slides left */}
      <Animated.View
        style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: SWIPE_ACTION_WIDTH,
          borderRadius: radius.sm,
          backgroundColor: 'rgba(239, 68, 68, 0.92)',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: actionOpacity,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Animated.Text
          style={{
            color: '#fff',
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            fontWeight: fontWeights.semibold,
            transform: [{ scale: actionScale }],
          }}
        >
          Delete
        </Animated.Text>
      </Animated.View>

      {/* Row content — translates left on swipe */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

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
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
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
    if (!selectedCity) {
      setStatus({ type: 'error', msg: 'Pick a city from the dropdown.' });
      return;
    }
    setStatus(null);
    setLoading(true);
    try {
      const next = addLocation(
        savedLocations,
        { lat: selectedCity.lat, lon: selectedCity.lon, name: selectedCity.name },
        selectedCity.name,
      );
      if (next.length === savedLocations.length) {
        setStatus({ type: 'error', msg: 'That city is already saved.' });
        return;
      }
      await saveSettings({ ...settings, savedLocations: next });
      setSelectedCity(null);
      setResetSignal(n => n + 1);
      setStatus({ type: 'success', msg: 'City added.' });
      hapticSuccess();
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

    const rowContent = (
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
          </GlassCard>
        </View>
      </Pressable>
    );

    return (
      // Forced dark (like the TripFit HeroBanner) so the glass material and text
      // match dark mode regardless of the app theme.
      <ForceDarkPalette key={id}>
        {loc ? (
          <SwipeableLocationRow onDelete={() => remove(loc.id)}>
            {rowContent}
          </SwipeableLocationRow>
        ) : (
          rowContent
        )}
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
            <Text style={st.hint}>
              Start typing and pick a city from the list.
            </Text>
            <CityAutocomplete
              onSelect={setSelectedCity}
              resetSignal={resetSignal}
              placeholder="Search for a city (e.g. London)"
              accessibilityLabel="City to add"
            />
            <StatusMessage status={status} />
            <Pressable
              style={[st.addBtn, (loading || !selectedCity) && { opacity: 0.5 }]}
              onPress={add}
              disabled={loading || !selectedCity}
              accessibilityRole="button"
              accessibilityLabel={loading ? 'Adding' : 'Add city'}
              accessibilityState={{ busy: loading, disabled: loading || !selectedCity }}
            >
              <Text style={st.addBtnText}>{loading ? 'Adding…' : 'Add city'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
