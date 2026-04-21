import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClosets } from '../../hooks/useClosets';
import ClosetView from '../../components/ClosetView/ClosetView';
import Loading from '../../components/Loading/Loading';
import styles from './ClosetPage.module.css';

const ClosetPage = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const openId = new URLSearchParams(search).get('open') ?? undefined;

  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState('');

  const {
    closets, loading, error,
    createCloset, renameCloset, deleteCloset,
    addArticle, editArticle, removeArticle, setPreferred,
  } = useClosets();

  const handleFirstCreate = async () => {
    if (!newName.trim()) return;
    await createCloset(newName.trim());
    setNewName('');
    setCreating(false);
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.root}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className={styles.pageTitle}>My Closet</h1>
      </header>

      {error && <p className={styles.errorBanner}>{error}</p>}

      {closets.length === 0 ? (
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
                onKeyDown={e => {
                  if (e.key === 'Enter') handleFirstCreate();
                  if (e.key === 'Escape') setCreating(false);
                }}
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
        <ClosetView
          closets={closets}
          initialSelectedId={openId}
          onCreateCloset={createCloset}
          onRenameCloset={renameCloset}
          onDeleteCloset={deleteCloset}
          onAddArticle={addArticle}
          onEditArticle={editArticle}
          onRemoveArticle={removeArticle}
          onSetPreferred={setPreferred}
        />
      )}
    </div>
  );
};

export default ClosetPage;
