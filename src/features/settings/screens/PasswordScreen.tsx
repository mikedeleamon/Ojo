import { useState } from 'react';
import axios from 'axios';
import ScreenShell from '../components/ScreenShell';
import { View, Text, TextInput, Pressable } from '../../../components/primitives';
import { auth } from '../../../lib/auth';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from './screens.module.css';

interface PasswordProps { embedded?: boolean; }

const PasswordScreen = ({ embedded }: PasswordProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirm,     setConfirm]     = useState('');
  const { status, loading, submit, clearStatus } = useFormSubmit('Password updated successfully.');

  const validationMsg =
    newPassword && newPassword.length < 8 ? 'Password must be at least 8 characters.' :
    confirm && newPassword !== confirm     ? 'Passwords do not match.' :
    null;

  const save = () => {
    clearStatus();
    if (newPassword.length < 8 || newPassword !== confirm) return;
    submit(async () => {
      await axios.put('/api/user/password', { newPassword }, auth());
      setNewPassword('');
      setConfirm('');
    });
  };

  return (
    <ScreenShell title="Change Password" embedded={embedded}>
      {validationMsg
        ? <Text style={`${styles.statusMsg} ${styles.error}`}>{validationMsg}</Text>
        : <StatusMessage status={status} styles={styles} />
      }

      <View style={styles.formGroup}>
        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 8 characters"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />
      </View>

      <Pressable style={styles.saveBtn} onPress={save} disabled={loading}>
        <Text>{loading ? 'Updating…' : 'Update password'}</Text>
      </Pressable>
    </ScreenShell>
  );
};

export default PasswordScreen;
