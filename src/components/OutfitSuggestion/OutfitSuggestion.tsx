import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Closet, CurrentWeather, Settings } from '../../types';
import { generateOutfits, OutfitRole, OutfitResult, ScoreBreakdown } from '../../lib/outfitEngine';
import { addHistoryEntry, recentlyWornIds } from '../../lib/outfitHistory';
import { updatePreferences } from '../../lib/userPreferences';
import styles from './OutfitSuggestion.module.css';

const AUTH_KEY = 'ojo_auth';
const getToken = (): string | null => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').token ?? null; }
  catch { return null; }
};
const authHeaders = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

// ─── Constants ────────────────────────────────────────────────────────────────

const CSS_COLORS: Record<string, string> = {
  Black: '#1a1a1a', White: '#f5f5f5', Grey: '#9ca3af', Navy: '#1e3a5f',
  Blue: '#3b82f6', Green: '#22c55e', Red: '#ef4444', Brown: '#92400e',
  Beige: '#d4b896', Pink: '#f9a8d4', Yellow: '#fbbf24', Purple: '#a855f7',
  Orange: '#f97316', Multi: 'linear-gradient(135deg, #f97316, #3b82f6, #22c55e)',
};

const ROLE_META: Record<OutfitRole, { label: string; icon: React.ReactNode }> = {
  top:       { label: 'Top',       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6l4-3h10l4 3-4 4v11H7V10L3 6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  bottom:    { label: 'Bottom',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v4l-4 12H8L4 8V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  fullBody:  { label: 'Outfit',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2a3 3 0 0 1 3 3v1l4 2v14H5V8l4-2V5a3 3 0 0 1 3-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  outerwear: { label: 'Outerwear', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 6l3-3 5 3 5-3 3 3v14H4V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  footwear:  { label: 'Footwear',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 16l4-8h4l1 4h9v4H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  accessory: { label: 'Extra',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ArticleThumb = ({ article, role }: { article: any; role: OutfitRole }) => {
  const meta = ROLE_META[role];
  return (
    <div className={styles.articleCard}>
      <div className={styles.articleImg}>
        {article.imageUrl
          ? <img src={article.imageUrl} alt={article.name || article.clothingType} />
          : <span className={styles.articleFallbackIcon}>{meta.icon}</span>
        }
        {article.color && (
          <span className={styles.colorDot} title={article.color}
            style={{ background: CSS_COLORS[article.color] ?? '#888' }} />
        )}
      </div>
      <div className={styles.articleLabel}>
        <span className={styles.roleLabel}>{meta.label}</span>
        <span className={styles.articleName}>{article.name || article.clothingType}</span>
        {article.fabricType && <span className={styles.articleMeta}>{article.fabricType}</span>}
      </div>
    </div>
  );
};

const ScoreBadge = ({ score }: { score: number }) => {
  const color =
    score >= 80 ? 'rgba(52,211,153,0.9)'  :
    score >= 60 ? 'rgba(251,191,36,0.9)'  :
                  'rgba(148,163,184,0.9)';
  return (
    <span className={styles.scoreBadge} style={{ color, borderColor: color }}>
      {score}
    </span>
  );
};

const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'fabric',     label: 'Weather' },
  { key: 'color',      label: 'Color'   },
  { key: 'style',      label: 'Style'   },
  { key: 'simplicity', label: 'Simple'  },
  { key: 'preference', label: 'You'     },
];

const ScoreBreakdownRow = ({ breakdown, expanded }: { breakdown: ScoreBreakdown; expanded: boolean }) => {
  if (!expanded) return null;
  return (
    <div className={styles.breakdownRow}>
      {BREAKDOWN_LABELS.map(({ key, label }) => (
        <div key={key} className={styles.breakdownItem}>
          <span className={styles.breakdownLabel}>{label}</span>
          <div className={styles.breakdownBar}>
            <div
              className={styles.breakdownFill}
              style={{ width: `${breakdown[key]}%` }}
            />
          </div>
          <span className={styles.breakdownValue}>{breakdown[key]}</span>
        </div>
      ))}
    </div>
  );
};

const PromptState = ({ icon, title, body, action }: {
  icon: React.ReactNode; title: string; body: string; action?: React.ReactNode;
}) => (
  <div className={styles.promptState}>
    <span className={styles.promptIcon}>{icon}</span>
    <p className={styles.promptTitle}>{title}</p>
    <p className={styles.promptBody}>{body}</p>
    {action}
  </div>
);

const HangerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { weather: CurrentWeather; settings: Settings; }

const OutfitSuggestion = ({ weather, settings }: Props) => {
  const [closets,      setClosets]      = useState<Closet[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [settingPref,  setSettingPref]  = useState(false);
  const [activeIdx,    setActiveIdx]    = useState(0);       // which of top-3 is shown
  const [showBreakdown,setShowBreakdown] = useState(false);
  const [wornLogged,   setWornLogged]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    axios.get<Closet[]>('/api/closets', authHeaders(token))
      .then(({ data }) => setClosets(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const preferred = useMemo(() => closets.find(c => c.isPreferred) ?? null, [closets]);

  const setPreferredCloset = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setSettingPref(true);
    try {
      const { data } = await axios.put<Closet>(`/api/closets/${id}/preferred`, {}, authHeaders(token));
      setClosets(prev => prev.map(c => ({ ...c, isPreferred: c._id === data._id })));
    } catch {}
    setSettingPref(false);
  };

  // Recently-worn IDs from history (last 3 days) — used for recency penalty
  const worn = useMemo(() => recentlyWornIds(3), []);

  // Generate top-3 outfits from the preferred closet
  const { outfits, status } = useMemo(() => {
    if (!preferred) return { outfits: [], status: 'no_preferred' as const };
    const { results, status } = generateOutfits(preferred.articles, weather, settings, worn, 3);
    return { outfits: results, status };
  }, [preferred, weather, settings, worn]);

  // Keep activeIdx in bounds when outfits list changes
  const safeIdx   = Math.min(activeIdx, Math.max(0, outfits.length - 1));
  const activeOutfit: OutfitResult | null = outfits[safeIdx] ?? null;

  // ── Log worn outfit ────────────────────────────────────────────────────────
  const handleWoreThis = () => {
    if (!preferred || !activeOutfit || activeOutfit.status !== 'ok') return;
    const articles    = activeOutfit.slots.map(s => s.article);
    const articleIds  = articles.map(a => a._id);
    const summary     = articles.map(a => a.name || a.clothingType).join(', ');

    // Update outfit history log
    addHistoryEntry({ closetId: preferred._id, closetName: preferred.name, articleIds, articleSummary: summary });
    // Update preference model
    updatePreferences(articles);

    setWornLogged(true);
    setTimeout(() => setWornLogged(false), 3000);
  };

  // ── Navigate to preferred closet ──────────────────────────────────────────
  const goToCloset = () =>
    navigate(preferred ? `/closet?open=${preferred._id}` : '/closet');

  // ── Render guards ──────────────────────────────────────────────────────────
  if (loading) return <div className={styles.root}><div className={styles.skeleton} /></div>;

  if (closets.length === 0) return (
    <div className={styles.root}>
      <PromptState icon={<HangerIcon />} title="No closet yet"
        body="Create a closet and add your clothes to get outfit suggestions."
        action={<button className={styles.ctaBtn} onClick={() => navigate('/closet')}>Create closet</button>} />
    </div>
  );

  if (!preferred) return (
    <div className={styles.root}>
      <p className={styles.sectionLabel}>Outfit</p>
      <PromptState icon={<HangerIcon />} title="Pick a preferred closet"
        body="Select a closet to use for daily outfit suggestions." />
      <div className={styles.closetPicker}>
        {closets.map(c => (
          <button key={c._id} className={styles.closetPickBtn}
            onClick={() => setPreferredCloset(c._id)} disabled={settingPref}>
            <HangerIcon />
            {c.name}
            <span className={styles.closetCount}>{c.articles.length}</span>
          </button>
        ))}
      </div>
    </div>
  );

  if (status === 'empty_closet') return (
    <div className={styles.root}>
      <div className={styles.badgeRow}>
        <PreferredBadge name={preferred.name} closetId={preferred._id} />
        <button className={styles.changePrefBtn} onClick={() => setClosets(p => p.map(c => ({ ...c, isPreferred: false })))}>change</button>
      </div>
      <PromptState icon={<HangerIcon />} title="This closet is empty"
        body="Add clothing articles to get outfit suggestions."
        action={<button className={styles.ctaBtn} onClick={goToCloset}>Add clothes</button>} />
    </div>
  );

  if (status === 'insufficient') return (
    <div className={styles.root}>
      <div className={styles.badgeRow}>
        <PreferredBadge name={preferred.name} closetId={preferred._id} />
        <button className={styles.changePrefBtn} onClick={() => setClosets(p => p.map(c => ({ ...c, isPreferred: false })))}>change</button>
      </div>
      <PromptState
        icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        title="Not enough to build an outfit"
        body="Add a top and a bottom (or a full-body piece) to get a suggestion."
        action={<button className={styles.ctaBtn} onClick={goToCloset}>Add more clothes</button>} />
    </div>
  );

  if (!activeOutfit) return null;

  return (
    <div className={styles.root}>
      {/* ── Header: preferred badge + score ─────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.badgeRow}>
          <PreferredBadge name={preferred.name} closetId={preferred._id} />
          <button className={styles.changePrefBtn} onClick={() => setClosets(p => p.map(c => ({ ...c, isPreferred: false })))}>change</button>
        </div>
        <ScoreBadge score={activeOutfit.score} />
      </div>

      {/* ── Top-3 outfit selector tabs ───────────────────────────────────── */}
      {outfits.length > 1 && (
        <div className={styles.outfitTabs}>
          {outfits.map((o, i) => (
            <button
              key={i}
              className={`${styles.outfitTab} ${i === safeIdx ? styles.outfitTabActive : ''}`}
              onClick={() => { setActiveIdx(i); setWornLogged(false); setShowBreakdown(false); }}
            >
              {i === 0 ? 'Best match' : `Option ${i + 1}`}
              <span className={styles.tabScore}>{o.score}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Headline ─────────────────────────────────────────────────────── */}
      <p className={styles.headline}>{activeOutfit.headline}</p>

      {/* ── Article grid ─────────────────────────────────────────────────── */}
      <div className={styles.articleGrid}>
        {activeOutfit.slots.map((slot, i) => (
          <ArticleThumb key={`${safeIdx}-${i}`} article={slot.article} role={slot.role} />
        ))}
      </div>

      {/* ── Score breakdown (expandable) ─────────────────────────────────── */}
      <button
        className={styles.breakdownToggle}
        onClick={() => setShowBreakdown(v => !v)}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        {showBreakdown ? 'Hide breakdown' : 'Score breakdown'}
        <svg className={`${styles.chevron} ${showBreakdown ? styles.chevronOpen : ''}`}
          width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <ScoreBreakdownRow breakdown={activeOutfit.scoreBreakdown} expanded={showBreakdown} />

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      {activeOutfit.notes.length > 0 && (
        <ul className={styles.notesList}>
          {activeOutfit.notes.map((n, i) => (
            <li key={i} className={styles.note}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {n}
            </li>
          ))}
        </ul>
      )}

      {/* ── Wore this today ───────────────────────────────────────────────── */}
      <button
        className={`${styles.woreThisBtn} ${wornLogged ? styles.woreThisLogged : ''}`}
        onClick={handleWoreThis}
        disabled={wornLogged}
      >
        {wornLogged ? (
          <>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Logged!
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zm0 3v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Wore this today
          </>
        )}
      </button>
    </div>
  );
};

// ─── Shared sub-component ─────────────────────────────────────────────────────

const PreferredBadge = ({ name, closetId }: { name: string; closetId: string }) => {
  const navigate = useNavigate();
  return (
    <button
      className={styles.preferredBadge}
      onClick={() => navigate(`/closet?open=${closetId}`)}
      title="Open this closet"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>{name}</span>
    </button>
  );
};

export default OutfitSuggestion;
