import { useState, useMemo } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable } from '../../../components/primitives';
import axios from '../../../api/client';
import { auth, updateToken } from '../../../lib/auth';
import { validatePassword } from '../../../lib/passwordPolicy';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import { makeStyles } from './screens.styles';
import { spacing, radius, fonts, fontSizes } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';

export default function PasswordScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const styles = useMemo(() => StyleSheet.create({
    root:       { flex: 1, backgroundColor: colors.bgDefault },
    content:    { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    btnText:    { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: '600', color: colors.saveBtnText },
    inputRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm },
    inputInner: { flex: 1, paddingVertical: 12, paddingHorizontal: spacing.md, color: colors.textPrimary, fontFamily: fonts.body, fontSize: fontSizes.base },
    toggle:     { paddingHorizontal: spacing.sm, paddingVertical: 12 },
    toggleText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted },
  }), [colors]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirm,         setConfirm]         = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { status, loading, submit, clearStatus } = useFormSubmit('Password updated.');

  const newPasswordError = newPassword ? validatePassword(newPassword) : undefined;
  const validationMsg =
    newPasswordError ? newPasswordError :
    confirm && newPassword !== confirm ? 'Passwords do not match.' : null;

  const save = () => {
    clearStatus();
    if (!currentPassword || validatePassword(newPassword) || newPassword !== confirm) return;
    submit(async () => {
      const { data } = await axios.put<{ token: string }>('/api/user/password', { currentPassword, newPassword }, auth());
      if (data?.token) await updateToken(data.token);
      setCurrentPassword(''); setNewPassword(''); setConfirm('');
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {validationMsg ? (
            <View style={[s.statusMsgBase, s.error]}>
              <Text style={{ color: colors.errorText, fontSize: 13 }}>{validationMsg}</Text>
            </View>
          ) : (
            <StatusMessage status={status} />
          )}

          {([
            { label: 'Current password', value: currentPassword, set: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(v => !v), type: 'current' },
            { label: 'New password',     value: newPassword,     set: setNewPassword,     show: showNew,     toggle: () => setShowNew(v => !v),     type: 'new' },
            { label: 'Confirm password', value: confirm,         set: setConfirm,         show: showConfirm, toggle: () => setShowConfirm(v => !v), type: 'confirm' },
          ] as const).map(f => (
            <View key={f.type} style={s.formGroup}>
              <Text style={s.label}>{f.label}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputInner}
                  secureTextEntry={!f.show}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  textContentType={f.type === 'new' ? 'newPassword' : 'password'}
                  value={f.value}
                  onChangeText={f.set}
                  accessibilityLabel={f.label}
                />
                <Pressable
                  style={styles.toggle}
                  onPress={f.toggle}
                  accessibilityRole="button"
                  accessibilityLabel={f.show ? `Hide ${f.label.toLowerCase()}` : `Show ${f.label.toLowerCase()}`}
                >
                  <Text style={styles.toggleText}>{f.show ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable style={[s.saveBtn, (loading || !currentPassword) && { opacity: 0.5 }]}
            onPress={save} disabled={loading || !currentPassword}
            accessibilityRole="button"
            accessibilityLabel={loading ? 'Updating' : 'Update password'}
            accessibilityState={{ busy: loading, disabled: loading || !currentPassword }}>
            <Text style={styles.btnText}>{loading ? 'Updating…' : 'Update password'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
