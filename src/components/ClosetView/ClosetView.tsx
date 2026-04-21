import { useState, useMemo } from 'react';
import { Closet, ClothingArticle } from '../../types';
import ArticleModal, { ArticleFormData } from '../ArticleModal/ArticleModal';
import styles from './ClosetView.module.css';

interface Props {
    closets: Closet[];
    initialSelectedId?: string;
    onCreateCloset: (name: string) => Promise<void>;
    onRenameCloset: (id: string, name: string) => Promise<void>;
    onDeleteCloset: (id: string) => Promise<void>;
    onAddArticle: (closetId: string, data: ArticleFormData) => Promise<void>;
    onEditArticle: (
        closetId: string,
        articleId: string,
        data: ArticleFormData,
    ) => Promise<void>;
    onRemoveArticle: (closetId: string, articleId: string) => Promise<void>;
    onSetPreferred: (id: string) => Promise<void>;
}

const CATEGORIES = [
    'Casual',
    'Formal',
    'Business Casual',
    'Athletic',
    'Lounge',
    'Outdoor',
    'Sleepwear',
    'Urban',
];
const COLORS = [
    'Black',
    'White',
    'Grey',
    'Navy',
    'Blue',
    'Green',
    'Red',
    'Brown',
    'Beige',
    'Pink',
    'Yellow',
    'Purple',
    'Orange',
    'Multi',
];
const FABRICS = [
    'Cotton',
    'Wool',
    'Linen',
    'Silk',
    'Polyester',
    'Denim',
    'Leather',
    'Synthetic',
    'Other',
];

const CSS_COLORS: Record<string, string> = {
    Black: '#1a1a1a',
    White: '#f5f5f5',
    Grey: '#9ca3af',
    Navy: '#1e3a5f',
    Blue: '#3b82f6',
    Green: '#22c55e',
    Red: '#ef4444',
    Brown: '#92400e',
    Beige: '#d4b896',
    Pink: '#f9a8d4',
    Yellow: '#fbbf24',
    Purple: '#a855f7',
    Orange: '#f97316',
    Multi: 'linear-gradient(135deg,#f97316,#3b82f6,#22c55e)',
};

const ArticleCard = ({
    article,
    onRemove,
    onEdit,
}: {
    article: ClothingArticle;
    onRemove: () => void;
    onEdit: () => void;
}) => (
    <div className={styles.articleCard}>
        <div className={styles.articleImg}>
            {article.imageUrl ? (
                <img
                    src={article.imageUrl}
                    alt={article.name || article.clothingType}
                />
            ) : (
                <svg
                    width='24'
                    height='24'
                    viewBox='0 0 24 24'
                    fill='none'
                >
                    <path
                        d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
                        stroke='currentColor'
                        strokeWidth='1.5'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                </svg>
            )}
        </div>
        <div className={styles.articleInfo}>
            <span className={styles.articleName}>
                {article.name || article.clothingType}
            </span>
            <span className={styles.articleMeta}>
                {[article.clothingType, article.color, article.fabricType]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
            {article.clothingCategory && (
                <span className={styles.categoryTag}>
                    {article.clothingCategory}
                </span>
            )}
            {article.merchant && (
                <span className={styles.articleMerchant}>
                    {article.merchant}
                </span>
            )}
        </div>
        {article.color && CSS_COLORS[article.color] && (
            <span
                className={styles.colorDot}
                style={{ background: CSS_COLORS[article.color] }}
                title={article.color}
            />
        )}
        <button
            className={styles.editBtn}
            onClick={onEdit}
            aria-label='Edit article'
        >
            <svg
                width='13'
                height='13'
                viewBox='0 0 16 16'
                fill='none'
            >
                <path
                    d='M11.5 2.5l2 2-9 9H2.5v-2l9-9z'
                    stroke='currentColor'
                    strokeWidth='1.3'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
            </svg>
        </button>
        <button
            className={styles.removeBtn}
            onClick={onRemove}
            aria-label='Remove article'
        >
            <svg
                width='14'
                height='14'
                viewBox='0 0 18 18'
                fill='none'
            >
                <path
                    d='M4 4l10 10M14 4L4 14'
                    stroke='currentColor'
                    strokeWidth='1.5'
                    strokeLinecap='round'
                />
            </svg>
        </button>
    </div>
);

const Chip = ({
    label,
    active,
    color,
    onClick,
}: {
    label: string;
    active: boolean;
    color?: string;
    onClick: () => void;
}) => (
    <button
        className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
        onClick={onClick}
    >
        {color && (
            <span
                className={styles.chipColor}
                style={{ background: color }}
            />
        )}
        {label}
    </button>
);

const ClosetView = ({
    closets,
    initialSelectedId,
    onCreateCloset,
    onRenameCloset,
    onDeleteCloset,
    onAddArticle,
    onEditArticle,
    onRemoveArticle,
    onSetPreferred,
}: Props) => {
    const [selectedId, setSelectedId] = useState<string>(
        initialSelectedId && closets.find((c) => c._id === initialSelectedId)
            ? initialSelectedId
            : (closets[0]?._id ?? ''),
    );
    const [showModal, setShowModal] = useState(false);
    const [editingArticle, setEditingArticle] =
        useState<ClothingArticle | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [actionErr, setActionErr] = useState<string | null>(null);

    const [query, setQuery] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [activeColors, setActiveColors] = useState<string[]>([]);
    const [activeFabrics, setActiveFabrics] = useState<string[]>([]);

    const selected = closets.find((c) => c._id === selectedId) ?? closets[0];
    const filterCount =
        activeCategories.length + activeColors.length + activeFabrics.length;
    const hasFilters = filterCount > 0;

    const clearFilters = () => {
        setActiveCategories([]);
        setActiveColors([]);
        setActiveFabrics([]);
        setQuery('');
    };

    const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
        set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

    const filteredArticles = useMemo((): ClothingArticle[] => {
        if (!selected) return [];
        let arts = selected.articles;
        if (query.trim()) {
            const q = query.toLowerCase();
            arts = arts.filter(
                (a) =>
                    a.name?.toLowerCase().includes(q) ||
                    a.clothingType.toLowerCase().includes(q) ||
                    a.color?.toLowerCase().includes(q) ||
                    a.fabricType?.toLowerCase().includes(q) ||
                    a.clothingCategory?.toLowerCase().includes(q) ||
                    a.merchant?.toLowerCase().includes(q),
            );
        }
        if (activeCategories.length > 0)
            arts = arts.filter(
                (a) =>
                    a.clothingCategory &&
                    activeCategories.includes(a.clothingCategory),
            );
        if (activeColors.length > 0)
            arts = arts.filter(
                (a) => a.color && activeColors.includes(a.color),
            );
        if (activeFabrics.length > 0)
            arts = arts.filter(
                (a) => a.fabricType && activeFabrics.includes(a.fabricType),
            );
        return arts;
    }, [selected, query, activeCategories, activeColors, activeFabrics]);

    const submitCreate = async () => {
        if (!newName.trim()) return;
        setActionErr(null);
        try {
            await onCreateCloset(newName.trim());
            setNewName('');
            setCreating(false);
        } catch {
            setActionErr('Failed to create closet.');
        }
    };

    const submitRename = async (id: string) => {
        if (!editName.trim()) return;
        setActionErr(null);
        try {
            await onRenameCloset(id, editName.trim());
            setEditingId(null);
        } catch {
            setActionErr('Failed to rename closet.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this closet and all its articles?')) return;
        setActionErr(null);
        try {
            await onDeleteCloset(id);
            if (selectedId === id)
                setSelectedId(closets.find((c) => c._id !== id)?._id ?? '');
        } catch {
            setActionErr('Failed to delete closet.');
        }
    };

    const handleAddArticle = async (data: ArticleFormData) => {
        await onAddArticle(selected._id, data);
        setShowModal(false);
    };

    const handleEditArticle = async (data: ArticleFormData) => {
        if (!editingArticle) return;
        await onEditArticle(selected._id, editingArticle._id, data);
        setEditingArticle(null);
    };

    return (
        <div className={styles.root}>
            {/* ── Sidebar ────────────────────────────────────────────────────────── */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHead}>
                    <span className={styles.sidebarLabel}>Closet</span>
                    <button
                        className={styles.iconBtn}
                        onClick={() => {
                            setCreating(true);
                            setEditingId(null);
                        }}
                        aria-label='New closet'
                    >
                        <svg
                            width='16'
                            height='16'
                            viewBox='0 0 16 16'
                            fill='none'
                        >
                            <path
                                d='M8 3v10M3 8h10'
                                stroke='currentColor'
                                strokeWidth='1.5'
                                strokeLinecap='round'
                            />
                        </svg>
                    </button>
                </div>

                {actionErr && <p className={styles.actionErr}>{actionErr}</p>}

                {creating && (
                    <div className={styles.inlineForm}>
                        <input
                            autoFocus
                            className={styles.inlineInput}
                            placeholder='Closet name…'
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submitCreate();
                                if (e.key === 'Escape') setCreating(false);
                            }}
                        />
                        <button
                            className={styles.inlineOk}
                            onClick={submitCreate}
                        >
                            Add
                        </button>
                        <button
                            className={styles.inlineCancel}
                            onClick={() => {
                                setCreating(false);
                                setNewName('');
                            }}
                        >
                            ✕
                        </button>
                    </div>
                )}

                <nav className={styles.closetList}>
                    {closets.map((c) => (
                        <div
                            key={c._id}
                            className={`${styles.closetCard} ${selectedId === c._id ? styles.closetCardActive : ''}`}
                            onClick={() => {
                                setSelectedId(c._id);
                                setEditingId(null);
                                clearFilters();
                            }}
                        >
                            {editingId === c._id ? (
                                <div
                                    className={styles.inlineForm}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        autoFocus
                                        className={styles.inlineInput}
                                        value={editName}
                                        onChange={(e) =>
                                            setEditName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter')
                                                submitRename(c._id);
                                            if (e.key === 'Escape')
                                                setEditingId(null);
                                        }}
                                    />
                                    <button
                                        className={styles.inlineOk}
                                        onClick={() => submitRename(c._id)}
                                    >
                                        ✓
                                    </button>
                                    <button
                                        className={styles.inlineCancel}
                                        onClick={() => setEditingId(null)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className={styles.closetCardMain}>
                                        <svg
                                            width='14'
                                            height='14'
                                            viewBox='0 0 24 24'
                                            fill='none'
                                            className={styles.hangerIcon}
                                        >
                                            <path
                                                d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
                                                stroke='currentColor'
                                                strokeWidth='1.5'
                                                strokeLinecap='round'
                                                strokeLinejoin='round'
                                            />
                                        </svg>
                                        <span className={styles.closetName}>
                                            {c.name}
                                        </span>
                                        {c.isPreferred && (
                                            <span
                                                className={
                                                    styles.preferredBadge
                                                }
                                            >
                                                ★
                                            </span>
                                        )}
                                        <span className={styles.closetCount}>
                                            {c.articles.length}
                                        </span>
                                    </div>
                                    <div
                                        className={styles.closetActions}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            className={`${styles.microBtn} ${c.isPreferred ? styles.microPreferredActive : styles.microPreferred}`}
                                            onClick={() =>
                                                onSetPreferred(c._id)
                                            }
                                            aria-label={
                                                c.isPreferred
                                                    ? 'Preferred'
                                                    : 'Set preferred'
                                            }
                                        >
                                            <svg
                                                width='12'
                                                height='12'
                                                viewBox='0 0 16 16'
                                                fill='none'
                                            >
                                                <path
                                                    d='M8 1l2.09 4.26L15 6.27l-3.5 3.41.83 4.82L8 12.17l-4.33 2.28.83-4.82L1 6.27l4.91-.01L8 1z'
                                                    stroke='currentColor'
                                                    strokeWidth='1.2'
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                    fill={
                                                        c.isPreferred
                                                            ? 'currentColor'
                                                            : 'none'
                                                    }
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            className={styles.microBtn}
                                            onClick={() => {
                                                setEditingId(c._id);
                                                setEditName(c.name);
                                            }}
                                            aria-label='Rename'
                                        >
                                            <svg
                                                width='12'
                                                height='12'
                                                viewBox='0 0 16 16'
                                                fill='none'
                                            >
                                                <path
                                                    d='M11.5 2.5l2 2-9 9H2.5v-2l9-9z'
                                                    stroke='currentColor'
                                                    strokeWidth='1.2'
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                />
                                            </svg>
                                        </button>
                                        <button
                                            className={`${styles.microBtn} ${styles.microDelete}`}
                                            onClick={() => handleDelete(c._id)}
                                            aria-label='Delete'
                                        >
                                            <svg
                                                width='12'
                                                height='12'
                                                viewBox='0 0 16 16'
                                                fill='none'
                                            >
                                                <path
                                                    d='M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9'
                                                    stroke='currentColor'
                                                    strokeWidth='1.2'
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </nav>
            </aside>

            {/* ── Main panel ─────────────────────────────────────────────────────── */}
            <main className={styles.main}>
                <div className={styles.mainHead}>
                    <h2 className={styles.closetTitle}>{selected?.name}</h2>
                    <button
                        className={styles.addArticleBtn}
                        onClick={() => setShowModal(true)}
                    >
                        <svg
                            width='15'
                            height='15'
                            viewBox='0 0 16 16'
                            fill='none'
                        >
                            <path
                                d='M8 3v10M3 8h10'
                                stroke='currentColor'
                                strokeWidth='1.5'
                                strokeLinecap='round'
                            />
                        </svg>
                        Add article
                    </button>
                </div>

                {/* ── Search + filter bar ──────────────────────────────────────────── */}
                <div className={styles.searchBar}>
                    <div className={styles.searchInputWrap}>
                        <svg
                            width='15'
                            height='15'
                            viewBox='0 0 18 18'
                            fill='none'
                            className={styles.searchIcon}
                        >
                            <circle
                                cx='7.5'
                                cy='7.5'
                                r='5.5'
                                stroke='currentColor'
                                strokeWidth='1.4'
                            />
                            <path
                                d='M12 12l4 4'
                                stroke='currentColor'
                                strokeWidth='1.4'
                                strokeLinecap='round'
                            />
                        </svg>
                        <input
                            className={styles.searchInput}
                            placeholder='Search articles…'
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        {query && (
                            <button
                                className={styles.clearSearch}
                                onClick={() => setQuery('')}
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
                        )}
                    </div>
                    <button
                        className={`${styles.filterToggleBtn} ${filterOpen ? styles.filterToggleBtnActive : ''}`}
                        onClick={() => setFilterOpen((v) => !v)}
                        aria-label='Toggle filters'
                    >
                        <svg
                            width='15'
                            height='15'
                            viewBox='0 0 18 18'
                            fill='none'
                        >
                            <path
                                d='M2 4h14M5 9h8M8 14h2'
                                stroke='currentColor'
                                strokeWidth='1.5'
                                strokeLinecap='round'
                            />
                        </svg>
                        {filterCount > 0 && (
                            <span className={styles.filterBadge}>
                                {filterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── Filter panel ─────────────────────────────────────────────────── */}
                {filterOpen && (
                    <div className={styles.filterPanel}>
                        <div className={styles.filterGroup}>
                            <span className={styles.filterGroupLabel}>
                                Category
                            </span>
                            <div className={styles.chipRow}>
                                {CATEGORIES.map((c) => (
                                    <Chip
                                        key={c}
                                        label={c}
                                        active={activeCategories.includes(c)}
                                        onClick={() =>
                                            toggle(
                                                activeCategories,
                                                setActiveCategories,
                                                c,
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={styles.filterGroup}>
                            <span className={styles.filterGroupLabel}>
                                Color
                            </span>
                            <div className={styles.chipRow}>
                                {COLORS.map((c) => (
                                    <Chip
                                        key={c}
                                        label={c}
                                        active={activeColors.includes(c)}
                                        color={CSS_COLORS[c]}
                                        onClick={() =>
                                            toggle(
                                                activeColors,
                                                setActiveColors,
                                                c,
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                        <div className={styles.filterGroup}>
                            <span className={styles.filterGroupLabel}>
                                Fabric
                            </span>
                            <div className={styles.chipRow}>
                                {FABRICS.map((f) => (
                                    <Chip
                                        key={f}
                                        label={f}
                                        active={activeFabrics.includes(f)}
                                        onClick={() =>
                                            toggle(
                                                activeFabrics,
                                                setActiveFabrics,
                                                f,
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                        {hasFilters && (
                            <button
                                className={styles.clearFiltersBtn}
                                onClick={clearFilters}
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}

                {/* ── Results count ─────────────────────────────────────────────────── */}
                {(query || hasFilters) && selected?.articles.length > 0 && (
                    <p className={styles.resultsCount}>
                        {filteredArticles.length} of {selected.articles.length}{' '}
                        articles
                    </p>
                )}

                {/* ── Article grid ──────────────────────────────────────────────────── */}
                {selected?.articles.length === 0 ? (
                    <div className={styles.emptyArticles}>
                        <svg
                            width='40'
                            height='40'
                            viewBox='0 0 24 24'
                            fill='none'
                        >
                            <path
                                d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
                                stroke='currentColor'
                                strokeWidth='1'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            />
                        </svg>
                        <p>No articles yet</p>
                        <button
                            className={styles.addArticleBtn}
                            onClick={() => setShowModal(true)}
                        >
                            Add your first piece
                        </button>
                    </div>
                ) : filteredArticles.length === 0 ? (
                    <div className={styles.emptyArticles}>
                        <svg
                            width='36'
                            height='36'
                            viewBox='0 0 24 24'
                            fill='none'
                        >
                            <circle
                                cx='11'
                                cy='11'
                                r='7'
                                stroke='currentColor'
                                strokeWidth='1.5'
                            />
                            <path
                                d='M16.5 16.5L21 21'
                                stroke='currentColor'
                                strokeWidth='1.5'
                                strokeLinecap='round'
                            />
                        </svg>
                        <p>No matches found</p>
                        <button
                            className={styles.clearFiltersBtn}
                            onClick={clearFilters}
                        >
                            Clear search &amp; filters
                        </button>
                    </div>
                ) : (
                    <div className={styles.articleGrid}>
                        {filteredArticles.map((a) => (
                            <ArticleCard
                                key={a._id}
                                article={a}
                                onEdit={() => setEditingArticle(a)}
                                onRemove={() =>
                                    onRemoveArticle(selected._id, a._id)
                                }
                            />
                        ))}
                    </div>
                )}
            </main>

            {showModal && (
                <ArticleModal
                    onClose={() => setShowModal(false)}
                    onSubmit={handleAddArticle}
                />
            )}
            {editingArticle && (
                <ArticleModal
                    onClose={() => setEditingArticle(null)}
                    onSubmit={handleEditArticle}
                    initialData={editingArticle}
                />
            )}
        </div>
    );
};

export default ClosetView;
