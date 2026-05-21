import { useState, useMemo } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable } from '../../../components/primitives';
import axios from '../../../api/client';
import { auth } from '../../../lib/auth';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import { makeStyles } from './screens.styles';
import { spacing, fonts, fontSizes } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';

export default function PasswordScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const styles = useMemo(() => StyleSheet.create({
    root:    { flex: 1, backgroundColor: colors.bgDefault },
    content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    btnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: '600', color: colors.saveBtnText },
  }), [colors]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirm,         setConfirm]         = useState('');
  const { status, loading, submit, clearStatus } = useFormSubmit('Password updated.');

  const validationMsg =
    newPassword && newPassword.length < 8 ? 'New password must be at least 8 characters.' :
    confirm && newPassword !== confirm     ? 'Passwords do not match.' : null;

  const save = () => {
    clearStatus();
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirm) return;
    submit(async () => {
      await axios.put('/api/user/password', { currentPassword, newPassword }, auth());
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

          {[
            { label: 'Current password', value: currentPassword, set: setCurrentPassword, type: 'current' },
            { label: 'New password',     value: newPassword,     set: setNewPassword,     type: 'new' },
            { label: 'Confirm password', value: confirm,         set: setConfirm,         type: 'confirm' },
          ].map(f => (
            <View key={f.type} style={s.formGroup}>
              <Text style={s.label}>{f.label}</Text>
              <TextInput style={s.input} secureTextEntry
                placeholder="••••••••" placeholderTextColor={colors.textMuted}
                textContentType={f.type === 'new' ? 'newPassword' : 'password'}
                value={f.value} onChangeText={f.set}
                accessibilityLabel={f.label} />
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
