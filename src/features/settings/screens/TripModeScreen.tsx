import { useMemo, useState } from 'react';
import { StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable, GlassCard } from '../../../components/primitives';
import { useSettings } from '../../../hooks/useSettings';
import { DEFAULT_TRIP_MODE_RADIUS_MI } from '../../../lib/tripMode';
import { makeStyles } from './screens.styles';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import { ColorTokens } from '../../../theme/tokens';

const RADIUS_OPTIONS = [15, 30, 60, 100];

const makeLocalStyles = (colors: ColorTokens) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgDefault },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  card: {
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.md,
    paddingVertical:   14,
    paddingHorizontal: spacing.md,
    gap:             12,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:             spacing.sm,
  },
  rowLabel: { flex: 1, gap: 3 },
  rowTitle: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.medium,
    color:      colors.textPrimary,
  },
  rowSubtitle: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm - 1,
    color:      colors.textMuted,
    lineHeight: (fontSizes.sm - 1) * 1.55,
  },
  subConfig: { gap: 8, paddingTop: 4 },
  subLabel: {
    fontFamily:    fonts.body,
    fontSize:      fontSizes.xs,
    fontWeight:    fontWeights.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color:         colors.textMuted,
  },
});

export default function TripModeScreen() {
  const { colors } = useTheme();
  const s  = useMemo(() => makeStyles(colors), [colors]);
  const st = useMemo(() => makeLocalStyles(colors), [colors]);
  const { settings, saveSettings } = useSettings();

  const enabled = settings.tripModeEnabled !== false;
  const radiusMi = settings.tripModeRadiusMi ?? DEFAULT_TRIP_MODE_RADIUS_MI;
  const [error, setError] = useState('');

  const save = async (patch: Partial<typeof settings>) => {
    setError('');
    try {
      await saveSettings({ ...settings, ...patch });
    } catch {
      setError('Could not save. Check your connection and try again.');
    }
  };

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.section}>
          <Text style={s.sectionLabel}>Trip Mode</Text>

          <GlassCard style={st.card}>
            <View style={st.row}>
              <View style={st.rowLabel}>
                <Text style={st.rowTitle}>Enable Trip Mode</Text>
                <Text style={st.rowSubtitle}>
                  When you're in a city during one of your saved trips, your home
                  screen surfaces the outfit you planned for that day.
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={v => save({ tripModeEnabled: v })}
                trackColor={{ false: colors.glassBorder, true: colors.toggleTrackActive }}
                thumbColor={enabled ? colors.toggleThumbActive : colors.textMuted}
              />
            </View>

            {enabled && (
              <View style={st.subConfig}>
                <Text style={st.subLabel}>Trigger within</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {RADIUS_OPTIONS.map(v => (
                    <Pressable
                      key={v}
                      style={[s.chip, v === radiusMi && s.chipActive]}
                      onPress={() => save({ tripModeRadiusMi: v })}
                    >
                      <Text style={[s.chipText, v === radiusMi && s.chipTextActive]}>
                        {v} mi
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </GlassCard>

          <Text style={s.hint}>
            Trip Mode reads your location once when the app opens to check whether
            you're near a trip city. If location is unavailable, it still shows a
            date-only reminder for trips happening today.
          </Text>

          {error !== '' && (
            <View style={[s.statusMsg, s.error]}>
              <Text style={{ color: colors.errorText, fontFamily: fonts.body, fontSize: 13 }}>
                {error}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
