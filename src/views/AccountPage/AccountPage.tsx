import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Settings, OutfitHistoryEntry } from '../../types';
import { auth, getToken, updateAuthUser, clearAuth } from '../../lib/auth';
import { storage } from '../../lib/storage';
import { useFormSubmit } from '../../hooks/useFormSubmit';
import { StatusMessage } from '../../components/shared';
import {
    loadHistory,
    deleteHistoryEntry,
    clearHistory,
} from '../../lib/outfitHistory';
import LegalModal from '../../components/LegalModal/LegalModal';
import {
    PRIVACY_POLICY,
    TERMS_OF_SERVICE,
    LegalDocument,
} from '../../config/legal';
import styles from './AccountPage.module.css';

const STYLES: string[] = [
    'Casual',
    'Business Casual',
    'Formal',
    'Urban',
    'Cozy',
    'Preppy',
];

type Tab = 'user' | 'preferences' | 'password' | 'history';

interface Props {
    settings: Settings;
    saveSettings: (s: Settings) => Promise<void>;
    onLogout: () => void;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const SliderField = ({
    label,
    value,
    unit,
    min,
    max,
    onChange,
}: {
    label: string;
    value: number;
    unit: string;
    min: number;
    max: number;
    onChange: (v: number) => void;
}) => (
    <div className={styles.sliderRow}>
        <div className={styles.sliderMeta}>
            <span className={styles.sliderLabel}>{label}</span>
            <span className={styles.sliderValue}>
                {value}
                {unit}
            </span>
        </div>
        <input
            type='range'
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className={styles.slider}
        />
    </div>
);

// ─── Tab: Profile ─────────────────────────────────────────────────────────────

const UserTab = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const { status, loading, submit } = useFormSubmit('Profile updated.');

    useEffect(() => {
        axios
            .get('/api/user/me', auth())
            .then(({ data }) => {
                setUsername(data.username ?? '');
                setEmail(data.email ?? '');
            })
            .catch(() => {});
    }, []);

    const save = () =>
        submit(async () => {
            await axios.put('/api/user/profile', { username, email }, auth());
            await updateAuthUser({ email, username });
        });

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>Profile</h2>
            <StatusMessage
                status={status}
                styles={styles}
            />
            <div className={styles.formGroup}>
                <label className={styles.label}>Username</label>
                <input
                    className={styles.input}
                    type='text'
                    placeholder='@yourname'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
                    className={styles.input}
                    type='email'
                    placeholder='you@example.com'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <button
                className={styles.saveBtn}
                onClick={save}
                disabled={loading}
            >
                {loading ? 'Saving…' : 'Save changes'}
            </button>
        </div>
    );
};

// ─── Tab: Preferences ────────────────────────────────────────────────────────

const PreferencesTab = ({
    settings,
    saveSettings,
}: {
    settings: Settings;
    saveSettings: (s: Settings) => Promise<void>;
}) => {
    const [clothingStyle, setClothingStyle] = useState(settings.clothingStyle);
    const [location, setLocation] = useState(settings.location);
    const [tempScale, setTempScale] = useState<'Imperial' | 'Metric'>(
        settings.temperatureScale as 'Imperial' | 'Metric',
    );
    const [hiTemp, setHiTemp] = useState(settings.hiTempThreshold);
    const [lowTemp, setLowTemp] = useState(settings.lowTempThreshold);
    const [humidity, setHumidity] = useState(settings.humidityPreference);
    const { status, loading, submit } = useFormSubmit(
        'Preferences saved.',
        2500,
    );

    const save = () =>
        submit(() =>
            saveSettings({
                clothingStyle,
                location,
                temperatureScale: tempScale,
                hiTempThreshold: hiTemp,
                lowTempThreshold: lowTemp,
                humidityPreference: humidity,
            }),
        );

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>Preferences</h2>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Style preference</h3>
                <div className={styles.chips}>
                    {STYLES.map((s) => (
                        <button
                            key={s}
                            className={`${styles.chip} ${clothingStyle === s ? styles.chipActive : ''}`}
                            onClick={() => setClothingStyle(s)}
                        >
                            {s}
                        </button>
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
                    onChange={(e) => setLocation(e.target.value)}
                />
            </section>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Temperature unit</h3>
                <div className={styles.segmented}>
                    <button
                        className={`${styles.seg} ${tempScale === 'Imperial' ? styles.segActive : ''}`}
                        onClick={() => setTempScale('Imperial')}
                    >
                        °F
                    </button>
                    <button
                        className={`${styles.seg} ${tempScale === 'Metric' ? styles.segActive : ''}`}
                        onClick={() => setTempScale('Metric')}
                    >
                        °C
                    </button>
                </div>
            </section>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Temperature feel</h3>
                <SliderField
                    label='Hot above'
                    value={hiTemp}
                    unit='°'
                    min={50}
                    max={120}
                    onChange={setHiTemp}
                />
                <SliderField
                    label='Cold below'
                    value={lowTemp}
                    unit='°'
                    min={0}
                    max={70}
                    onChange={setLowTemp}
                />
            </section>

            <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Humidity sensitivity</h3>
                <SliderField
                    label='Threshold'
                    value={humidity}
                    unit='%'
                    min={0}
                    max={100}
                    onChange={setHumidity}
                />
            </section>

            <StatusMessage
                status={status}
                styles={styles}
            />
            <button
                className={styles.saveBtn}
                onClick={save}
                disabled={loading}
            >
                Save changes
            </button>
        </div>
    );
};

// ─── Tab: Password ────────────────────────────────────────────────────────────

const PasswordTab = () => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { status, loading, submit, clearStatus } = useFormSubmit(
        'Password updated successfully.',
    );

    const save = () => {
        clearStatus();
        if (newPassword.length < 8) return;
        if (newPassword !== confirmPassword) return;
        submit(async () => {
            await axios.put('/api/user/password', { newPassword }, auth());
            setNewPassword('');
            setConfirmPassword('');
        });
    };

    // Inline validation messages (not from the hook)
    const validationMsg =
        newPassword && newPassword.length < 8
            ? 'Password must be at least 8 characters.'
            : confirmPassword && newPassword !== confirmPassword
              ? 'Passwords do not match.'
              : null;

    return (
        <div className={styles.tabContent}>
            <h2 className={styles.tabTitle}>Change Password</h2>
            {validationMsg ? (
                <p className={`${styles.statusMsg} ${styles.error}`}>
                    {validationMsg}
                </p>
            ) : (
                <StatusMessage
                    status={status}
                    styles={styles}
                />
            )}
            <div className={styles.formGroup}>
                <label className={styles.label}>New password</label>
                <input
                    className={styles.input}
                    type='password'
                    placeholder='At least 8 characters'
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label}>Confirm new password</label>
                <input
                    className={styles.input}
                    type='password'
                    placeholder='••••••••'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
            </div>
            <button
                className={styles.saveBtn}
                onClick={save}
                disabled={loading}
            >
                {loading ? 'Updating…' : 'Update password'}
            </button>
        </div>
    );
};

// ─── Tab: History ─────────────────────────────────────────────────────────────

const HistoryTab = () => {
    const [entries, setEntries] = useState<OutfitHistoryEntry[]>([]);
    const [confirmClear, setConfirmClear] = useState(false);

    useEffect(() => {
        loadHistory().then(setEntries);
    }, []);

    const handleDelete = async (id: string) => {
        await deleteHistoryEntry(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
    };

    const handleClearAll = async () => {
        await clearHistory();
        setEntries([]);
        setConfirmClear(false);
    };

    const formatDate = (iso: string): string => {
        const d = new Date(iso);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const sameDay = (a: Date, b: Date) =>
            a.getDate() === b.getDate() &&
            a.getMonth() === b.getMonth() &&
            a.getFullYear() === b.getFullYear();
        const time = d.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        if (sameDay(d, today)) return `Today, ${time}`;
        if (sameDay(d, yesterday)) return `Yesterday, ${time}`;
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${time}`;
    };

    return (
        <div className={styles.tabContent}>
            <div className={styles.historyHeader}>
                <h2 className={styles.tabTitle}>Outfit History</h2>
                {entries.length > 0 &&
                    (confirmClear ? (
                        <div className={styles.confirmRow}>
                            <span className={styles.confirmText}>
                                Clear all {entries.length} entries?
                            </span>
                            <button
                                className={styles.confirmYes}
                                onClick={handleClearAll}
                            >
                                Yes, clear
                            </button>
                            <button
                                className={styles.confirmNo}
                                onClick={() => setConfirmClear(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            className={styles.clearAllBtn}
                            onClick={() => setConfirmClear(true)}
                        >
                            Clear all
                        </button>
                    ))}
            </div>

            {entries.length === 0 ? (
                <div className={styles.historyEmpty}>
                    <svg
                        width='44'
                        height='44'
                        viewBox='0 0 24 24'
                        fill='none'
                    >
                        <path
                            d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                    <p className={styles.historyEmptyTitle}>
                        No outfits logged yet
                    </p>
                    <p className={styles.historyEmptyDesc}>
                        Tap <strong>Wore this today</strong> on the main screen
                        after getting a suggestion.
                    </p>
                </div>
            ) : (
                <div className={styles.historyList}>
                    {entries.map((entry, i) => (
                        <div
                            key={entry.id}
                            className={styles.historyCard}
                            style={{ animationDelay: `${i * 0.04}s` }}
                        >
                            <div className={styles.historyMeta}>
                                <span className={styles.historyDate}>
                                    {formatDate(entry.wornAt)}
                                </span>
                                <span className={styles.historyCloset}>
                                    <svg
                                        width='10'
                                        height='10'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                    >
                                        <path
                                            d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
                                            stroke='currentColor'
                                            strokeWidth='1.8'
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                        />
                                    </svg>
                                    {entry.closetName}
                                </span>
                            </div>
                            <p className={styles.historySummary}>
                                {entry.articleSummary}
                            </p>
                            <div className={styles.historyArticleCount}>
                                {entry.articleIds.length} piece
                                {entry.articleIds.length !== 1 ? 's' : ''}
                            </div>
                            <button
                                className={styles.historyDeleteBtn}
                                onClick={() => handleDelete(entry.id)}
                                aria-label='Remove entry'
                            >
                                <svg
                                    width='12'
                                    height='12'
                                    viewBox='0 0 16 16'
                                    fill='none'
                                >
                                    <path
                                        d='M4 4l8 8M12 4l-8 8'
                                        stroke='currentColor'
                                        strokeWidth='1.5'
                                        strokeLinecap='round'
                                    />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <p className={styles.historyNote}>
                Outfits logged in the last 3 days are deprioritised in new
                suggestions to keep things fresh.
            </p>
        </div>
    );
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
        id: 'user',
        label: 'Profile',
        icon: (
            <svg
                width='18'
                height='18'
                viewBox='0 0 20 20'
                fill='none'
            >
                <circle
                    cx='10'
                    cy='7'
                    r='3.5'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                />
                <path
                    d='M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                />
            </svg>
        ),
    },
    {
        id: 'preferences',
        label: 'Preferences',
        icon: (
            <svg
                width='18'
                height='18'
                viewBox='0 0 20 20'
                fill='none'
            >
                <path
                    d='M3 6h14M3 10h14M3 14h14'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                />
            </svg>
        ),
    },
    {
        id: 'history',
        label: 'History',
        icon: (
            <svg
                width='18'
                height='18'
                viewBox='0 0 20 20'
                fill='none'
            >
                <path
                    d='M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2zm0 4v4l3 3'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
            </svg>
        ),
    },
    {
        id: 'password',
        label: 'Password',
        icon: (
            <svg
                width='18'
                height='18'
                viewBox='0 0 20 20'
                fill='none'
            >
                <rect
                    x='4'
                    y='9'
                    width='12'
                    height='9'
                    rx='2'
                    stroke='currentColor'
                    strokeWidth='1.5'
                />
                <path
                    d='M7 9V6a3 3 0 016 0v3'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                />
            </svg>
        ),
    },
];

// ─── AccountPage ──────────────────────────────────────────────────────────────

const AccountPage = ({ settings, saveSettings, onLogout }: Props) => {
    const [activeTab, setActiveTab] = useState<Tab>('user');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const navigate = useNavigate();

    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [legalDoc, setLegalDoc] = useState<LegalDocument | null>(null);
    const handleLogout = () => {
        onLogout();
        navigate('/login');
    };

    const handleDeleteAccount = async () => {
        setDeleteLoading(true);
        setDeleteError(null);
        try {
            await axios.delete('/api/user/me', auth());
            await clearAuth();
            await storage.clear();
            onLogout();
            navigate('/login');
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response
                    ?.data?.error ??
                'Could not delete account. Please try again.';
            setDeleteError(msg);
            setDeleteLoading(false);
        }
    };

    return (
        <div className={styles.root}>
            {/* Logout confirmation modal */}
            {showLogoutModal && (
                <div
                    className={styles.modalOverlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget)
                            setShowLogoutModal(false);
                    }}
                >
                    <div className={styles.deleteModal}>
                        <div
                            className={styles.deleteModalIcon}
                            style={{
                                background: 'rgba(148,163,184,0.08)',
                                borderColor: 'rgba(148,163,184,0.2)',
                            }}
                        >
                            <svg
                                width='26'
                                height='26'
                                viewBox='0 0 24 24'
                                fill='none'
                            >
                                <path
                                    d='M16 17l5-5-5-5M21 12H9M13 5H5a2 2 0 00-2 2v10a2 2 0 002 2h8'
                                    stroke='rgba(148,163,184,0.85)'
                                    strokeWidth='1.5'
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                />
                            </svg>
                        </div>
                        <h3 className={styles.deleteModalTitle}>Log out?</h3>
                        <p className={styles.deleteModalBody}>
                            You'll need to sign in again to access your
                            wardrobe.
                        </p>
                        <div className={styles.deleteModalActions}>
                            <button
                                className={styles.deleteModalCancel}
                                onClick={() => setShowLogoutModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.logoutConfirmBtn}
                                onClick={handleLogout}
                            >
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {showDeleteModal && (
                <div
                    className={styles.modalOverlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowDeleteModal(false);
                            setDeleteError(null);
                        }
                    }}
                >
                    <div className={styles.deleteModal}>
                        <div className={styles.deleteModalIcon}>
                            <svg
                                width='26'
                                height='26'
                                viewBox='0 0 24 24'
                                fill='none'
                            >
                                <path
                                    d='M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'
                                    stroke='rgba(252,165,165,0.85)'
                                    strokeWidth='1.5'
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                />
                            </svg>
                        </div>
                        <h3 className={styles.deleteModalTitle}>
                            Delete account?
                        </h3>
                        <p className={styles.deleteModalBody}>
                            This permanently removes your account, all closets,
                            and all clothing articles. This action{' '}
                            <strong>cannot be undone</strong>.
                        </p>
                        {deleteError && (
                            <p className={styles.deleteModalError}>
                                {deleteError}
                            </p>
                        )}
                        <div className={styles.deleteModalActions}>
                            <button
                                className={styles.deleteModalCancel}
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteError(null);
                                }}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.deleteModalConfirm}
                                onClick={handleDeleteAccount}
                                disabled={deleteLoading}
                            >
                                {deleteLoading
                                    ? 'Deleting…'
                                    : 'Delete my account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Legal document modal */}
            {legalDoc && (
                <LegalModal
                    doc={legalDoc}
                    onClose={() => setLegalDoc(null)}
                />
            )}

            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <button
                    className={styles.backBtn}
                    onClick={() => navigate('/')}
                    aria-label='Back'
                >
                    <svg
                        width='18'
                        height='18'
                        viewBox='0 0 18 18'
                        fill='none'
                    >
                        <path
                            d='M11 14l-5-5 5-5'
                            stroke='currentColor'
                            strokeWidth='1.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                </button>

                <div className={styles.sidebarHeader}>
                    <div className={styles.avatar}>
                        <svg
                            width='28'
                            height='28'
                            viewBox='0 0 20 20'
                            fill='none'
                        >
                            <circle
                                cx='10'
                                cy='7'
                                r='3.5'
                                stroke='currentColor'
                                strokeWidth='1.5'
                                strokeLinecap='round'
                            />
                            <path
                                d='M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6'
                                stroke='currentColor'
                                strokeWidth='1.5'
                                strokeLinecap='round'
                            />
                        </svg>
                    </div>
                    <span className={styles.sidebarTitle}>Account</span>
                </div>

                <nav className={styles.nav}>
                    {TABS.map((tab) => (
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

                {/* Legal section */}
                <div className={styles.legalSection}>
                    <span className={styles.legalSectionLabel}>Legal</span>
                    <button
                        className={styles.legalItem}
                        onClick={() => setLegalDoc(PRIVACY_POLICY)}
                    >
                        <span className={styles.navIcon}>
                            <svg
                                width='16'
                                height='16'
                                viewBox='0 0 20 20'
                                fill='none'
                            >
                                <path
                                    d='M6 2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                                <path
                                    d='M7 7h6M7 10h6M7 13h4'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                            </svg>
                        </span>
                        <span className={styles.navLabel}>Privacy Policy</span>
                        <svg
                            className={styles.legalChevron}
                            width='12'
                            height='12'
                            viewBox='0 0 12 12'
                            fill='none'
                        >
                            <path
                                d='M4 2l4 4-4 4'
                                stroke='currentColor'
                                strokeWidth='1.4'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            />
                        </svg>
                    </button>
                    <button
                        className={styles.legalItem}
                        onClick={() => setLegalDoc(TERMS_OF_SERVICE)}
                    >
                        <span className={styles.navIcon}>
                            <svg
                                width='16'
                                height='16'
                                viewBox='0 0 20 20'
                                fill='none'
                            >
                                <path
                                    d='M6 2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                                <path
                                    d='M7 7h6M7 10h4'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                                <circle
                                    cx='14'
                                    cy='14'
                                    r='3'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                />
                                <path
                                    d='M14 13v1.5l1 1'
                                    stroke='currentColor'
                                    strokeWidth='1.2'
                                    strokeLinecap='round'
                                />
                            </svg>
                        </span>
                        <span className={styles.navLabel}>
                            Terms of Service
                        </span>
                        <svg
                            className={styles.legalChevron}
                            width='12'
                            height='12'
                            viewBox='0 0 12 12'
                            fill='none'
                        >
                            <path
                                d='M4 2l4 4-4 4'
                                stroke='currentColor'
                                strokeWidth='1.4'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            />
                        </svg>
                    </button>
                </div>

                <button
                    className={styles.logoutBtn}
                    onClick={() => setShowLogoutModal(true)}
                >
                    <svg
                        width='16'
                        height='16'
                        viewBox='0 0 20 20'
                        fill='none'
                    >
                        <path
                            d='M13 10H3m0 0l3-3m-3 3l3 3'
                            stroke='currentColor'
                            strokeWidth='1.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                        <path
                            d='M9 5H6a2 2 0 00-2 2v6a2 2 0 002 2h3M13 7l3 3-3 3'
                            stroke='currentColor'
                            strokeWidth='1.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                    Log out
                </button>

                <button
                    className={styles.deleteAccountBtn}
                    onClick={() => setShowDeleteModal(true)}
                >
                    <svg
                        width='15'
                        height='15'
                        viewBox='0 0 20 20'
                        fill='none'
                    >
                        <path
                            d='M3 6h14M8 6V4h4v2M5 6l1 11h8l1-11'
                            stroke='currentColor'
                            strokeWidth='1.4'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                    Delete account
                </button>
            </aside>

            {/* Main content */}
            <main className={styles.main}>
                <div className={styles.mobileTabBar}>
                    {TABS.map((tab) => (
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

                {activeTab === 'user' && <UserTab />}
                {activeTab === 'preferences' && (
                    <PreferencesTab
                        settings={settings}
                        saveSettings={saveSettings}
                    />
                )}
                {activeTab === 'history' && <HistoryTab />}
                {activeTab === 'password' && <PasswordTab />}

                {/* Legal — shown only on mobile (sidebar version is hidden at <600px) */}
                <div className={styles.mobileLegalSection}>
                    <span className={styles.mobileLegalLabel}>Legal</span>
                    <button
                        className={styles.mobileLegalItem}
                        onClick={() => setLegalDoc(PRIVACY_POLICY)}
                    >
                        <span className={styles.mobileLegalIcon}>
                            <svg
                                width='16'
                                height='16'
                                viewBox='0 0 20 20'
                                fill='none'
                            >
                                <path
                                    d='M6 2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                                <path
                                    d='M7 7h6M7 10h6M7 13h4'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                            </svg>
                        </span>
                        <span className={styles.mobileLegalText}>
                            Privacy Policy
                        </span>
                        <svg
                            className={styles.mobileLegalChevron}
                            width='12'
                            height='12'
                            viewBox='0 0 12 12'
                            fill='none'
                        >
                            <path
                                d='M4 2l4 4-4 4'
                                stroke='currentColor'
                                strokeWidth='1.4'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            />
                        </svg>
                    </button>
                    <button
                        className={styles.mobileLegalItem}
                        onClick={() => setLegalDoc(TERMS_OF_SERVICE)}
                    >
                        <span className={styles.mobileLegalIcon}>
                            <svg
                                width='16'
                                height='16'
                                viewBox='0 0 20 20'
                                fill='none'
                            >
                                <path
                                    d='M6 2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                                <path
                                    d='M7 7h6M7 10h4'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                    strokeLinecap='round'
                                />
                                <circle
                                    cx='14'
                                    cy='14'
                                    r='3'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='1.4'
                                />
                                <path
                                    d='M14 13v1.5l1 1'
                                    stroke='currentColor'
                                    strokeWidth='1.2'
                                    strokeLinecap='round'
                                />
                            </svg>
                        </span>
                        <span className={styles.mobileLegalText}>
                            Terms of Service
                        </span>
                        <svg
                            className={styles.mobileLegalChevron}
                            width='12'
                            height='12'
                            viewBox='0 0 12 12'
                            fill='none'
                        >
                            <path
                                d='M4 2l4 4-4 4'
                                stroke='currentColor'
                                strokeWidth='1.4'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            />
                        </svg>
                    </button>
                </div>
            </main>
        </div>
    );
};

export default AccountPage;
