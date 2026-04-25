import { useState, useEffect } from 'react';
import { StyleSheet, Modal, Alert } from 'react-native';
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable } from '../../../components/primitives';
import axios from '../../../api/client';
import { auth, getToken, getErrorMessage, updateAuthUser, clearAuth } from '../../../lib/auth';
import { storage } from '../../../lib/storage';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import { styles as s } from '../screens/screens.styles';
import { colors, spacing, radius, fonts, fontSizes } from '../../../theme/tokens';

interface Props { onLogout?: () => void; }

export default function ProfileScreen({ onLogout }: Props) {
  const [username,     setUsername]     = useState('');
  const [email,        setEmail]        = useState('');
  const [deleteStep,   setDeleteStep]   = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);
  const { status, loading, submit } = useFormSubmit('Profile updated.');

  useEffect(() => {
    if (!getToken()) return;
    axios.get('/api/user/me', auth())
      .then(({ data }) => { setUsername(data.username ?? ''); setEmail(data.email ?? ''); })
      .catch(() => {});
  }, []);

  const save = () => submit(async () => {
    await axios.put('/api/user/profile', { username, email }, auth());
    await updateAuthUser({ email, username });
  });

  const handleDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await axios.delete('/api/user/me', auth());
      await clearAuth();
      await storage.clear();
      onLogout?.();
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, 'Could not delete account.'));
      setDeleteLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <StatusMessage status={status} />

          <View style={s.formGroup}>
            <Text style={s.label}>Username</Text>
            <TextInput style={s.input} placeholder="@yourname"
              placeholderTextColor={colors.textMuted}
              value={username} onChangeText={setUsername}
              autoCapitalize="none" />
          </View>

          <View style={s.formGroup}>
            <Text style={s.label}>Email</Text>
            <TextInput style={s.input} placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address" autoCapitalize="none"
              textContentType="emailAddress"
              value={email} onChangeText={setEmail} />
          </View>

          <Pressable style={[s.saveBtn, loading && { opacity: 0.5 }]}
            onPress={save} disabled={loading}>
            <Text style={styles.saveBtnText}>{loading ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>

          {/* Danger zone */}
          <View style={s.dangerCard}>
            <Text style={s.dangerTitle}>Delete account</Text>
            <Text style={s.dangerBody}>
              Permanently removes your account, closets, clothing articles, and outfit history. Cannot be undone.
            </Text>
            <Pressable style={s.dangerBtn} onPress={() => setDeleteStep(true)}>
              <Text style={s.dangerBtnText}>Delete my account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={deleteStep} transparent animationType="fade">
        <Pressable style={styles.backdrop}
          onPress={() => { if (!deleteLoading) { setDeleteStep(false); setDeleteError(null); } }} />
        <View style={styles.modalCard}>
          <View style={styles.modalIcon}>
            {/* warning icon placeholder */}
            <Text style={{ fontSize: 20 }}>⚠️</Text>
          </View>
          <Text style={s.modalTitle}>Are you sure?</Text>
          <Text style={s.modalBody}>
            This will permanently delete your account and all data. This action cannot be undone.
          </Text>
          {deleteError ? (
            <View style={[s.statusMsgBase, s.error]}>
              <Text style={{ color: colors.errorText, fontSize: 13 }}>{deleteError}</Text>
            </View>
          ) : null}
          <View style={s.modalActions}>
            <Pressable style={s.modalCancel}
              onPress={() => { setDeleteStep(false); setDeleteError(null); }}
              disabled={deleteLoading}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={s.modalConfirm} onPress={handleDelete} disabled={deleteLoading}>
              <Text style={s.modalConfirmText}>{deleteLoading ? 'Deleting…' : 'Yes, delete'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bgDefault },
  content:     { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  saveBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: '600', color: '#0D1B2A' },
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: {
    position: 'absolute', left: 24, right: 24,
    top: '30%',
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.glassBorder, gap: 12,
  },
  modalIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
});
