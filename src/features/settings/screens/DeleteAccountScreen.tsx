import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ScreenShell from '../components/ScreenShell';
import { auth, getErrorMessage } from '../../../lib/auth';
import styles from './screens.module.css';

interface Props { onLogout: () => void; }

const DeleteAccountScreen = ({ onLogout }: Props) => {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete('/api/user/me', auth());
      localStorage.clear();
      onLogout();
      navigate('/login');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not delete account. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <ScreenShell title="Delete Account">
      <div className={styles.infoCard}>
        <p className={styles.infoTitle}>What gets deleted</p>
        <p className={styles.infoBody}>
          Your account, all closets, all clothing articles, outfit wear history,
          and style preferences are permanently removed within 30 days.
          This action cannot be undone.
        </p>
      </div>

      {!confirmed ? (
        <div className={styles.dangerCard}>
          <p className={styles.dangerTitle}>Danger zone</p>
          <p className={styles.dangerBody}>
            Deleting your account is permanent. Make sure you have exported
            any data you want to keep before proceeding.
          </p>
          <button className={styles.dangerBtn} onClick={() => setConfirmed(true)}>
            I understand — continue
          </button>
        </div>
      ) : (
        <div className={styles.dangerCard}>
          <p className={styles.dangerTitle}>Are you sure?</p>
          <p className={styles.dangerBody}>
            This will permanently delete your account and all data immediately.
          </p>
          {error && <p className={`${styles.statusMsg} ${styles.error}`}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.dangerBtn} onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              className={styles.dangerBtn}
              style={{ background: 'none', color: 'var(--text-secondary)', borderColor: 'var(--glass-border)' }}
              onClick={() => { setConfirmed(false); setError(null); }}
              disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </ScreenShell>
  );
};

export default DeleteAccountScreen;
