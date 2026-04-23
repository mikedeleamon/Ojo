import { useState } from 'react';
import { ClothingArticle } from '../../types';
import { getErrorMessage } from '../../lib/auth';
import styles from './ArticleModal.module.css';

const CLOTHING_TYPES = ['Shirt', 'T-Shirt', 'Blouse', 'Sweater', 'Hoodie', 'Jacket', 'Coat',
  'Pants', 'Jeans', 'Shorts', 'Skirt', 'Dress', 'Shoes', 'Sneakers', 'Boots', 'Sandals',
  'Hat', 'Cap', 'Scarf', 'Gloves', 'Belt', 'Bag', 'Watch', 'Jewelry', 'Socks', 'Other'];

const CATEGORIES = ['Casual', 'Formal', 'Business Casual', 'Athletic', 'Lounge', 'Outdoor'];
const FABRICS    = ['Cotton', 'Wool', 'Linen', 'Silk', 'Polyester', 'Denim', 'Leather', 'Synthetic', 'Other'];
const COLORS     = ['Black', 'White', 'Grey', 'Navy', 'Blue', 'Green', 'Red', 'Brown', 'Beige', 'Pink', 'Yellow', 'Purple', 'Orange', 'Multi'];

export interface ArticleFormData {
  name:             string;
  clothingType:     string;
  topOrBottom:      string;
  clothingCategory: string;
  fabricType:       string;
  color:            string;
  isAccessory:      boolean;
  isWristWear:      boolean;
  isAnkleWear:      boolean;
  merchant:         string;
  imageUrl:         string;
}

interface Props {
  onClose:      () => void;
  onSubmit:     (data: ArticleFormData) => Promise<void>;
  /** When provided the modal opens in edit mode pre-populated with this article */
  initialData?: ClothingArticle;
}

const articleToForm = (a: ClothingArticle): ArticleFormData => ({
  name:             a.name             ?? '',
  clothingType:     a.clothingType     ?? '',
  topOrBottom:      a.topOrBottom      ?? '',
  clothingCategory: a.clothingCategory ?? '',
  fabricType:       a.fabricType       ?? '',
  color:            a.color            ?? '',
  isAccessory:      a.isAccessory      ?? false,
  isWristWear:      a.isWristWear      ?? false,
  isAnkleWear:      a.isAnkleWear      ?? false,
  merchant:         a.merchant         ?? '',
  imageUrl:         a.imageUrl         ?? '',
});

const empty: ArticleFormData = {
  name: '', clothingType: '', topOrBottom: '', clothingCategory: '',
  fabricType: '', color: '', isAccessory: false, isWristWear: false,
  isAnkleWear: false, merchant: '', imageUrl: '',
};

const ArticleModal = ({ onClose, onSubmit, initialData }: Props) => {
  const isEditing = !!initialData;

  const [form,    setForm]    = useState<ArticleFormData>(initialData ? articleToForm(initialData) : empty);
  const [preview, setPreview] = useState<string>(initialData?.imageUrl ?? '');
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const set = (key: keyof ArticleFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox'
    ? (e.target as HTMLInputElement).checked
    : e.target.value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.clothingType) { setError('Clothing type is required.'); return; }
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save article.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{isEditing ? 'Edit Article' : 'Add Article'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}

          {/* Image section */}
          <div className={styles.imageSection}>
            {preview ? (
              <div className={styles.previewWrap}>
                <img src={preview} alt="Preview" className={styles.preview} />
                <button className={styles.clearImg} onClick={() => { setPreview(''); setForm(f => ({ ...f, imageUrl: '' })); }}>
                  Remove
                </button>
              </div>
            ) : (
              <div className={styles.imagePlaceholder}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>No image</span>
              </div>
            )}

            <div className={styles.imgToggle}>
              <input
                className={styles.input}
                type="url"
                placeholder="https://..."
                value={form.imageUrl}
                onChange={e => { setForm(f => ({ ...f, imageUrl: e.target.value })); setPreview(e.target.value); }}
              />
            </div>
          </div>

          {/* Form grid */}
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>Name <span className={styles.optional}>(optional)</span></label>
              <input className={styles.input} type="text" placeholder='e.g. "Navy Peacoat"' value={form.name} onChange={set('name')} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Type <span className={styles.required}>*</span></label>
              <select className={styles.select} value={form.clothingType} onChange={set('clothingType')}>
                <option value="">Select type…</option>
                {CLOTHING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <select className={styles.select} value={form.clothingCategory} onChange={set('clothingCategory')}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Top / Bottom</label>
              <select className={styles.select} value={form.topOrBottom} onChange={set('topOrBottom')}>
                <option value="">—</option>
                <option value="Top">Top</option>
                <option value="Bottom">Bottom</option>
                <option value="Full body">Full body</option>
                <option value="Footwear">Footwear</option>
                <option value="N/A">N/A</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Fabric</label>
              <select className={styles.select} value={form.fabricType} onChange={set('fabricType')}>
                <option value="">Select fabric…</option>
                {FABRICS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Color</label>
              <select className={styles.select} value={form.color} onChange={set('color')}>
                <option value="">Select color…</option>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Merchant</label>
              <input className={styles.input} type="text" placeholder="e.g. Zara" value={form.merchant} onChange={set('merchant')} />
            </div>
          </div>

          {/* Toggles */}
          <div className={styles.toggleRow}>
            {([
              ['isAccessory', 'Accessory'],
              ['isWristWear', 'Wrist wear'],
              ['isAnkleWear', 'Ankle wear'],
            ] as [keyof ArticleFormData, string][]).map(([key, label]) => (
              <label key={key} className={styles.toggle}>
                <input type="checkbox" checked={form[key] as boolean} onChange={set(key)} className={styles.hidden} />
                <span className={`${styles.toggleChip} ${form[key] ? styles.toggleActive : ''}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.submitBtn} onClick={handleSubmit} disabled={saving}>
            {saving
              ? (isEditing ? 'Saving…' : 'Adding…')
              : (isEditing ? 'Save changes' : 'Add to closet')
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArticleModal;
