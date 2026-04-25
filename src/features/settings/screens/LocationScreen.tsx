import { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { StatusMessage } from '../../../components/shared';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';

export default function LocationScreen() {
  const { settings, saveSettings }  = useSettings();
  const [city, setCity]             = useState(settings.location);
  const { status, loading, submit } = useFormSubmit('Location saved.', 2000);

  const save = () => submit(() => saveSettings({ ...settings, location: city.trim() }));

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <View style={st.section}>
            <Text style={st.sectionLabel}>Default city</Text>
            <Text style={st.hint}>
              Used for weather fetching. Enter a city name (e.g. "New York" or "London").
            </Text>
            <TextInput style={st.input} placeholder="City name"
              placeholderTextColor={colors.textMuted}
              value={city} onChangeText={setCity} returnKeyType="done" onSubmitEditing={save} />
          </View>
          <StatusMessage status={status} />
          <Pressable style={[st.saveBtn, loading && { opacity: 0.5 }]} onPress={save} disabled={loading}>
            <Text style={st.saveBtnText}>{loading ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bgDefault },
  content:     { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  section:     { gap: spacing.sm },
  sectionLabel:{ fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint:        { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: fontSizes.sm * 1.6 },
  input:       { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: spacing.md },
  saveBtn:     { paddingVertical: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center' },
  saveBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
});
