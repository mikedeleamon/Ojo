import { useState, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { useSettings } from '../../../hooks/useSettings';
import { hapticSelection } from '../../../lib/haptics';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';

export default function UnitsScreen() {
  const { colors } = useTheme();
  const st = useMemo(() => StyleSheet.create({
    root:         { flex: 1, backgroundColor: colors.bgDefault },
    content:      { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    labelRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    savedTag:     { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.successText },
    segmented:    { gap: 4, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, padding: 4 },
    seg:          { paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: 6, alignItems: 'center' },
    segActive:    { backgroundColor: colors.glassBgStrong },
    segText:      { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
    segTextActive:{ color: colors.textPrimary, fontWeight: fontWeights.medium },
    hint:         { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: fontSizes.sm * 1.5 },
  }), [colors]);

  const { settings, saveSettings } = useSettings();
  const [scale, setScale] = useState<'Imperial' | 'Metric'>(
    settings.temperatureScale as 'Imperial' | 'Metric'
  );
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  // Auto-save on tap — mirrors the Style tab so changing a unit feels the same
  // everywhere (no explicit Save button to hunt for).
  const select = (next: 'Imperial' | 'Metric') => {
    if (next === scale) return;
    setScale(next);
    hapticSelection();
    saveSettings({ ...settings, temperatureScale: next }).catch(() => {});
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 1500);
  };

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={st.content}>
        <View style={st.labelRow}>
          <Text style={st.sectionLabel}>Temperature</Text>
          {justSaved && <Text style={st.savedTag}>✓ Saved</Text>}
        </View>
        <View style={st.segmented}>
          {(['Imperial', 'Metric'] as const).map(s => (
            <Pressable
              key={s}
              style={[st.seg, scale === s && st.segActive]}
              onPress={() => select(s)}
              accessibilityRole="radio"
              accessibilityLabel={s === 'Imperial' ? 'Fahrenheit' : 'Celsius'}
              accessibilityState={{ selected: scale === s }}
            >
              <Text style={[st.segText, scale === s && st.segTextActive]}>
                {s === 'Imperial' ? '°F — Fahrenheit' : '°C — Celsius'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={st.hint}>Changes save automatically.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
