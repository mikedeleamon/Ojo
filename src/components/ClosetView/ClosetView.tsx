import { useState } from 'react';
import { Closet, ClothingArticle } from '../../types';
import ArticleModal, { ArticleFormData } from '../ArticleModal/ArticleModal';
import styles from './ClosetView.module.css';

interface Props {
  closets:       Closet[];
  onCreateCloset:(name: string) => Promise<void>;
  onRenameCloset:(id: string, name: string) => Promise<void>;
  onDeleteCloset:(id: string) => Promise<void>;
  onAddArticle:  (closetId: string, data: ArticleFormData) => Promise<void>;
  onRemoveArticle:(closetId: string, articleId: string) => Promise<void>;
}

const ArticleCard = ({ article, onRemove }: { article: ClothingArticle; onRemove: () => void }) => (
  <div className={styles.articleCard}>
    <div className={styles.articleImg}>
      {article.imageUrl
        ? <img src={article.imageUrl} alt={article.name || article.clothingType} />
        : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )
      }
    </div>
    <div className={styles.articleInfo}>
      <span className={styles.articleName}>{article.name || article.clothingType}</span>
      <span className={styles.articleMeta}>
        {[article.clothingType, article.color, article.fabricType].filter(Boolean).join(' · ')}
      </span>
      {article.merchant && <span className={styles.articleMerchant}>{article.merchant}</span>}
    </div>
    <button className={styles.removeBtn} onClick={onRemove} aria-label="Remove article">
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
        <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  </div>
);

const ClosetView = ({ closets, onCreateCloset, onRenameCloset, onDeleteCloset, onAddArticle, onRemoveArticle }: Props) => {
  const [selectedId,   setSelectedId]   = useState<string>(closets[0]?._id ?? '');
  const [showModal,    setShowModal]     = useState(false);
  const [creating,     setCreating]      = useState(false);
  const [newName,      setNewName]       = useState('');
  const [editingId,    setEditingId]     = useState<string | null>(null);
  const [editName,     setEditName]      = useState('');
  const [actionErr,    setActionErr]     = useState<string | null>(null);

  const selected = closets.find(c => c._id === selectedId) ?? closets[0];

  // ── Closet creation ────────────────────────────────────────────────────────
  const submitCreate = async () => {
    if (!newName.trim()) return;
    setActionErr(null);
    try {
      await onCreateCloset(newName.trim());
      setNewName('');
      setCreating(false);
    } catch { setActionErr('Failed to create closet.'); }
  };

  // ── Rename ─────────────────────────────────────────────────────────────────
  const submitRename = async (id: string) => {
    if (!editName.trim()) return;
    setActionErr(null);
    try {
      await onRenameCloset(id, editName.trim());
      setEditingId(null);
    } catch { setActionErr('Failed to rename closet.'); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this closet and all its articles?')) return;
    setActionErr(null);
    try {
      await onDeleteCloset(id);
      if (selectedId === id) setSelectedId(closets.find(c => c._id !== id)?._id ?? '');
    } catch { setActionErr('Failed to delete closet.'); }
  };

  // ── Add article ────────────────────────────────────────────────────────────
  const handleAddArticle = async (data: ArticleFormData) => {
    await onAddArticle(selected._id, data);
    setShowModal(false);
  };

  return (
    <div className={styles.root}>
      {/* ── Left panel: closet list ────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarLabel}>Closets</span>
          <button className={styles.iconBtn} onClick={() => { setCreating(true); setEditingId(null); }} aria-label="New closet">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {actionErr && <p className={styles.actionErr}>{actionErr}</p>}

        {/* New closet inline form */}
        {creating && (
          <div className={styles.inlineForm}>
            <input
              autoFocus
              className={styles.inlineInput}
              placeholder="Closet name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreating(false); }}
            />
            <button className={styles.inlineOk} onClick={submitCreate}>Add</button>
            <button className={styles.inlineCancel} onClick={() => { setCreating(false); setNewName(''); }}>✕</button>
          </div>
        )}

        {/* Closet cards */}
        <nav className={styles.closetList}>
          {closets.map(c => (
            <div
              key={c._id}
              className={`${styles.closetCard} ${selectedId === c._id ? styles.closetCardActive : ''}`}
              onClick={() => { setSelectedId(c._id); setEditingId(null); }}
            >
              {editingId === c._id ? (
                <div className={styles.inlineForm} onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    className={styles.inlineInput}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename(c._id); if (e.key === 'Escape') setEditingId(null); }}
                  />
                  <button className={styles.inlineOk} onClick={() => submitRename(c._id)}>✓</button>
                  <button className={styles.inlineCancel} onClick={() => setEditingId(null)}>✕</button>
                </div>
              ) : (
                <>
                  <div className={styles.closetCardMain}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={styles.hangerIcon}>
                      <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className={styles.closetName}>{c.name}</span>
                    <span className={styles.closetCount}>{c.articles.length}</span>
                  </div>
                  <div className={styles.closetActions} onClick={e => e.stopPropagation()}>
                    <button className={styles.microBtn} onClick={() => { setEditingId(c._id); setEditName(c.name); }} aria-label="Rename">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <button className={`${styles.microBtn} ${styles.microDelete}`} onClick={() => handleDelete(c._id)} aria-label="Delete">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Right panel: articles ──────────────────────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.mainHead}>
          <h2 className={styles.closetTitle}>{selected?.name}</h2>
          <button className={styles.addArticleBtn} onClick={() => setShowModal(true)}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add article
          </button>
        </div>

        {selected?.articles.length === 0 ? (
          <div className={styles.emptyArticles}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
                stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p>No articles yet</p>
            <button className={styles.addArticleBtn} onClick={() => setShowModal(true)}>Add your first piece</button>
          </div>
        ) : (
          <div className={styles.articleGrid}>
            {selected.articles.map(a => (
              <ArticleCard
                key={a._id}
                article={a}
                onRemove={() => onRemoveArticle(selected._id, a._id)}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && <ArticleModal onClose={() => setShowModal(false)} onSubmit={handleAddArticle} />}
    </div>
  );
};

export default ClosetView;
