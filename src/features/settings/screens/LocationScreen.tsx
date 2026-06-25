import { useState, useMemo } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { StatusMessage } from '../../../components/shared';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import CityAutocomplete from '../components/CityAutocomplete';
import type { CitySuggestion } from '../../../lib/citySearch';

export default function LocationScreen() {
  const { colors } = useTheme();
  const st = useMemo(() => StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.bgDefault },
    content:     { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    section:     { gap: spacing.sm },
    sectionLabel:{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    hint:        { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: fontSizes.sm * 1.6 },
    input:       { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: spacing.md },
    saveBtn:     { paddingVertical: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center' },
    saveBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
  }), [colors]);

  const { settings, saveSettings }  = useSettings();
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const { status, loading, submit } = useFormSubmit('Location saved.', 2000);

  const save = () => submit(async () => {
    if (!selectedCity) return;
    // Coords come from the picked suggestion, so the server cron can call
    // WeatherKit directly without re-geocoding.
    await saveSettings({
      ...settings,
      location: selectedCity.name,
      lat: selectedCity.lat,
      lon: selectedCity.lon,
    });
  });

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.section}>
            <Text style={st.sectionLabel}>Default city</Text>
            <Text style={st.hint}>
              Used for weather fetching. Current: {settings.location || 'not set'}.
              Start typing and pick a city from the list.
            </Text>
            <CityAutocomplete
              onSelect={setSelectedCity}
              placeholder="Search for a city (e.g. London)"
              accessibilityLabel="Default city"
            />
          </View>
          <StatusMessage status={status} />
          <Pressable style={[st.saveBtn, (loading || !selectedCity) && { opacity: 0.5 }]}
            onPress={save} disabled={loading || !selectedCity}
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Saving' : 'Save'}
            accessibilityState={{ busy: loading, disabled: loading || !selectedCity }}>
            <Text style={st.saveBtnText}>{loading ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
