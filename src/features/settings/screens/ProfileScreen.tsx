import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ScreenShell from '../components/ScreenShell';
import { auth, getToken, getErrorMessage, updateAuthUser, clearAuth } from '../../../lib/auth';
import { storage } from '../../../lib/storage';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from './screens.module.css';

interface Props {
  embedded?:  boolean;
  onLogout?:  () => void;
}

const ProfileScreen = ({ embedded, onLogout }: Props) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const { status, loading, submit } = useFormSubmit('Profile updated.');

  // Delete account state
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

      {/* ── Profile form ── */}
      <StatusMessage status={status} styles={styles} />

      <div className={styles.formGroup}>
        <label className={styles.label}>Username</label>
        <input className={styles.input} type="text" placeholder="@yourname"
          value={username} onChange={e => setUsername(e.target.value)} />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Email</label>
        <input className={styles.input} type="email" placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)} />
      </div>

      <button className={styles.saveBtn} onClick={save} disabled={loading}>
        {loading ? 'Saving…' : 'Save changes'}
      </button>

      {/* ── Danger zone ── */}
      <div className={styles.dangerCard}>
        <p className={styles.dangerTitle}>Delete account</p>
        <p className={styles.dangerBody}>
          Permanently removes your account, all closets, clothing articles, and
          outfit history. This cannot be undone.
        </p>
        <button className={styles.dangerBtn} onClick={() => setDeleteStep('confirm')}>
          Delete my account
        </button>
      </div>

      {/* ── Delete confirmation modal ── */}
      {deleteStep === 'confirm' && createPortal(
        <div className={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget && !deleteLoading) setDeleteStep('idle'); }}>
          <div className={styles.modalCard}>
            <div className={styles.modalIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="rgba(252,165,165,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.modalTitle}>Are you sure?</h3>
            <p className={styles.modalBody}>
              This will permanently delete your account and all associated data.
              This action <strong>cannot be undone</strong>.
            </p>
            {deleteError && (
              <p className={`${styles.statusMsg} ${styles.error}`}>{deleteError}</p>
            )}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel}
                onClick={() => { setDeleteStep('idle'); setDeleteError(null); }}
                disabled={deleteLoading}>
                Cancel
              </button>
              <button className={styles.modalConfirm}
                onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ScreenShell>
  );
};

export default ProfileScreen;
