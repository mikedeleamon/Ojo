import { useState, useEffect } from 'react';

import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useSettings } from '../../hooks/useSettings';
import { SETTINGS_CONFIG, SettingsAction, SettingsSectionConfig } from './config';
import SettingsSection from './components/SettingsSection';
import LegalModal from '../../components/LegalModal/LegalModal';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../config/legal';

// Detail screens (rendered inline on desktop)
import ProfileScreen      from './screens/ProfileScreen';
import PasswordScreen     from './screens/PasswordScreen';
import PreferencesScreen  from './screens/PreferencesScreen';
import {
  NotificationsScreen,
  PermissionsScreen,
  DataUsageScreen,
  HistoryScreen,
} from './screens/SimpleScreens';

import styles from './SettingsScreen.module.css';

interface Props { onLogout: () => void; }

type ScreenKey = 'profile' | 'password' | 'history' | 'preferences'
               | 'notifications' | 'permissions' | 'data-usage';

const DEFAULT_SCREEN: ScreenKey = 'profile';

/** Maps a settings item key → the inline React component for desktop view. */
const renderScreen = (key: ScreenKey, onLogout: () => void) => {
  switch (key) {
    case 'profile':       return <ProfileScreen      embedded onLogout={onLogout} />;
    case 'password':      return <PasswordScreen     embedded />;
    case 'history':       return <HistoryScreen      embedded />;
    case 'preferences':   return <PreferencesScreen  embedded />;
    case 'notifications': return <NotificationsScreen embedded />;
    case 'permissions':   return <PermissionsScreen  embedded />;
    case 'data-usage':    return <DataUsageScreen    embedded />;
    default:              return null;
  }
};

/** Derives the display value for a sublabel key from live settings. */
const getSublabel = (key: SettingsSectionConfig['items'][0]['sublabelKey'], settings: ReturnType<typeof useSettings>['settings']): string => {
  if (!key) return '';
  if (key === 'temperatureScale') return settings.temperatureScale === 'Imperial' ? '°F' : '°C';
  const v = settings[key];
  return typeof v === 'string' && v.trim() ? v : '';
};

const SettingsScreen = ({ onLogout }: Props) => {
  const nav = useAppNavigation();
  const { settings }                    = useSettings();
  const [activeScreen, setActiveScreen] = useState<ScreenKey>(DEFAULT_SCREEN);
  const [legalDoc, setLegalDoc]         = useState<'privacy' | 'terms' | null>(null);
  const [showLogout, setShowLogout]     = useState(false);

  // ── Detect desktop vs mobile via matchMedia ──────────────────────────────
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 601px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 601px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Action dispatcher ─────────────────────────────────────────────────────
  const dispatch = (action: SettingsAction) => {
    if (action.type === 'legal') { setLegalDoc(action.doc); return; }
    if (action.type === 'external') { window.open(action.url, '_blank', 'noopener,noreferrer'); return; }
    if (action.type === 'navigate') {
      if (action.to === 'closet') { nav.push('/closet'); return; }
      if (isDesktop) {
        setActiveScreen(action.to as ScreenKey);
      } else {
        nav.push(`/account/${action.to}`);
      }
    }
  };

  const handleLogoutConfirm = () => { onLogout(); nav.push('/login'); };

  // ── Sidebar shared across layouts ─────────────────────────────────────────
  const Sidebar = () => (
    <aside className={styles.sidebar}>
      <button className={styles.backBtn} onClick={() => nav.push('/')} aria-label="Back to home">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className={styles.sidebarHeader}>
        <div className={styles.avatar}>
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className={styles.sidebarTitle}>Account</span>
      </div>

      <nav className={styles.nav}>
        {SETTINGS_CONFIG.map(section => (
          <div key={section.title} className={styles.navSection}>
            <span className={styles.navSectionLabel}>{section.title}</span>
            {section.items.map(item => {
              const isActive = item.action.type === 'navigate' && item.action.to === activeScreen;
              return (
                <button key={item.key}
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => dispatch(item.action)}>
                  <span className={styles.navLabel}>{item.label}</span>
                  {item.sublabelKey && (
                    <span className={styles.navSublabel}>
                      {getSublabel(item.sublabelKey, settings)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <button className={styles.logoutBtn} onClick={() => setShowLogout(true)}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M13 10H3m0 0l3-3m-3 3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 5H6a2 2 0 00-2 2v6a2 2 0 002 2h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Log out
      </button>
    </aside>
  );

  return (
    <div className={styles.root}>

      {/* ── Desktop: sidebar + inline content ───────────────────────────── */}
      <div className={styles.desktopLayout}>
        <Sidebar />
        <main className={styles.main}>
          {renderScreen(activeScreen, onLogout)}
        </main>
      </div>

      {/* ── Mobile: back button header + flat list ────────────────────── */}
      <div className={styles.mobileLayout}>
        <header className={styles.mobileHeader}>
          <button className={styles.backBtn} onClick={() => nav.push('/')} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className={styles.mobileTitle}>Account</h1>
        </header>

        <div className={styles.list}>
          {SETTINGS_CONFIG.map(section => (
            <SettingsSection
              key={section.title}
              section={section}
              settings={settings}
              onAction={dispatch}
            />
          ))}
          <button className={styles.mobileLogoutBtn} onClick={() => setShowLogout(true)}>
            Log out
          </button>
        </div>
      </div>

      {/* ── Legal modal ─────────────────────────────────────────────────── */}
      {legalDoc === 'privacy' && <LegalModal doc={PRIVACY_POLICY} onClose={() => setLegalDoc(null)} />}
      {legalDoc === 'terms'   && <LegalModal doc={TERMS_OF_SERVICE} onClose={() => setLegalDoc(null)} />}

      {/* ── Logout confirmation ──────────────────────────────────────────── */}
      {showLogout && (
        <div className={styles.overlay}
          onClick={e => { if (e.target === e.currentTarget) setShowLogout(false); }}>
          <div className={styles.dialog}>
            <p className={styles.dialogTitle}>Log out?</p>
            <p className={styles.dialogBody}>You'll need to sign in again to access your wardrobe.</p>
            <div className={styles.dialogActions}>
              <button className={styles.dialogCancel} onClick={() => setShowLogout(false)}>Cancel</button>
              <button className={styles.dialogConfirm} onClick={handleLogoutConfirm}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
