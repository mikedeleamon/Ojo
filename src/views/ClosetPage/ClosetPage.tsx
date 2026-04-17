import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Closet } from '../../types';
import ClosetView from '../../components/ClosetView/ClosetView';
import { ArticleFormData } from '../../components/ArticleModal/ArticleModal';
import Loading from '../../components/Loading/Loading';
import styles from './ClosetPage.module.css';

const AUTH_KEY = 'ojo_auth';

const getToken = (): string | null => {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').token ?? null; }
  catch { return null; }
};

const auth = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

const ClosetPage = () => {
  const [closets, setClosets]   = useState<Closet[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState('');
  const navigate = useNavigate();
  const { search } = useLocation();
  const openId = new URLSearchParams(search).get('open') ?? undefined;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get<Closet[]>('/api/closets', auth())
      .then(({ data }) => setClosets(data))
      .catch(() => setError('Could not load closets. Is the server running?'))
      .finally(() => setLoading(false));
  }, []);

  // ── CRUD helpers ───────────────────────────────────────────────────────────
  const createCloset = useCallback(async (name: string) => {
    const { data } = await axios.post<Closet>('/api/closets', { name }, auth());
    setClosets(prev => [data, ...prev]);
  }, []);

  const renameCloset = useCallback(async (id: string, name: string) => {
    const { data } = await axios.put<Closet>(`/api/closets/${id}`, { name }, auth());
    setClosets(prev => prev.map(c => c._id === id ? data : c));
  }, []);

  const deleteCloset = useCallback(async (id: string) => {
    await axios.delete(`/api/closets/${id}`, auth());
    setClosets(prev => prev.filter(c => c._id !== id));
  }, []);

  const addArticle = useCallback(async (closetId: string, formData: ArticleFormData) => {
    const { data } = await axios.post<Closet>(`/api/closets/${closetId}/articles`, formData, auth());
    setClosets(prev => prev.map(c => c._id === closetId ? data : c));
  }, []);

  const removeArticle = useCallback(async (closetId: string, articleId: string) => {
    const { data } = await axios.delete<Closet>(`/api/closets/${closetId}/articles/${articleId}`, auth());
    setClosets(prev => prev.map(c => c._id === closetId ? data : c));
  }, []);

  const setPreferred = useCallback(async (id: string) => {
    const { data } = await axios.put<Closet>(`/api/closets/${id}/preferred`, {}, auth());
    setClosets(prev => prev.map(c => ({ ...c, isPreferred: c._id === data._id })));
  }, []);

  // ── Empty-state create ─────────────────────────────────────────────────────
  const handleFirstCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createCloset(newName.trim());
      setNewName('');
      setCreating(false);
    } catch { setError('Failed to create closet.'); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <Loading />;

  return (
    <div className={styles.root}>
      {/* Top bar */}
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className={styles.pageTitle}>My Closet</h1>
      </header>

      {error && <p className={styles.errorBanner}>{error}</p>}

      {/* Body */}
      {closets.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
                stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className={styles.emptyTitle}>Your closet is empty</h2>
          <p className={styles.emptyDesc}>Create your first closet to start organising your wardrobe.</p>

          {creating ? (
            <div className={styles.createForm}>
              <input
                autoFocus
                className={styles.createInput}
                placeholder="Give your closet a name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleFirstCreate(); if (e.key === 'Escape') setCreating(false); }}
              />
              <button className={styles.createBtn} onClick={handleFirstCreate}>Create</button>
              <button className={styles.cancelBtn} onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
            </div>
          ) : (
            <button className={styles.createCta} onClick={() => setCreating(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Create closet
            </button>
          )}
        </div>
      ) : (
        /* ── Closet view ──────────────────────────────────────────────────── */
        <ClosetView
          closets={closets}
          initialSelectedId={openId}
          onCreateCloset={createCloset}
          onRenameCloset={renameCloset}
          onDeleteCloset={deleteCloset}
          onAddArticle={addArticle}
          onRemoveArticle={removeArticle}
          onSetPreferred={setPreferred}
        />
      )}
    </div>
  );
};

export default ClosetPage;
