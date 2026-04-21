import { useState } from 'react';
import axios from 'axios';
import ScreenShell from '../components/ScreenShell';
import { auth } from '../../../lib/auth';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import { StatusMessage } from '../../../components/shared';
import styles from './screens.module.css';

interface PasswordProps { embedded?: boolean; }
const PasswordScreen = ({ embedded }: PasswordProps) => {
  const [newPassword,  setNewPassword]  = useState('');
  const [confirm,      setConfirm]      = useState('');
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
        ? <p className={`${styles.statusMsg} ${styles.error}`}>{validationMsg}</p>
        : <StatusMessage status={status} styles={styles} />
      }

      <div className={styles.formGroup}>
        <label className={styles.label}>New password</label>
        <input className={styles.input} type="password" placeholder="At least 8 characters"
          value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Confirm new password</label>
        <input className={styles.input} type="password" placeholder="••••••••"
          value={confirm} onChange={e => setConfirm(e.target.value)} />
      </div>

      <button className={styles.saveBtn} onClick={save} disabled={loading}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </ScreenShell>
  );
};

export default PasswordScreen;
