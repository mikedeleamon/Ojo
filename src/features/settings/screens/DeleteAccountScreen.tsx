import { useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import axios from '../../../api/client';
import { auth, getErrorMessage, clearAuth } from '../../../lib/auth';
import { storage } from '../../../lib/storage';
import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';

interface Props { onLogout?: () => void; }

export default function DeleteAccountScreen({ onLogout }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true); setError(null);
    try {
      await axios.delete('/api/user/me', auth());
      await clearAuth();
      await storage.clear();
      onLogout?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete account. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={st.content}>

        <View style={st.infoCard}>
          <Text style={st.infoTitle}>What gets deleted</Text>
          <Text style={st.infoBody}>
            Your account, all closets, all clothing articles, outfit history, and style preferences
            are permanently removed. This action cannot be undone.
          </Text>
        </View>

        {!confirmed ? (
          <View style={st.dangerCard}>
            <Text style={st.dangerTitle}>Danger zone</Text>
            <Text style={st.dangerBody}>
              Deleting your account is permanent. Export any data you want to keep first.
            </Text>
            <Pressable style={st.dangerBtn} onPress={() => setConfirmed(true)}>
              <Text style={st.dangerBtnText}>I understand — continue</Text>
            </Pressable>
          </View>
        ) : (
          <View style={st.dangerCard}>
            <Text style={st.dangerTitle}>Are you sure?</Text>
            <Text style={st.dangerBody}>
              This will permanently delete your account and all data immediately.
            </Text>
            {error ? (
              <View style={st.errorBox}><Text style={st.errorText}>{error}</Text></View>
            ) : null}
            <View style={st.confirmRow}>
              <Pressable style={[st.dangerBtn, { opacity: loading ? 0.5 : 1 }]}
                onPress={handleDelete} disabled={loading}>
                <Text style={st.dangerBtnText}>{loading ? 'Deleting…' : 'Delete my account'}</Text>
              </Pressable>
              <Pressable style={st.cancelBtn}
                onPress={() => { setConfirmed(false); setError(null); }} disabled={loading}>
                <Text style={st.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.bgDefault },
  content:      { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  infoCard:     { backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.md, gap: 8 },
  infoTitle:    { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  infoBody:     { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: fontSizes.sm * 1.6 },
  dangerCard:   { backgroundColor: colors.dangerBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.dangerBorder, padding: spacing.md, gap: spacing.sm },
  dangerTitle:  { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.dangerTextHi, textTransform: 'uppercase', letterSpacing: 0.5 },
  dangerBody:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: fontSizes.sm * 1.6 },
  dangerBtn:    { paddingVertical: 10, paddingHorizontal: spacing.md, backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.dangerBorder, alignSelf: 'flex-start' },
  dangerBtnText:{ fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.dangerText },
  confirmRow:   { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  cancelBtn:    { paddingVertical: 10, paddingHorizontal: spacing.md, backgroundColor: 'transparent', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, alignSelf: 'flex-start' },
  cancelBtnText:{ fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  errorBox:     { backgroundColor: colors.errorBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.errorBorder, padding: spacing.sm },
  errorText:    { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.errorText },
});
