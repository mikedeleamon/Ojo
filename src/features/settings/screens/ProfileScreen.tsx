import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ScreenShell from '../components/ScreenShell';
import { View, Text, TextInput, Pressable } from '../../../components/primitives';
import { auth, getToken, getErrorMessage, updateAuthUser, clearAuth } from '../../../lib/auth';
import { storage } from '../../../lib/storage';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from './screens.module.css';

interface Props {
  embedded?: boolean;
  onLogout?: () => void;
}

const ProfileScreen = ({ embedded, onLogout }: Props) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const { status, loading, submit } = useFormSubmit('Profile updated.');

  const [deleteStep,    setDeleteStep]    = useState<'idle' | 'confirm'>('idle');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);

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
      navigate('/login');
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, 'Could not delete account. Please try again.'));
      setDeleteLoading(false);
    }
  };

  return (
    <ScreenShell title="Profile" embedded={embedded}>

      <StatusMessage status={status} styles={styles} />

      <View style={styles.formGroup}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="@yourname"
          value={username}
          onChangeText={setUsername}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <Pressable style={styles.saveBtn} onPress={save} disabled={loading}>
        <Text>{loading ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>

      {/* Danger zone */}
      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={styles.dangerBody}>
          Permanently removes your account, all closets, clothing articles, and
          outfit history. This cannot be undone.
        </Text>
        <Pressable style={styles.dangerBtn} onPress={() => setDeleteStep('confirm')}>
          <Text>Delete my account</Text>
        </Pressable>
      </View>

      {/* Delete confirmation modal — portalled to body for guaranteed centering */}
      {deleteStep === 'confirm' && createPortal(
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => { if (!deleteLoading) setDeleteStep('idle'); }}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="rgba(252,165,165,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </View>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalBody}>
              This will permanently delete your account and all associated data.
              This action cannot be undone.
            </Text>
            {deleteError && (
              <Text style={`${styles.statusMsg} ${styles.error}`}>{deleteError}</Text>
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => { setDeleteStep('idle'); setDeleteError(null); }}
                disabled={deleteLoading}
              >
                <Text>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={handleDelete}
                disabled={deleteLoading}
              >
                <Text>{deleteLoading ? 'Deleting…' : 'Yes, delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>,
        document.body
      )}
    </ScreenShell>
  );
};

export default ProfileScreen;
