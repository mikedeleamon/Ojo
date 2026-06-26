import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  Switch,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { View, Text, Pressable, GlassCard } from '../../../components/primitives';
import Loading from '../../../components/Loading/Loading';
import SunnyIcon from '../../../components/WeatherIcons/SunnyIcon';
import { useSpinAnimation } from '../../../hooks/useSpinAnimation';
import { NotificationSettings } from '../../../types';
import {
  NOTIF_DEFAULTS,
  getPermissionStatus,
  requestPermission,
  registerPushToken,
  scheduleWeeklyRecap,
  cancelWeeklyRecap,
  cancelTripPackingReminder,
  TRIP_PACKING_PREF_KEY,
  localHourToUTC,
  utcHourToLocal,
  PermissionStatus,
} from '../../../lib/notifications';
import { storage } from '../../../lib/storage';
import { hapticSuccess } from '../../../lib/haptics';
import axios from '../../../api/client';
import { authHeaders, getErrorMessage } from '../../../lib/auth';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { makeStyles } from './screens.styles';
import { useTheme } from '../../../theme/ThemeContext';
import { ColorTokens } from '../../../theme/tokens';

const HOUR_OPTIONS = [6, 7, 8, 9, 10];
const HOUR_LABEL = (h: number) => {
  const period = h < 12 ? 'am' : 'pm';
  const display = h <= 12 ? h : h - 12;
  return `${display}${period}`;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const makeLocalStyles = (colors: ColorTokens, isDark: boolean) => StyleSheet.create({
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
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
  },
  permBanner: {
    backgroundColor: isDark ? 'rgba(250, 204, 21, 0.08)' : 'rgba(250, 204, 21, 0.18)',
    borderWidth:     1,
    borderColor:     isDark ? 'rgba(250, 204, 21, 0.25)' : 'rgba(180, 130, 0, 0.45)',
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             10,
  },
  permText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      isDark ? 'rgba(253, 224, 71, 0.9)' : '#78350f',
    lineHeight: fontSizes.sm * 1.5,
  },
  permBtn: {
    alignSelf:         'flex-start',
    paddingVertical:   7,
    paddingHorizontal: 14,
    backgroundColor:   isDark ? 'rgba(250, 204, 21, 0.12)' : 'rgba(250, 204, 21, 0.30)',
    borderWidth:       1,
    borderColor:       isDark ? 'rgba(250, 204, 21, 0.30)' : 'rgba(180, 130, 0, 0.55)',
    borderRadius:      radius.pill,
  },
  permBtnText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.medium,
    color:      isDark ? 'rgba(253, 224, 71, 1)' : '#78350f',
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

const Row = ({ children, st }: { children: React.ReactNode; st: ReturnType<typeof makeLocalStyles> }) => (
  <View style={st.row}>{children}</View>
);

const RowLabel = ({ title, subtitle, st }: { title: string; subtitle: string; st: ReturnType<typeof makeLocalStyles> }) => (
  <View style={st.rowLabel}>
    <Text style={st.rowTitle}>{title}</Text>
    <Text style={st.rowSubtitle}>{subtitle}</Text>
  </View>
);

const ChipRow = ({
  options,
  selected,
  onSelect,
  labelFn,
  s,
}: {
  options: number[];
  selected: number;
  onSelect: (v: number) => void;
  labelFn: (v: number) => string;
  s: ReturnType<typeof makeStyles>;
}) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
    {options.map(v => (
      <Pressable
        key={v}
        style={[s.chip, v === selected && s.chipActive]}
        onPress={() => onSelect(v)}
      >
        <Text style={[s.chipText, v === selected && s.chipTextActive]}>
          {labelFn(v)}
        </Text>
      </Pressable>
    ))}
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { colors, isDark } = useTheme();
  const s  = useMemo(() => makeStyles(colors), [colors]);
  const st = useMemo(() => makeLocalStyles(colors, isDark), [colors, isDark]);

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [permission,  setPermission]  = useState<PermissionStatus>('undetermined');
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');
  const [localHour,   setLocalHour]   = useState(7);
  const [ns,          setNs]          = useState<NotificationSettings>(NOTIF_DEFAULTS);
  const savingRotate = useSpinAnimation(1_500);

  const set = useCallback(
    <K extends keyof NotificationSettings>(key: K, val: NotificationSettings[K]) =>
      setNs(prev => ({ ...prev, [key]: val })),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const perm = await getPermissionStatus();
      if (!cancelled) setPermission(perm);
      try {
        const [{ data }, localTripPacking] = await Promise.all([
          axios.get('/api/notifications/settings', authHeaders()),
          storage.getItem(TRIP_PACKING_PREF_KEY),
        ]);
        if (!cancelled) {
          const merged = { ...NOTIF_DEFAULTS, ...data };
          // tripPackingEnabled is stored locally — local value wins if present
          if (localTripPacking !== null) {
            merged.tripPackingEnabled = localTripPacking === 'true';
          }
          setNs(merged);
          setLocalHour(utcHourToLocal(merged.morningBriefHourUTC));
        }
      } catch {
        // Fall back to defaults; still try to read local trip-packing pref
        try {
          const localTripPacking = await storage.getItem(TRIP_PACKING_PREF_KEY);
          if (!cancelled && localTripPacking !== null) {
            setNs(prev => ({ ...prev, tripPackingEnabled: localTripPacking === 'true' }));
          }
        } catch { /* ignore */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleRequestPermission = async () => {
    const status = await requestPermission();
    setPermission(status);
    if (status === 'granted') {
      await registerPushToken();
    } else {
      Alert.alert(
        'Notifications Blocked',
        'Go to Settings → Ojo → Notifications to enable push notifications.',
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const needsToken =
        ns.morningBriefEnabled ||
        ns.weatherChangeEnabled ||
        ns.closetGapEnabled;

      if (needsToken && permission !== 'granted') {
        const status = await requestPermission();
        setPermission(status);
        if (status !== 'granted') {
          setError('Push notification permission is required to enable these alerts.');
          return;
        }
      }
      if (needsToken) await registerPushToken();

      const toSave: NotificationSettings = {
        ...ns,
        morningBriefHourUTC: localHourToUTC(localHour),
      };

      await axios.put('/api/notifications/settings', toSave, authHeaders());

      if (ns.weeklyRecapEnabled) {
        await scheduleWeeklyRecap(ns.weeklyRecapDay);
      } else {
        await cancelWeeklyRecap();
      }

      await storage.setItem(TRIP_PACKING_PREF_KEY, ns.tripPackingEnabled ? 'true' : 'false');
      if (!ns.tripPackingEnabled) {
        await cancelTripPackingReminder();
      }

      setSaved(true);
      hapticSuccess();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save notification settings.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const anyEnabled =
    ns.morningBriefEnabled ||
    ns.weatherChangeEnabled ||
    ns.tempSwingEnabled ||
    ns.closetGapEnabled ||
    ns.weeklyRecapEnabled ||
    ns.tripPackingEnabled;

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={st.content}>

        {permission !== 'granted' && (
          <View style={st.permBanner}>
            <Text style={st.permText}>
              Push notifications are{' '}
              {permission === 'denied' ? 'blocked' : 'not yet enabled'} for Ojo.
            </Text>
            <Pressable style={st.permBtn} onPress={handleRequestPermission}>
              <Text style={st.permBtnText}>
                {permission === 'denied' ? 'Open Settings' : 'Enable Notifications'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={st.section}>
          <Text style={s.sectionLabel}>Daily</Text>

          <GlassCard style={st.card}>
            <Row st={st}>
              <RowLabel st={st}
                title="Morning Outfit Brief"
                subtitle="Daily weather summary and outfit tip sent each morning."
              />
              <Switch
                value={ns.morningBriefEnabled}
                onValueChange={v => set('morningBriefEnabled', v)}
                trackColor={{ false: colors.glassBorder, true: colors.toggleTrackActive }}
                thumbColor={ns.morningBriefEnabled ? colors.toggleThumbActive : colors.textMuted}
              />
            </Row>

            {ns.morningBriefEnabled && (
              <View style={st.subConfig}>
                <Text style={st.subLabel}>Send at</Text>
                <ChipRow s={s}
                  options={HOUR_OPTIONS}
                  selected={localHour}
                  onSelect={setLocalHour}
                  labelFn={HOUR_LABEL}
                />
              </View>
            )}
          </GlassCard>

          <GlassCard style={st.card}>
            <Row st={st}>
              <RowLabel st={st}
                title="Temperature Swing Warning"
                subtitle="Alerts you to dress in layers when the daily swing is large."
              />
              <Switch
                value={ns.tempSwingEnabled}
                onValueChange={v => set('tempSwingEnabled', v)}
                trackColor={{ false: colors.glassBorder, true: colors.toggleTrackActive }}
                thumbColor={ns.tempSwingEnabled ? colors.toggleThumbActive : colors.textMuted}
              />
            </Row>

            {ns.tempSwingEnabled && (
              <View style={st.subConfig}>
                <View style={s.sliderMeta}>
                  <Text style={st.subLabel}>Alert when swing exceeds</Text>
                  <Text style={s.sliderValue}>{ns.tempSwingThresholdF}°F</Text>
                </View>
                <Slider
                  style={{ width: '100%', height: 36 }}
                  minimumValue={10}
                  maximumValue={40}
                  step={5}
                  value={ns.tempSwingThresholdF}
                  onValueChange={v => set('tempSwingThresholdF', v)}
                  minimumTrackTintColor={colors.toggleThumbActive}
                  maximumTrackTintColor={colors.glassBorder}
                  thumbTintColor={colors.toggleThumbActive}
                />
              </View>
            )}
          </GlassCard>
        </View>

        <View style={st.section}>
          <Text style={s.sectionLabel}>Alerts</Text>

          <GlassCard style={st.card}>
            <Row st={st}>
              <RowLabel st={st}
                title="Weather Change Alert"
                subtitle="Notifies you in the afternoon if rain or a cold front moves in unexpectedly."
              />
              <Switch
                value={ns.weatherChangeEnabled}
                onValueChange={v => set('weatherChangeEnabled', v)}
                trackColor={{ false: colors.glassBorder, true: colors.toggleTrackActive }}
                thumbColor={ns.weatherChangeEnabled ? colors.toggleThumbActive : colors.textMuted}
              />
            </Row>
          </GlassCard>

          <GlassCard style={st.card}>
            <Row st={st}>
              <RowLabel st={st}
                title="Closet Gap Nudge"
                subtitle="Suggests adding missing items when your closet lacks gear for the forecast."
              />
              <Switch
                value={ns.closetGapEnabled}
                onValueChange={v => set('closetGapEnabled', v)}
                trackColor={{ false: colors.glassBorder, true: colors.toggleTrackActive }}
                thumbColor={ns.closetGapEnabled ? colors.toggleThumbActive : colors.textMuted}
              />
            </Row>
          </GlassCard>
        </View>

        <View style={st.section}>
          <Text style={s.sectionLabel}>Trips</Text>

          <GlassCard style={st.card}>
            <Row st={st}>
              <RowLabel st={st}
                title="Trip Packing Reminder"
                subtitle="Reminds you to check your TripFit packing list a week out and again 2 days before each trip."
              />
              <Switch
                value={ns.tripPackingEnabled}
                onValueChange={v => set('tripPackingEnabled', v)}
                trackColor={{ false: colors.glassBorder, true: colors.toggleTrackActive }}
                thumbColor={ns.tripPackingEnabled ? colors.toggleThumbActive : colors.textMuted}
              />
            </Row>
          </GlassCard>
        </View>

        <View style={st.section}>
          <Text style={s.sectionLabel}>Weekly</Text>

          <GlassCard style={st.card}>
            <Row st={st}>
              <RowLabel st={st}
                title="Weekly Wardrobe Recap"
                subtitle="A weekly prompt to review your outfit history and discover new combinations."
              />
              <Switch
                value={ns.weeklyRecapEnabled}
                onValueChange={v => set('weeklyRecapEnabled', v)}
                trackColor={{ false: colors.glassBorder, true: colors.toggleTrackActive }}
                thumbColor={ns.weeklyRecapEnabled ? colors.toggleThumbActive : colors.textMuted}
              />
            </Row>

            {ns.weeklyRecapEnabled && (
              <View style={st.subConfig}>
                <Text style={st.subLabel}>Send on</Text>
                <ChipRow s={s}
                  options={[0, 1, 2, 3, 4, 5, 6]}
                  selected={ns.weeklyRecapDay}
                  onSelect={v => set('weeklyRecapDay', v)}
                  labelFn={v => DAY_LABELS[v]}
                />
              </View>
            )}
          </GlassCard>
        </View>

        {error !== '' && (
          <View style={[s.statusMsg, s.error]}>
            <Text style={{ color: colors.errorText, fontFamily: fonts.body, fontSize: 13 }}>
              {error}
            </Text>
          </View>
        )}
        {saved && (
          <View style={[s.statusMsg, s.success]}>
            <Text style={{ color: colors.successText, fontFamily: fonts.body, fontSize: 13 }}>
              Notification settings saved.
            </Text>
          </View>
        )}

        <Pressable
          style={[s.saveBtn, (saving || !anyEnabled) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <Animated.View style={{ width: 20, height: 20, transform: [{ rotate: savingRotate }] }}>
                <SunnyIcon size={20} />
              </Animated.View>
            : <Text style={s.saveBtnText}>Save Changes</Text>
          }
        </Pressable>

        <Text style={[s.hint, { textAlign: 'center' }]}>
          Morning Brief and Alerts require a push notification permission.{'\n'}
          Weekly Recap is scheduled locally on your device.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}
