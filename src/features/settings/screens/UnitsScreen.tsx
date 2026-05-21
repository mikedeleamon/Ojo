import { useState, useMemo } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { StatusMessage } from '../../../components/shared';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';

export default function UnitsScreen() {
  const { colors } = useTheme();
  const st = useMemo(() => StyleSheet.create({
    root:         { flex: 1, backgroundColor: colors.bgDefault },
    content:      { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    sectionLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    segmented:    { gap: 4, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, padding: 4 },
    seg:          { paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: 6, alignItems: 'center' },
    segActive:    { backgroundColor: colors.glassBgStrong },
    segText:      { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
    segTextActive:{ color: colors.textPrimary, fontWeight: fontWeights.medium },
    saveBtn:      { paddingVertical: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center' },
    saveBtnText:  { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
  }), [colors]);

  const { settings, saveSettings } = useSettings();
  const [scale, setScale] = useState<'Imperial' | 'Metric'>(
    settings.temperatureScale as 'Imperial' | 'Metric'
  );
  const { status, loading, submit } = useFormSubmit('Units updated.', 2000);

  const save = () => submit(() => saveSettings({ ...settings, temperatureScale: scale }));

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={st.content}>
        <Text style={st.sectionLabel}>Temperature</Text>
        <View style={st.segmented}>
          {(['Imperial', 'Metric'] as const).map(s => (
            <Pressable key={s} style={[st.seg, scale === s && st.segActive]} onPress={() => setScale(s)}>
              <Text style={[st.segText, scale === s && st.segTextActive]}>
                {s === 'Imperial' ? '°F — Fahrenheit' : '°C — Celsius'}
              </Text>
            </Pressable>
          ))}
        </View>
        <StatusMessage status={status} />
        <Pressable style={[st.saveBtn, loading && { opacity: 0.5 }]} onPress={save} disabled={loading}>
          <Text style={st.saveBtnText}>{loading ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
