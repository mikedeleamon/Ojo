import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Settings } from '../../types';
import styles from './AccountPage.module.css';

const AUTH_KEY = 'ojo_auth';
const STYLES   = ['Casual', 'Business Casual', 'Formal', 'Urban', 'Cozy', 'Preppy'];

type Tab = 'user' | 'preferences' | 'password';

interface Props {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  onLogout: () => void;
}

const getToken = (): string | null => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').token ?? null; }
  catch { return null; }
};

const authHeaders = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

// ─── Sub-components ───────────────────────────────────────────────────────────

const SliderField = ({ label, value, unit, min, max, onChange }: {
  label: string; value: number; unit: string; min: number; max: number;
  onChange: (v: number) => void;
}) => (
  <div className={styles.sliderRow}>
    <div className={styles.sliderMeta}>
      <span className={styles.sliderLabel}>{label}</span>
      <span className={styles.sliderValue}>{value}{unit}</span>
    </div>
    <input
      type='range' min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className={styles.slider}
    />
  </div>
);

// ─── Tab: User ────────────────────────────────────────────────────────────────

const UserTab = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [status, setStatus]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading]   = useState(false);

  // Load current user info on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    axios.get('/api/user/me', authHeaders(token))
      .then(({ data }) => {
        setUsername(data.username ?? '');
        setEmail(data.email ?? '');
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setStatus(null);
    try {
      await axios.put('/api/user/profile', { username, email }, authHeaders(token));
      // Update stored user info
      const raw = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ...raw, user: { ...raw.user, email, username } }));
      setStatus({ type: 'success', msg: 'Profile updated.' });
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error ?? 'Update failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <h2 className={styles.tabTitle}>Profile</h2>

      {status && <p className={`${styles.statusMsg} ${styles[status.type]}`}>{status.msg}</p>}

      <div className={styles.formGroup}>
        <label className={styles.label}>Username</label>
        <input
          className={styles.input}
          type='text'
          placeholder='@yourname'
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Email</label>
        <input
          className={styles.input}
          type='email'
          placeholder='you@example.com'
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      <button className={styles.saveBtn} onClick={save} disabled={loading}>
        {loading ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
};

// ─── Tab: Preferences ────────────────────────────────────────────────────────

const PreferencesTab = ({ settings, saveSettings }: { settings: Settings; saveSettings: (s: Settings) => Promise<void> }) => {
  const [clothingStyle, setClothingStyle] = useState(settings.clothingStyle);
  const [location,      setLocation]      = useState(settings.location);
  const [tempScale,     setTempScale]     = useState<'Imperial' | 'Metric'>(settings.temperatureScale as 'Imperial' | 'Metric');
  const [hiTemp,        setHiTemp]        = useState(settings.hiTempThreshold);
  const [lowTemp,       setLowTemp]       = useState(settings.lowTempThreshold);
  const [humidity,      setHumidity]      = useState(settings.humidityPreference);
  const [status,        setStatus]        = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const save = async () => {
    const next: Settings = {
      clothingStyle, location, temperatureScale: tempScale,
      hiTempThreshold: hiTemp, lowTempThreshold: lowTemp, humidityPreference: humidity,
    };
    setStatus(null);
    try {
      await saveSettings(next);
      setStatus({ type: 'success', msg: 'Preferences saved.' });
      setTimeout(() => setStatus(null), 2500);
    } catch {
      setStatus({ type: 'error', msg: 'Could not save — changes rolled back. Please try again.' });
    }
  };

  return (
    <div className={styles.tabContent}>
      <h2 className={styles.tabTitle}>Preferences</h2>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Style preference</h3>
        <div className={styles.chips}>
          {STYLES.map(s => (
            <button
              key={s}
              className={`${styles.chip} ${clothingStyle === s ? styles.chipActive : ''}`}
              onClick={() => setClothingStyle(s)}
            >{s}</button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Default location</h3>
        <input
          className={styles.input}
          type='text'
          placeholder='City name'
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Temperature unit</h3>
        <div className={styles.segmented}>
          <button className={`${styles.seg} ${tempScale === 'Imperial' ? styles.segActive : ''}`} onClick={() => setTempScale('Imperial')}>°F</button>
          <button className={`${styles.seg} ${tempScale === 'Metric'   ? styles.segActive : ''}`} onClick={() => setTempScale('Metric')}>°C</button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Temperature feel</h3>
        <SliderField label='Hot above' value={hiTemp}  unit='°' min={50} max={120} onChange={setHiTemp} />
        <SliderField label='Cold below' value={lowTemp} unit='°' min={0}  max={70}  onChange={setLowTemp} />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Humidity sensitivity</h3>
        <SliderField label='Threshold' value={humidity} unit='%' min={0} max={100} onChange={setHumidity} />
      </section>

      {status && <p className={`${styles.statusMsg} ${styles[status.type]}`}>{status.msg}</p>}
      <button className={styles.saveBtn} onClick={save}>Save changes</button>
    </div>
  );
};

// ─── Tab: Change Password ─────────────────────────────────────────────────────

const PasswordTab = () => {
  const [newPassword,  setNewPassword]  = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status,  setStatus]  = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setStatus(null);
    if (newPassword.length < 8) {
      setStatus({ type: 'error', msg: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: 'Passwords do not match.' });
      return;
    }
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      await axios.put('/api/user/password', { newPassword }, authHeaders(token));
      setStatus({ type: 'success', msg: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.response?.data?.error ?? 'Update failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <h2 className={styles.tabTitle}>Change Password</h2>

      {status && <p className={`${styles.statusMsg} ${styles[status.type]}`}>{status.msg}</p>}

      <div className={styles.formGroup}>
        <label className={styles.label}>New password</label>
        <input
          className={styles.input}
          type='password'
          placeholder='At least 8 characters'
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Confirm new password</label>
        <input
          className={styles.input}
          type='password'
          placeholder='••••••••'
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
        />
      </div>

      <button className={styles.saveBtn} onClick={save} disabled={loading}>
        {loading ? 'Updating…' : 'Update password'}
      </button>
    </div>
  );
};

// ─── AccountPage ──────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'user',
    label: 'Profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'password',
    label: 'Password',
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const AccountPage = ({ settings, saveSettings, onLogout }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>('user');
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className={styles.root}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label='Back'>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className={styles.sidebarHeader}>
          <div className={styles.avatar}>
            <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span className={styles.sidebarTitle}>Account</span>
        </div>

        <nav className={styles.nav}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.navItem} ${activeTab === tab.id ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.navIcon}>{tab.icon}</span>
              <span className={styles.navLabel}>{tab.label}</span>
            </button>
          ))}
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M13 10H3m0 0l3-3m-3 3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 5H6a2 2 0 00-2 2v6a2 2 0 002 2h3M13 7l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Log out
        </button>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {/* Mobile tab bar */}
        <div className={styles.mobileTabBar}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.mobileTab} ${activeTab === tab.id ? styles.mobileTabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'user'        && <UserTab />}
        {activeTab === 'preferences' && <PreferencesTab settings={settings} saveSettings={saveSettings} />}
        {activeTab === 'password'    && <PasswordTab />}
      </main>
    </div>
  );
};

export default AccountPage;
