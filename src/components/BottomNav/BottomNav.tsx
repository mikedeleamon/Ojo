import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SunnyPng from '../../assets/images/weatherIcons/Sunny.png';
import styles from './BottomNav.module.css';

/**
 * Footer colour per page.
 *
 * Home (/) is intentionally absent — WeatherHUD owns --footer-bg for that
 * route and updates it with the live weather condition colour.
 *
 * All other pages use var(--bg-default) whose darkest gradient stop is #0F172A.
 * We match that stop directly so the footer sits flush with the page background.
 */
const ROUTE_FOOTER_COLORS: Record<string, string> = {
  '/closet':               'rgba(10, 15, 30, 0.97)',   // bg-default start #0F172A
  '/account':              'rgba(10, 15, 30, 0.97)',
  '/account/preferences':  'rgba(10, 15, 30, 0.97)',
};

/** Returns the footer colour for any route, falling back to the default dark. */
const footerColorForPath = (pathname: string): string | null => {
  // Exact matches first
  if (ROUTE_FOOTER_COLORS[pathname]) return ROUTE_FOOTER_COLORS[pathname];
  // All /account/* sub-routes (detail screens)
  if (pathname.startsWith('/account/')) return 'rgba(10, 15, 30, 0.97)';
  // Home — let WeatherHUD own --footer-bg, don't override
  if (pathname === '/') return null;
  // Any other route (onboarding, login, etc.) — default dark
  return 'rgba(10, 15, 30, 0.97)';
};

const TABS = [
  {
    key:   'home',
    label: 'Home',
    route: '/',
    icon:  ({ active }: { active: boolean }) => (
      <img src={SunnyPng} alt=""
        className={`${styles.imgIcon} ${active ? styles.imgIconActive : ''}`}
      />
    ),
  },
  {
    key:   'closet',
    label: 'Closet',
    route: '/closet',
    icon:  ({ active }: { active: boolean }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill={active ? 'currentColor' : 'none'}/>
        <path d="M12 5v3"/>
        <path d="M3 19l9-7 9 7"/>
        <path d="M2 19h20"/>
      </svg>
    ),
  },
  {
    key:   'preferences',
    label: 'Style',
    route: '/account/preferences',
    icon:  ({ active }: { active: boolean }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4l1.5 3L20 8.5 16.5 10 15 13l-1.5-3L10 8.5 13.5 7z"
          fill={active ? 'currentColor' : 'none'}/>
        <path d="M6 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"
          fill={active ? 'currentColor' : 'none'}/>
        <line x1="3" y1="3" x2="6" y2="6"/>
        <line x1="18" y1="18" x2="21" y2="21"/>
      </svg>
    ),
  },
  {
    key:   'account',
    label: 'Account',
    route: '/account',
    icon:  ({ active }: { active: boolean }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" fill={active ? 'currentColor' : 'none'}/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
] as const;

const isActive = (route: string, pathname: string): boolean => {
  if (route === '/') return pathname === '/';
  // Preferences must be exact — otherwise /account would also match
  if (route === '/account') return pathname === '/account';
  return pathname === route || pathname.startsWith(route + '/');
};

const BottomNav = () => {
  const navigate       = useNavigate();
  const { pathname }   = useLocation();

  // Update --footer-bg on every route change
  useEffect(() => {
    const color = footerColorForPath(pathname);
    if (color !== null) {
      document.documentElement.style.setProperty('--footer-bg', color);
    }
    // null → leave WeatherHUD's value in place (home page)
  }, [pathname]);

  return (
    <nav className={styles.nav} role="navigation" aria-label="Main navigation">
      {TABS.map(tab => {
        const active = isActive(tab.route, pathname);
        return (
          <button
            key={tab.key}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            onClick={() => navigate(tab.route)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.iconWrap}>
              <tab.icon active={active} />
            </span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
