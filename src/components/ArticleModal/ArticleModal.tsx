import { useState } from 'react';
import {
  StyleSheet, Modal, ScrollView, TextInput, Pressable,
  Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Path } from 'react-native-svg';
import { View, Text } from '../primitives';
import { pickImage } from '../../lib/imageService';
import { getErrorMessage } from '../../lib/auth';
import { ClothingArticle, ArticleFormData, BodyZone } from '../../types';
import { colors, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';

// ─── Type classification ───────────────────────────────────────────────────────
// Grouped for the visual picker — order determines display order in the form.

const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Tops',        types: ['T-Shirt', 'Shirt', 'Blouse'] },
  { label: 'Layers',      types: ['Sweater', 'Hoodie'] },
  { label: 'Bottoms',     types: ['Pants', 'Jeans', 'Shorts', 'Skirt'] },
  { label: 'Outerwear',   types: ['Jacket', 'Coat'] },
  { label: 'Full Body',   types: ['Dress'] },
  { label: 'Footwear',    types: ['Shoes', 'Sneakers', 'Boots', 'Sandals'] },
  { label: 'Accessories', types: ['Hat', 'Cap', 'Scarf', 'Gloves', 'Belt', 'Bag', 'Watch', 'Jewelry', 'Socks'] },
  { label: 'Other',       types: ['Other'] },
];

// Defaults inferred the moment a type is selected.
//  - topOrBottom  → always derived from type
//  - fabricType   → suggested only when the field is still empty (non-destructive)
//  - isAccessory  → fully driven by type for all known accessories
//  - bodyZone     → set for known accessories; cleared when switching to non-accessory
const TYPE_DEFAULTS: Record<string, Partial<ArticleFormData>> = {
  Shirt:    { topOrBottom: 'Top' },
  'T-Shirt':{ topOrBottom: 'Top',      fabricType: 'Cotton' },
  Blouse:   { topOrBottom: 'Top' },
  Sweater:  { topOrBottom: 'N/A',      fabricType: 'Wool'   },
  Hoodie:   { topOrBottom: 'N/A',      fabricType: 'Cotton' },
  Jacket:   { topOrBottom: 'Top' },
  Coat:     { topOrBottom: 'Top' },
  Pants:    { topOrBottom: 'Bottom' },
  Jeans:    { topOrBottom: 'Bottom',   fabricType: 'Denim'  },
  Shorts:   { topOrBottom: 'Bottom' },
  Skirt:    { topOrBottom: 'Bottom' },
  Dress:    { topOrBottom: 'Full body' },
  Shoes:    { topOrBottom: 'Footwear' },
  Sneakers: { topOrBottom: 'Footwear' },
  Boots:    { topOrBottom: 'Footwear' },
  Sandals:  { topOrBottom: 'Footwear' },
  Hat:      { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Head'    },
  Cap:      { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Head'    },
  Scarf:    { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Neck'    },
  Gloves:   { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Hand'    },
  Belt:     { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Waist'   },
  Bag:      { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Carried' },
  Watch:    { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Wrist'   },
  Jewelry:  { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Neck'    },
  Socks:    { topOrBottom: 'N/A', isAccessory: true, bodyZone: 'Ankle'   },
};

// Known types whose classification is unambiguous. For these, the manual
// Accessory toggle and Top/Bottom chip field are hidden — auto-derived from
// the type selection. Only 'Other' (and an unset type) need manual controls.
const KNOWN_TYPES = new Set(
  TYPE_GROUPS.flatMap(g => g.types).filter(t => t !== 'Other'),
);

// ─── Option lists ──────────────────────────────────────────────────────────────

const CATEGORIES: string[]  = ['Casual', 'Formal', 'Business Casual', 'Athletic', 'Lounge', 'Outdoor'];
const BODY_ZONES: BodyZone[] = ['Head', 'Neck', 'Wrist', 'Hand', 'Waist', 'Ankle', 'Carried'];
const FABRICS:    string[]   = ['Cotton', 'Wool', 'Linen', 'Silk', 'Polyester', 'Denim', 'Leather', 'Synthetic', 'Other'];
const TOP_BOTTOM: string[]   = ['Top', 'Bottom', 'Full body', 'Footwear', 'N/A'];

const COLORS: string[] = [
  // Neutrals
  'Black', 'White', 'Grey', 'Brown', 'Beige', 'Cream',
  // Metallics
  'Silver', 'Gold', 'Bronze', 'Rose Gold', 'Champagne',
  // Blues
  'Navy', 'Indigo', 'Cobalt', 'Blue', 'Electric Blue', 'Sky Blue', 'Periwinkle', 'Teal', 'Cyan', 'Baby Blue',
  // Greens
  'Green', 'Mint', 'Lime', 'Sage', 'Olive', 'Khaki',
  // Reds & warm
  'Red', 'Scarlet', 'Crimson', 'Burgundy', 'Orange', 'Coral', 'Peach', 'Rust', 'Yellow',
  // Purples & pinks
  'Purple', 'Plum', 'Lilac', 'Lavender', 'Pink', 'Rose', 'Dusty Rose', 'Blush', 'Magenta', 'Hot Pink', 'Fuchsia',
  // Other
  'Multi',
];

const SWATCH: Record<string, string> = {
  Black: '#1a1a1a', White: '#f0f0f0', Grey: '#9ca3af', Brown: '#92400e',
  Beige: '#d4b896', Cream: '#fef3c7',
  Silver: '#c0c0c0', Gold: '#d4af37', Bronze: '#a0785a',
  'Rose Gold': '#c9776a', Champagne: '#f4e4c1',
  Navy: '#1e3a5f', Indigo: '#4338ca', Cobalt: '#2563eb', Blue: '#3b82f6',
  'Electric Blue': '#0ea5e9', 'Sky Blue': '#38bdf8', Periwinkle: '#a5b4fc',
  Teal: '#0d9488', Cyan: '#06b6d4', 'Baby Blue': '#bae6fd',
  Green: '#22c55e', Mint: '#34d399', Lime: '#a3e635', Sage: '#86efac',
  Olive: '#65a30d', Khaki: '#a16207',
  Red: '#ef4444', Scarlet: '#f43f5e', Crimson: '#dc2626', Burgundy: '#9b1c1c',
  Orange: '#f97316', Coral: '#fb923c', Peach: '#fdba74', Rust: '#c2410c', Yellow: '#fbbf24',
  Purple: '#a855f7', Plum: '#7c3aed', Lilac: '#d8b4fe', Lavender: '#c4b5fd',
  Pink: '#f9a8d4', Rose: '#fb7185', 'Dusty Rose': '#fda4af', Blush: '#fecdd3',
  Magenta: '#e879f9', 'Hot Pink': '#ec4899', Fuchsia: '#d946ef',
};

// Diagonal highlight → midtone → shadow stops for each metallic finish.
const METALLIC_GRADIENTS: Record<string, readonly [string, string, ...string[]]> = {
  Silver:      ['#f2f2f2', '#c0c0c0', '#f5f5f5', '#8a8a8a'],
  Gold:        ['#fde68a', '#d4af37', '#f5e27a', '#b8860b'],
  Bronze:      ['#d4a271', '#8b5c2a', '#cd853f', '#7b3f15'],
  'Rose Gold': ['#f4c2b8', '#c9776a', '#eda99a', '#a0504a'],
  Champagne:   ['#f8f0d8', '#e4c96e', '#f5e8c0', '#c8a84b'],
};
const METALLIC_START = { x: 0.15, y: 0 } as const;
const METALLIC_END   = { x: 0.85, y: 1 } as const;

// ─── Default state + edit hydration ───────────────────────────────────────────

const EMPTY: ArticleFormData = {
  name: '', clothingType: '', topOrBottom: '', clothingCategory: '',
  fabricType: '', color: '', isAccessory: false, bodyZone: undefined,
  merchant: '', imageUrl: '',
};

const toForm = (a: ClothingArticle): ArticleFormData => ({
  name:             a.name             ?? '',
  clothingType:     a.clothingType     ?? '',
  topOrBottom:      a.topOrBottom      ?? '',
  clothingCategory: a.clothingCategory ?? '',
  fabricType:       a.fabricType       ?? '',
  color:            a.color            ?? '',
  isAccessory:      a.isAccessory      ?? false,
  bodyZone:         a.bodyZone,
  merchant:         a.merchant         ?? '',
  imageUrl:         a.imageUrl         ?? '',
});

// ─── Sub-components ───────────────────────────────────────────────────────────

// Four pie-slice quadrants: red · blue · green · yellow
const MultiSwatch = () => (
  <Svg width={28} height={28} viewBox='0 0 28 28'>
    <Path d='M14,14 L14,0 A14,14 0 0,1 28,14 Z' fill='#ef4444' />
    <Path d='M14,14 L28,14 A14,14 0 0,1 14,28 Z' fill='#3b82f6' />
    <Path d='M14,14 L14,28 A14,14 0 0,1 0,14 Z' fill='#22c55e' />
    <Path d='M14,14 L0,14 A14,14 0 0,1 14,0 Z' fill='#fbbf24' />
  </Svg>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text style={st.label}>{children}</Text>
);

// Grouped visual type picker — replaces the flat 26-item ActionSheet.
// Cross-platform (no ActionSheetIOS), always visible, one tap to select.
// Tapping the active type again does nothing — a type must always be set.
const TypePickerField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (type: string) => void;
}) => (
  <View style={st.field}>
    <FieldLabel>Type <Text style={st.required}>*</Text></FieldLabel>
    <View style={st.typeGroups}>
      {TYPE_GROUPS.map(group => (
        <View key={group.label} style={st.typeGroup}>
          <Text style={st.typeGroupLabel}>{group.label}</Text>
          <View style={st.chipGrid}>
            {group.types.map(type => (
              <Pressable
                key={type}
                style={[st.chip, value === type && st.chipActive]}
                onPress={() => { if (value !== type) onChange(type); }}
                accessibilityRole="radio"
                accessibilityLabel={type}
                accessibilityState={{ selected: value === type }}
              >
                <Text style={[st.chipText, value === type && st.chipTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  </View>
);

// Inline chip grid — all options visible, one tap to select / deselect
const ChipField = ({
  label, value, items, onValueChange, required = false,
}: {
  label: string; value: string; items: string[];
  onValueChange: (v: string) => void; required?: boolean;
}) => (
  <View style={st.field}>
    <FieldLabel>
      {label}{required && <Text style={st.required}> *</Text>}
    </FieldLabel>
    <View style={st.chipGrid}>
      {items.map(item => (
        <Pressable
          key={item}
          style={[st.chip, value === item && st.chipActive]}
          onPress={() => onValueChange(value === item ? '' : item)}
          accessibilityRole="radio"
          accessibilityLabel={item}
          accessibilityState={{ selected: value === item }}
        >
          <Text style={[st.chipText, value === item && st.chipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  </View>
);

// Color swatch dots — visual and compact
const ColorField = ({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) => (
  <View style={st.field}>
    <FieldLabel>
      Color{value ? <Text style={st.colorLabel}>  {value}</Text> : ''}
    </FieldLabel>
    <View style={st.swatchGrid}>
      {COLORS.map(c => (
        <Pressable
          key={c}
          onPress={() => onValueChange(value === c ? '' : c)}
          accessibilityLabel={c}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === c }}
          style={[st.swatchRing, value === c && st.swatchRingActive]}
        >
          {c === 'Multi' ? (
            <View style={st.swatch}><MultiSwatch /></View>
          ) : METALLIC_GRADIENTS[c] ? (
            <LinearGradient
              colors={METALLIC_GRADIENTS[c]}
              start={METALLIC_START}
              end={METALLIC_END}
              style={st.swatch}
            />
          ) : (
            <View style={[st.swatch, { backgroundColor: SWATCH[c] ?? colors.glassBg }]} />
          )}
        </Pressable>
      ))}
    </View>
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onClose:      () => void;
  onSubmit:     (data: ArticleFormData) => Promise<void>;
  initialData?: ClothingArticle;
}

const ArticleModal = ({ onClose, onSubmit, initialData }: Props) => {
  const isEditing = !!initialData;
  const [form,   setForm]   = useState<ArticleFormData>(initialData ? toForm(initialData) : EMPTY);
  const [error,  setError]  = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ArticleFormData>(key: K, val: ArticleFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  // Applies smart defaults when the clothing type changes.
  //  - topOrBottom is always overwritten (fully derived from type).
  //  - fabricType is updated when: (a) the field is empty, OR (b) it still holds the
  //    previous type's auto-suggested value — meaning the user never manually changed it.
  //    If the user explicitly picked a fabric, switching types preserves their choice.
  //  - isAccessory + bodyZone are set from TYPE_DEFAULTS for known accessories and
  //    cleared when switching to a non-accessory type.
  const handleTypeChange = (type: string) => {
    const newDefaults  = TYPE_DEFAULTS[type]              ?? {};
    const prevDefaults = TYPE_DEFAULTS[form.clothingType] ?? {};

    setForm(f => {
      // Fabric is considered "auto-set" if it's empty or still matches what the
      // previous type suggested. In that case, follow the new type's suggestion.
      // If the user picked something else themselves, leave it alone.
      const fabricIsAutoValue =
        f.fabricType === '' || f.fabricType === prevDefaults.fabricType;

      return {
        ...f,
        clothingType: type,
        topOrBottom:  newDefaults.topOrBottom ?? f.topOrBottom,
        fabricType:   fabricIsAutoValue ? (newDefaults.fabricType ?? '') : f.fabricType,
        isAccessory:  newDefaults.isAccessory ?? false,
        bodyZone:     newDefaults.isAccessory
                        ? (newDefaults.bodyZone ?? f.bodyZone)  // accessory → keep or set zone
                        : undefined,                             // non-accessory → clear zone
      };
    });
  };

  const handlePickImage = async () => {
    const result = await pickImage();
    if (result.error) { Alert.alert('Error', result.error); return; }
    if (result.uri) set('imageUrl', result.uri);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.clothingType) { setError('Clothing type is required.'); return; }
    setSaving(true);
    try { await onSubmit(form); }
    catch (err) { setError(getErrorMessage(err, 'Failed to save article.')); }
    finally { setSaving(false); }
  };

  // For all named types the classification is unambiguous — the manual Accessory
  // toggle and Top/Bottom chips are hidden. Only 'Other' (or no type yet) needs them.
  const typeIsAmbiguous = !KNOWN_TYPES.has(form.clothingType);

  return (
    <Modal visible animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <SafeAreaView style={st.root} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={st.header}>
          <Text style={st.title}>{isEditing ? 'Edit Article' : 'Add Article'}</Text>
          <Pressable style={st.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={st.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps='handled'>
          {error
            ? (
              <View
                style={st.errorBox}
                accessibilityLiveRegion="assertive"
                accessible={true}
                accessibilityLabel={error}
              >
                <Text style={st.errorText}>{error}</Text>
              </View>
            )
            : null}

          {/* Image */}
          <View style={st.imageSection}>
            {form.imageUrl ? (
              <View style={st.previewWrap}>
                <Image source={{ uri: form.imageUrl }} style={st.preview} resizeMode='cover' />
                <Pressable style={st.clearImg} onPress={() => set('imageUrl', '')} accessibilityRole="button">
                  <Text style={st.clearImgText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.imagePlaceholder}>
                <Text style={st.imagePlaceholderText}>No image</Text>
              </View>
            )}
            <Pressable style={st.pickImageBtn} onPress={handlePickImage} accessibilityRole="button">
              <Text style={st.pickImageBtnText}>📷 Pick from library</Text>
            </Pressable>
          </View>

          {/* Name */}
          <View style={st.field}>
            <FieldLabel>Name <Text style={st.optional}>(optional)</Text></FieldLabel>
            <TextInput
              style={st.input}
              placeholder='e.g. "Navy Peacoat"'
              placeholderTextColor={colors.textMuted}
              value={form.name}
              onChangeText={v => set('name', v)}
            />
          </View>

          {/* Type — grouped visual picker, cross-platform, replaces ActionSheet */}
          <TypePickerField value={form.clothingType} onChange={handleTypeChange} />

          {/* Top / Bottom — only shown for 'Other'; auto-derived for all known types */}
          {typeIsAmbiguous && (
            <ChipField
              label='Top / Bottom'
              value={form.topOrBottom}
              items={TOP_BOTTOM}
              onValueChange={v => set('topOrBottom', v)}
            />
          )}

          {/* Category */}
          <ChipField
            label='Category'
            value={form.clothingCategory}
            items={CATEGORIES}
            onValueChange={v => set('clothingCategory', v)}
          />

          {/* Fabric — auto-suggested for some types, always overridable */}
          <ChipField
            label='Fabric'
            value={form.fabricType}
            items={FABRICS}
            onValueChange={v => set('fabricType', v)}
          />

          {/* Color */}
          <ColorField value={form.color} onValueChange={v => set('color', v)} />

          {/* Merchant */}
          <View style={st.field}>
            <FieldLabel>Merchant</FieldLabel>
            <TextInput
              style={st.input}
              placeholder='e.g. Zara'
              placeholderTextColor={colors.textMuted}
              value={form.merchant}
              onChangeText={v => set('merchant', v)}
            />
          </View>

          {/* Accessory toggle — only for 'Other' / unset type.
              All named accessories set isAccessory automatically from the type. */}
          {typeIsAmbiguous && (
            <View style={st.field}>
              <FieldLabel>Classification</FieldLabel>
              <View style={st.chipGrid}>
                <Pressable
                  style={[st.chip, form.isAccessory && st.chipActive]}
                  onPress={() => setForm(f => ({
                    ...f,
                    isAccessory: !f.isAccessory,
                    bodyZone:    f.isAccessory ? undefined : f.bodyZone,
                  }))}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Accessory"
                  accessibilityState={{ checked: form.isAccessory }}
                >
                  <Text style={[st.chipText, form.isAccessory && st.chipTextActive]}>
                    Accessory
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Body Zone — only relevant (and visible) when the item is an accessory */}
          {form.isAccessory && (
            <ChipField
              label='Body Zone'
              value={form.bodyZone ?? ''}
              items={BODY_ZONES}
              onValueChange={v => set('bodyZone', (v as BodyZone) || undefined)}
            />
          )}
        </ScrollView>

        {/* Footer */}
        <View style={st.footer}>
          <Pressable style={st.cancelBtn} onPress={onClose} accessibilityRole="button">
            <Text style={st.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[st.submitBtn, saving && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={st.submitBtnText}>
              {saving
                ? (isEditing ? 'Saving…'       : 'Adding…')
                : (isEditing ? 'Save changes'   : 'Add to closet')}
            </Text>
          </Pressable>
        </View>

      </SafeAreaView>
    </Modal>
  );
};

export { ArticleFormData };
export default ArticleModal;

const st = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.bgDefault },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  title:         { fontFamily: fonts.display, fontSize: 24, color: colors.textPrimary },
  closeBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  closeBtnText:  { color: colors.textSecondary, fontSize: 14 },
  body:          { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  errorBox:      { padding: spacing.sm, backgroundColor: colors.errorBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.errorBorder },
  errorText:     { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.errorText },

  // Image
  imageSection:         { gap: spacing.sm, alignItems: 'center' },
  previewWrap:          { alignItems: 'center', gap: 8 },
  preview:              { width: 100, height: 100, borderRadius: radius.sm },
  clearImg:             { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: colors.dangerBg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.dangerBorder },
  clearImgText:         { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.dangerText },
  imagePlaceholder:     { width: 100, height: 100, borderRadius: radius.sm, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
  pickImageBtn:         { paddingVertical: 7, paddingHorizontal: spacing.md, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder },
  pickImageBtnText:     { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },

  // Fields
  field:         { gap: 6 },
  label:         { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  required:      { color: colors.errorText, textTransform: 'none' },
  optional:      { color: colors.textMuted, fontWeight: fontWeights.regular, textTransform: 'none' },
  colorLabel:    { color: colors.textSecondary, fontWeight: fontWeights.regular, textTransform: 'none', letterSpacing: 0 },
  input:         { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: spacing.md },

  // Chips
  chipGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:          { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.pill },
  chipActive:    { backgroundColor: colors.saveBtnBg, borderColor: colors.saveBtnBg },
  chipText:      { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  chipTextActive:{ color: colors.saveBtnText, fontWeight: fontWeights.semibold },

  // Type picker groups
  typeGroups:     { gap: 12 },
  typeGroup:      { gap: 5 },
  typeGroupLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: fontWeights.medium },

  // Color swatches
  swatchGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchRingActive:{ borderColor: colors.textPrimary },
  swatch:          { width: 26, height: 26, borderRadius: 13, overflow: 'hidden' },

  // Footer
  footer:        { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  cancelBtn:     { flex: 1, paddingVertical: 14, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' },
  cancelBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
  submitBtn:     { flex: 2, paddingVertical: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center' },
  submitBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
});
