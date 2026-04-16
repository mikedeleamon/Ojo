import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import OjoLogo from '../../assets/images/logos/Ojo word logo 2.png';
import { Settings } from '../../types';
import styles from './OnboardingPage.module.css';

const AUTH_KEY       = 'ojo_auth';
const ONBOARD_KEY    = 'ojo_onboarding_done';

const getToken = (): string | null => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').token ?? null; }
  catch { return null; }
};
const auth = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

const STYLES     = ['Casual', 'Business Casual', 'Formal', 'Athletic', 'Streetwear', 'Minimalist'];
const TEMP_UNITS = ['Imperial', 'Metric'] as const;
const STEPS      = 4;

interface Props {
  settings:           Settings;
  saveSettings:       (s: Settings) => Promise<void>;
  setNeedsOnboarding: (v: boolean) => void;
}

// ─── Step indicators ──────────────────────────────────────────────────────────
const Dots = ({ step }: { step: number }) => (
  <div className={styles.dots}>
    {Array.from({ length: STEPS }).map((_, i) => (
      <span
        key={i}
        className={`${styles.dot} ${i < step ? styles.dotDone : ''} ${i === step - 1 ? styles.dotActive : ''}`}
      />
    ))}
  </div>
);

// ─── Individual step shells ───────────────────────────────────────────────────
const StepShell = ({ step, children }: { step: number; children: React.ReactNode }) => (
  <div className={styles.stepShell} key={step} style={{ animationDelay: '0.05s' }}>
    <Dots step={step} />
    {children}
  </div>
);

const OnboardingPage = ({ settings, saveSettings, setNeedsOnboarding }: Props) => {
  const navigate = useNavigate();
  const [step,        setStep]        = useState(1);
  const [direction,   setDirection]   = useState<'forward' | 'back'>('forward');
  const [animating,   setAnimating]   = useState(false);

  // Step 2 — closet creation
  const [closetName,  setClosetName]  = useState('My Wardrobe');
  const [closetDone,  setClosetDone]  = useState(false);
  const [closetId,    setClosetId]    = useState<string | null>(null);
  const [closetErr,   setClosetErr]   = useState<string | null>(null);
  const [closetLoading, setClosetLoading] = useState(false);

  // Step 3 — preferences
  const [styleChoice, setStyleChoice] = useState(settings.clothingStyle || 'Casual');
  const [tempUnit,    setTempUnit]    = useState<'Imperial' | 'Metric'>(
    (settings.temperatureScale as 'Imperial' | 'Metric') || 'Imperial'
  );

  const advance = (toStep: number) => {
    if (animating) return;
    setDirection('forward');
    setAnimating(true);
    setTimeout(() => {
      setStep(toStep);
      setAnimating(false);
    }, 260);
  };

  const goBack = (toStep: number) => {
    if (animating) return;
    setDirection('back');
    setAnimating(true);
    setTimeout(() => {
      setStep(toStep);
      setAnimating(false);
    }, 260);
  };

  // ── Create closet ──────────────────────────────────────────────────────────
  const handleCreateCloset = async () => {
    if (!closetName.trim()) return;
    setClosetLoading(true);
    setClosetErr(null);
    try {
      const { data } = await axios.post('/api/closets', { name: closetName.trim() }, auth());
      setClosetId(data._id);
      setClosetDone(true);
    } catch {
      setClosetErr('Could not create closet — you can create one later in My Closet.');
    } finally {
      setClosetLoading(false);
    }
  };

  // ── Save preferences & finish ──────────────────────────────────────────────
  const handleFinish = async () => {
    try {
      await saveSettings({
        ...settings,
        clothingStyle:    styleChoice,
        temperatureScale: tempUnit,
      });
    } catch { /* non-fatal */ }
    localStorage.setItem(ONBOARD_KEY, 'true');
    advance(4);
  };

  // ── Step 4 → navigate home after short pause ──────────────────────────────
  useEffect(() => {
    if (step === 4) {
      const t = setTimeout(() => {
        setNeedsOnboarding(false);
        navigate('/');
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [step, navigate, setNeedsOnboarding]);

  const slideClass = animating
    ? direction === 'forward' ? styles.slideOutLeft : styles.slideOutRight
    : direction === 'forward' ? styles.slideInRight : styles.slideInLeft;

  return (
    <div className={styles.root}>
      <div className={`${styles.card} ${slideClass}`}>

        {/* ── Step 1: Welcome ─────────────────────────────────────────────── */}
        {step === 1 && (
          <StepShell step={1}>
            <img src={OjoLogo} alt="Ojo" className={styles.logo} />
            <h1 className={styles.heading}>Welcome to Ojo</h1>
            <p className={styles.sub}>
              Let's take 60 seconds to set up your wardrobe so Ojo can suggest
              perfect outfits every day.
            </p>
            <div className={styles.illustrationRow}>
              {['👗','👔','👟','🧥'].map((e, i) => (
                <span key={i} className={styles.emoji} style={{ animationDelay: `${i * 0.12}s` }}>{e}</span>
              ))}
            </div>
            <button className={styles.primaryBtn} onClick={() => advance(2)}>
              Let's go
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <p className={styles.skipLink} onClick={() => { localStorage.setItem(ONBOARD_KEY, 'true'); setNeedsOnboarding(false); navigate('/'); }}>
              Skip setup
            </p>
          </StepShell>
        )}

        {/* ── Step 2: Create Closet ────────────────────────────────────────── */}
        {step === 2 && (
          <StepShell step={2}>
            <div className={styles.stepIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className={styles.stepHeading}>Name your first closet</h2>
            <p className={styles.stepDesc}>
              This will hold your clothes. You can create more later.
            </p>

            {closetDone ? (
              <div className={styles.successBadge}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" stroke="rgba(52,211,153,0.8)" strokeWidth="1.5"/>
                  <path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="rgba(52,211,153,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>"{closetName}" created!</span>
              </div>
            ) : (
              <>
                {closetErr && <p className={styles.errText}>{closetErr}</p>}
                <div className={styles.inputRow}>
                  <input
                    autoFocus
                    className={styles.textInput}
                    value={closetName}
                    onChange={e => setClosetName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateCloset()}
                    placeholder="My Wardrobe"
                  />
                </div>
                <button
                  className={styles.primaryBtn}
                  onClick={handleCreateCloset}
                  disabled={closetLoading || !closetName.trim()}
                >
                  {closetLoading ? 'Creating…' : 'Create closet'}
                </button>
              </>
            )}

            <div className={styles.navRow}>
              <button className={styles.ghostBtn} onClick={() => goBack(1)}>Back</button>
              <button
                className={styles.primaryBtn}
                onClick={() => advance(3)}
                disabled={!closetDone && !closetErr}
              >
                {closetErr ? 'Skip this step' : 'Next'}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </StepShell>
        )}

        {/* ── Step 3: Preferences ──────────────────────────────────────────── */}
        {step === 3 && (
          <StepShell step={3}>
            <div className={styles.stepIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className={styles.stepHeading}>Your preferences</h2>
            <p className={styles.stepDesc}>Help Ojo suggest outfits that match your style.</p>

            <div className={styles.prefSection}>
              <label className={styles.prefLabel}>Clothing style</label>
              <div className={styles.chipGrid}>
                {STYLES.map(s => (
                  <button
                    key={s}
                    className={`${styles.chip} ${styleChoice === s ? styles.chipActive : ''}`}
                    onClick={() => setStyleChoice(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.prefSection}>
              <label className={styles.prefLabel}>Temperature units</label>
              <div className={styles.segmented}>
                {TEMP_UNITS.map(u => (
                  <button
                    key={u}
                    className={`${styles.seg} ${tempUnit === u ? styles.segActive : ''}`}
                    onClick={() => setTempUnit(u)}
                  >
                    {u === 'Imperial' ? '°F Imperial' : '°C Metric'}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.navRow}>
              <button className={styles.ghostBtn} onClick={() => goBack(2)}>Back</button>
              <button className={styles.primaryBtn} onClick={handleFinish}>
                Finish setup
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </StepShell>
        )}

        {/* ── Step 4: Done ─────────────────────────────────────────────────── */}
        {step === 4 && (
          <StepShell step={4}>
            <div className={styles.doneIcon}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(52,211,153,0.8)" strokeWidth="1.5"/>
                <path d="M7.5 12l3 3 6-6" stroke="rgba(52,211,153,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className={styles.stepHeading}>You're all set!</h2>
            <p className={styles.stepDesc}>
              Taking you to your dashboard…
            </p>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
          </StepShell>
        )}

      </div>
    </div>
  );
};

export default OnboardingPage;
