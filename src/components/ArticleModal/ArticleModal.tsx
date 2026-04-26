import { useState } from 'react';
import {
  StyleSheet, Modal, ScrollView, TextInput, Pressable,
  Image, Alert, Platform, ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';
import { View, Text } from '../primitives';
import { pickImage } from '../../lib/imageService';
import { getErrorMessage } from '../../lib/auth';
import { ClothingArticle, ArticleFormData } from '../../types';
import { colors, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';

const CLOTHING_TYPES = ['Shirt','T-Shirt','Blouse','Sweater','Hoodie','Jacket','Coat',
  'Pants','Jeans','Shorts','Skirt','Dress','Shoes','Sneakers','Boots','Sandals',
  'Hat','Cap','Scarf','Gloves','Belt','Bag','Watch','Jewelry','Socks','Other'];
const CATEGORIES = ['Casual','Formal','Business Casual','Athletic','Lounge','Outdoor'];
const FABRICS    = ['Cotton','Wool','Linen','Silk','Polyester','Denim','Leather','Synthetic','Other'];
const COLORS     = ['Black','White','Grey','Navy','Blue','Green','Red','Brown','Beige','Pink','Yellow','Purple','Orange','Multi'];
const TOP_BOTTOM = ['Top','Bottom','Full body','Footwear','N/A'];

const SWATCH: Record<string, string> = {
  Black: '#1a1a1a', White: '#f0f0f0', Grey: '#9ca3af', Navy: '#1e3a5f',
  Blue: '#3b82f6', Green: '#22c55e', Red: '#ef4444', Brown: '#92400e',
  Beige: '#d4b896', Pink: '#f9a8d4', Yellow: '#fbbf24', Purple: '#a855f7',
  Orange: '#f97316',
};

// Four pie-slice quadrants: red · blue · green · yellow
const MultiSwatch = () => (
  <Svg width={28} height={28} viewBox='0 0 28 28'>
    <Path d='M14,14 L14,0 A14,14 0 0,1 28,14 Z' fill='#ef4444' />
    <Path d='M14,14 L28,14 A14,14 0 0,1 14,28 Z' fill='#3b82f6' />
    <Path d='M14,14 L14,28 A14,14 0 0,1 0,14 Z' fill='#22c55e' />
    <Path d='M14,14 L0,14 A14,14 0 0,1 14,0 Z' fill='#fbbf24' />
  </Svg>
);

const EMPTY: ArticleFormData = {
  name:'', clothingType:'', topOrBottom:'', clothingCategory:'',
  fabricType:'', color:'', isAccessory:false, isWristWear:false,
  isAnkleWear:false, merchant:'', imageUrl:'',
};

const toForm = (a: ClothingArticle): ArticleFormData => ({
  name: a.name ?? '', clothingType: a.clothingType ?? '', topOrBottom: a.topOrBottom ?? '',
  clothingCategory: a.clothingCategory ?? '', fabricType: a.fabricType ?? '',
  color: a.color ?? '', isAccessory: a.isAccessory ?? false,
  isWristWear: a.isWristWear ?? false, isAnkleWear: a.isAnkleWear ?? false,
  merchant: a.merchant ?? '', imageUrl: a.imageUrl ?? '',
});

interface Props {
  onClose:      () => void;
  onSubmit:     (data: ArticleFormData) => Promise<void>;
  initialData?: ClothingArticle;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ChevronRight = () => (
  <Svg width={14} height={14} viewBox='0 0 14 14' fill='none'>
    <Path d='M5 2l5 5-5 5' stroke={colors.textSecondary} strokeWidth={1.5}
      strokeLinecap='round' strokeLinejoin='round' opacity={0.5} />
  </Svg>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text style={st.label}>{children}</Text>
);

// Single tappable row → opens ActionSheet (for large option lists)
const SelectRow = ({ label, value, items, onValueChange, required = false }: {
  label: string; value: string; items: string[];
  onValueChange: (v: string) => void; required?: boolean;
}) => {
  const open = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', '—', ...items], cancelButtonIndex: 0, title: label },
        (i) => { if (i > 0) onValueChange(i === 1 ? '' : items[i - 2]); },
      );
    }
    // Android fallback could be added here if needed
  };

  return (
    <View style={st.field}>
      <FieldLabel>{label}{required ? ' *' : ''}</FieldLabel>
      <Pressable
        style={({ pressed }) => [st.selectRow, pressed && { opacity: 0.7 }]}
        onPress={open}
      >
        <Text style={[st.selectValue, !value && st.selectPlaceholder]}>
          {value || '—'}
        </Text>
        <ChevronRight />
      </Pressable>
    </View>
  );
};

// Inline chip grid — all options visible, one tap to select/deselect
const ChipField = ({ label, value, items, onValueChange, required = false }: {
  label: string; value: string; items: string[];
  onValueChange: (v: string) => void; required?: boolean;
}) => (
  <View style={st.field}>
    <FieldLabel>{label}{required ? ' *' : ''}</FieldLabel>
    <View style={st.chipGrid}>
      {items.map(item => (
        <Pressable
          key={item}
          style={[st.chip, value === item && st.chipActive]}
          onPress={() => onValueChange(value === item ? '' : item)}
        >
          <Text style={[st.chipText, value === item && st.chipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  </View>
);

// Color swatch dots — visual and compact
const ColorField = ({ value, onValueChange }: {
  value: string; onValueChange: (v: string) => void;
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
          style={[st.swatchRing, value === c && st.swatchRingActive]}
        >
          <View style={[
            st.swatch,
            c !== 'Multi' && { backgroundColor: SWATCH[c] ?? colors.glassBg },
          ]}>
            {c === 'Multi' && <MultiSwatch />}
          </View>
        </Pressable>
      ))}
    </View>
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────

const ArticleModal = ({ onClose, onSubmit, initialData }: Props) => {
  const isEditing = !!initialData;
  const [form,   setForm]   = useState<ArticleFormData>(initialData ? toForm(initialData) : EMPTY);
  const [error,  setError]  = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ArticleFormData>(key: K, val: ArticleFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }));

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

  return (
    <Modal visible animationType='slide' presentationStyle='pageSheet' onRequestClose={onClose}>
      <SafeAreaView style={st.root} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={st.header}>
          <Text style={st.title}>{isEditing ? 'Edit Article' : 'Add Article'}</Text>
          <Pressable style={st.closeBtn} onPress={onClose}>
            <Text style={st.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps='handled'>
          {error ? <View style={st.errorBox}><Text style={st.errorText}>{error}</Text></View> : null}

          {/* Image */}
          <View style={st.imageSection}>
            {form.imageUrl ? (
              <View style={st.previewWrap}>
                <Image source={{ uri: form.imageUrl }} style={st.preview} resizeMode='cover' />
                <Pressable style={st.clearImg} onPress={() => set('imageUrl', '')}>
                  <Text style={st.clearImgText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.imagePlaceholder}>
                <Text style={st.imagePlaceholderText}>No image</Text>
              </View>
            )}
            <Pressable style={st.pickImageBtn} onPress={handlePickImage}>
              <Text style={st.pickImageBtnText}>📷 Pick from library</Text>
            </Pressable>
          </View>

          {/* Name */}
          <View style={st.field}>
            <FieldLabel>Name <Text style={st.optional}>(optional)</Text></FieldLabel>
            <TextInput style={st.input} placeholder='e.g. "Navy Peacoat"'
              placeholderTextColor={colors.textMuted} value={form.name}
              onChangeText={v => set('name', v)} />
          </View>

          {/* Type — 26 items, keep as action sheet */}
          <SelectRow label='Type' value={form.clothingType} items={CLOTHING_TYPES}
            onValueChange={v => set('clothingType', v)} required />

          {/* Top / Bottom — 5 items, chips fit in one row */}
          <ChipField label='Top / Bottom' value={form.topOrBottom} items={TOP_BOTTOM}
            onValueChange={v => set('topOrBottom', v)} />

          {/* Category — 6 items */}
          <ChipField label='Category' value={form.clothingCategory} items={CATEGORIES}
            onValueChange={v => set('clothingCategory', v)} />

          {/* Fabric — 9 short words */}
          <ChipField label='Fabric' value={form.fabricType} items={FABRICS}
            onValueChange={v => set('fabricType', v)} />

          {/* Color — swatches */}
          <ColorField value={form.color} onValueChange={v => set('color', v)} />

          {/* Merchant */}
          <View style={st.field}>
            <FieldLabel>Merchant</FieldLabel>
            <TextInput style={st.input} placeholder='e.g. Zara'
              placeholderTextColor={colors.textMuted} value={form.merchant}
              onChangeText={v => set('merchant', v)} />
          </View>

          {/* Toggles */}
          <View style={st.chipGrid}>
            {([
              ['Accessory',  'isAccessory'],
              ['Wrist wear', 'isWristWear'],
              ['Ankle wear', 'isAnkleWear'],
            ] as const).map(([lbl, key]) => (
              <Pressable key={key}
                style={[st.chip, form[key] && st.chipActive]}
                onPress={() => set(key, !form[key])}>
                <Text style={[st.chipText, form[key] && st.chipTextActive]}>{lbl}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={st.footer}>
          <Pressable style={st.cancelBtn} onPress={onClose}>
            <Text style={st.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable style={[st.submitBtn, saving && { opacity: 0.5 }]} onPress={handleSubmit} disabled={saving}>
            <Text style={st.submitBtnText}>
              {saving ? (isEditing ? 'Saving…' : 'Adding…') : (isEditing ? 'Save changes' : 'Add to closet')}
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
  imageSection:  { gap: spacing.sm, alignItems: 'center' },
  previewWrap:   { alignItems: 'center', gap: 8 },
  preview:       { width: 100, height: 100, borderRadius: radius.sm },
  clearImg:      { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: colors.dangerBg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.dangerBorder },
  clearImgText:  { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.dangerText },
  imagePlaceholder: { width: 100, height: 100, borderRadius: radius.sm, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
  pickImageBtn:  { paddingVertical: 7, paddingHorizontal: spacing.md, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder },
  pickImageBtnText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  field:         { gap: 6 },
  label:         { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  optional:      { color: colors.textMuted, fontWeight: fontWeights.regular, textTransform: 'none' },
  colorLabel:    { color: colors.textSecondary, fontWeight: fontWeights.regular, textTransform: 'none', letterSpacing: 0 },
  input: {
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary,
    backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: spacing.md,
  },
  selectRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: spacing.md,
    backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: radius.sm,
  },
  selectValue:       { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary },
  selectPlaceholder: { color: colors.textMuted },
  chipGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:      { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.pill },
  chipActive:        { backgroundColor: colors.saveBtnBg, borderColor: colors.saveBtnBg },
  chipText:          { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  chipTextActive:    { color: colors.saveBtnText, fontWeight: fontWeights.semibold },
  swatchGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchRingActive: { borderColor: colors.textPrimary },
  swatch:         { width: 26, height: 26, borderRadius: 13, overflow: 'hidden' },
  footer:        { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  cancelBtn:     { flex: 1, paddingVertical: 14, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' },
  cancelBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
  submitBtn:     { flex: 2, paddingVertical: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center' },
  submitBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
});
