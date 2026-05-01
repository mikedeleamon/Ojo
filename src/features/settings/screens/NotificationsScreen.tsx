import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { View, Text, Pressable } from '../../../components/primitives';
import { NotificationSettings } from '../../../types';
import {
  NOTIF_DEFAULTS,
  getPermissionStatus,
  requestPermission,
  registerPushToken,
  scheduleWeeklyRecap,
  cancelWeeklyRecap,
  localHourToUTC,
  utcHourToLocal,
  PermissionStatus,
} from '../../../lib/notifications';
import axios from '../../../api/client';
import { authHeaders, getErrorMessage } from '../../../lib/auth';
import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { styles as s } from './screens.styles';

const STORAGE_KEY = 'ojo_notification_settings';

// ─── Hour options shown to the user (local time) ─────────────────────────────
const HOUR_OPTIONS = [6, 7, 8, 9, 10];
const HOUR_LABEL = (h: number) => {
  const period = h < 12 ? 'am' : 'pm';
  const display = h <= 12 ? h : h - 12;
  return `${display}${period}`;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Sub-components ───────────────────────────────────────────────────────────

const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={st.row}>{children}</View>
);

const RowLabel = ({ title, subtitle }: { title: string; subtitle: string }) => (
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
}: {
  options: number[];
  selected: number;
  onSelect: (v: number) => void;
  labelFn: (v: number) => string;
}) => (
  <View style={st.chipRow}>
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
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [permission,  setPermission]  = useState<PermissionStatus>('undetermined');
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');

  // Local display hour (0–23). Converted to/from UTC when loading/saving.
  const [localHour, setLocalHour] = useState(7);

  const [ns, setNs] = useState<NotificationSettings>(NOTIF_DEFAULTS);

  const set = useCallback(
    <K extends keyof NotificationSettings>(key: K, val: NotificationSettings[K]) =>
      setNs(prev => ({ ...prev, [key]: val })),
    [],
  );

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const perm = await getPermissionStatus();
      if (!cancelled) setPermission(perm);

      try {
        const { data } = await axios.get('/api/notifications/settings', authHeaders());
        if (!cancelled) {
          const merged = { ...NOTIF_DEFAULTS, ...data };
          setNs(merged);
          setLocalHour(utcHourToLocal(merged.morningBriefHourUTC));
        }
      } catch {
        // Fall back to defaults — server may not have settings yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Permission request ──────────────────────────────────────────────────────

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

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      // Ensure push token is registered if any server notification is enabled
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

      // Prepare settings with UTC hour
      const toSave: NotificationSettings = {
        ...ns,
        morningBriefHourUTC: localHourToUTC(localHour),
      };

      await axios.put('/api/notifications/settings', toSave, authHeaders());

      // Handle local weekly recap scheduling
      if (ns.weeklyRecapEnabled) {
        await scheduleWeeklyRecap(ns.weeklyRecapDay);
      } else {
        await cancelWeeklyRecap();
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save notification settings.'));
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={st.root} edges={['bottom']}>
        <View style={st.center}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </SafeAreaView>
    );
  }

  const anyEnabled =
    ns.morningBriefEnabled ||
    ns.weatherChangeEnabled ||
    ns.tempSwingEnabled ||
    ns.closetGapEnabled ||
    ns.weeklyRecapEnabled;

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={st.content}>

        {/* ── Permission banner ─────────────────────────────────────────── */}
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

        {/* ── Morning Outfit Brief ──────────────────────────────────────── */}
        <View style={st.section}>
          <Text style={s.sectionLabel}>Daily</Text>

          <View style={st.card}>
            <Row>
              <RowLabel
                title="Morning Outfit Brief"
                subtitle="Daily weather summary and outfit tip sent each morning."
              />
              <Switch
                value={ns.morningBriefEnabled}
                onValueChange={v => set('morningBriefEnabled', v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(135,222,90,0.6)' }}
                thumbColor={ns.morningBriefEnabled ? '#87DE5A' : colors.textMuted}
              />
            </Row>

            {ns.morningBriefEnabled && (
              <View style={st.subConfig}>
                <Text style={st.subLabel}>Send at</Text>
                <ChipRow
                  options={HOUR_OPTIONS}
                  selected={localHour}
                  onSelect={setLocalHour}
                  labelFn={HOUR_LABEL}
                />
              </View>
            )}
          </View>

          {/* Temperature Swing Warning */}
          <View style={st.card}>
            <Row>
              <RowLabel
                title="Temperature Swing Warning"
                subtitle="Alerts you to dress in layers when the daily swing is large."
              />
              <Switch
                value={ns.tempSwingEnabled}
                onValueChange={v => set('tempSwingEnabled', v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(135,222,90,0.6)' }}
                thumbColor={ns.tempSwingEnabled ? '#87DE5A' : colors.textMuted}
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
                  minimumTrackTintColor="#87DE5A"
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor="#87DE5A"
                />
              </View>
            )}
          </View>
        </View>

        {/* ── Real-time Alerts ──────────────────────────────────────────── */}
        <View style={st.section}>
          <Text style={s.sectionLabel}>Alerts</Text>

          {/* Weather Change Alert */}
          <View style={st.card}>
            <Row>
              <RowLabel
                title="Weather Change Alert"
                subtitle="Notifies you in the afternoon if rain or a cold front moves in unexpectedly."
              />
              <Switch
                value={ns.weatherChangeEnabled}
                onValueChange={v => set('weatherChangeEnabled', v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(135,222,90,0.6)' }}
                thumbColor={ns.weatherChangeEnabled ? '#87DE5A' : colors.textMuted}
              />
            </Row>
          </View>

          {/* Closet Gap Nudge */}
          <View style={st.card}>
            <Row>
              <RowLabel
                title="Closet Gap Nudge"
                subtitle="Suggests adding missing items when your closet lacks gear for the forecast."
              />
              <Switch
                value={ns.closetGapEnabled}
                onValueChange={v => set('closetGapEnabled', v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(135,222,90,0.6)' }}
                thumbColor={ns.closetGapEnabled ? '#87DE5A' : colors.textMuted}
              />
            </Row>
          </View>
        </View>

        {/* ── Weekly ────────────────────────────────────────────────────── */}
        <View style={st.section}>
          <Text style={s.sectionLabel}>Weekly</Text>

          <View style={st.card}>
            <Row>
              <RowLabel
                title="Weekly Wardrobe Recap"
                subtitle="A weekly prompt to review your outfit history and discover new combinations."
              />
              <Switch
                value={ns.weeklyRecapEnabled}
                onValueChange={v => set('weeklyRecapEnabled', v)}
                trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(135,222,90,0.6)' }}
                thumbColor={ns.weeklyRecapEnabled ? '#87DE5A' : colors.textMuted}
              />
            </Row>

            {ns.weeklyRecapEnabled && (
              <View style={st.subConfig}>
                <Text style={st.subLabel}>Send on</Text>
                <ChipRow
                  options={[0, 1, 2, 3, 4, 5, 6]}
                  selected={ns.weeklyRecapDay}
                  onSelect={v => set('weeklyRecapDay', v)}
                  labelFn={v => DAY_LABELS[v]}
                />
              </View>
            )}
          </View>
        </View>

        {/* ── Status + Save ─────────────────────────────────────────────── */}
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
            ? <ActivityIndicator color={colors.saveBtnText} />
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgDefault },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderWidth:     1,
    borderColor:     'rgba(250, 204, 21, 0.25)',
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             10,
  },

  permText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      'rgba(253, 224, 71, 0.9)',
    lineHeight: fontSizes.sm * 1.5,
  },

  permBtn: {
    alignSelf:         'flex-start',
    paddingVertical:   7,
    paddingHorizontal: 14,
    backgroundColor:   'rgba(250, 204, 21, 0.12)',
    borderWidth:       1,
    borderColor:       'rgba(250, 204, 21, 0.30)',
    borderRadius:      radius.pill,
  },

  permBtnText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.medium,
    color:      'rgba(253, 224, 71, 1)',
  },
});
