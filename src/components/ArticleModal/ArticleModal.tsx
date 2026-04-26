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
const CATEGORIES  = ['Casual','Formal','Business Casual','Athletic','Lounge','Outdoor'];
const FABRICS     = ['Cotton','Wool','Linen','Silk','Polyester','Denim','Leather','Synthetic','Other'];
const COLORS      = ['Black','White','Grey','Navy','Blue','Green','Red','Brown','Beige','Pink','Yellow','Purple','Orange','Multi'];
const TOP_BOTTOM  = ['Top','Bottom','Full body','Footwear','N/A'];

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

interface SheetState {
  label: string;
  items: string[];
  onSelect: (v: string) => void;
}

const ChevronRight = () => (
  <Svg width={14} height={14} viewBox='0 0 14 14' fill='none'>
    <Path d='M5 2l5 5-5 5' stroke={colors.textSecondary} strokeWidth={1.5}
      strokeLinecap='round' strokeLinejoin='round' opacity={0.5} />
  </Svg>
);

const ArticleModal = ({ onClose, onSubmit, initialData }: Props) => {
  const isEditing = !!initialData;
  const [form,    setForm]    = useState<ArticleFormData>(initialData ? toForm(initialData) : EMPTY);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [sheet,   setSheet]   = useState<SheetState | null>(null);

  const set = <K extends keyof ArticleFormData>(key: K, val: ArticleFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const openSelect = (label: string, items: string[], onValueChange: (v: string) => void) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', '—', ...items], cancelButtonIndex: 0, title: label },
        (i) => {
          if (i === 0) return;
          onValueChange(i === 1 ? '' : items[i - 2]);
        },
      );
    } else {
      setSheet({ label, items, onSelect: (v) => { onValueChange(v); setSheet(null); } });
    }
  };

  const SelectField = ({ label, value, items, onValueChange, required = false }: {
    label: string; value: string; items: string[];
    onValueChange: (v: string) => void; required?: boolean;
  }) => (
    <View style={st.field}>
      <Text style={st.label}>
        {label}{required ? ' *' : ''}
      </Text>
      <Pressable
        style={({ pressed }) => [st.selectRow, pressed && { opacity: 0.7 }]}
        onPress={() => openSelect(label, items, onValueChange)}
      >
        <Text style={[st.selectValue, !value && st.selectPlaceholder]}>
          {value || '—'}
        </Text>
        <ChevronRight />
      </Pressable>
    </View>
  );

  const Toggle = ({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) => (
    <Pressable style={[st.toggleChip, value && st.toggleChipActive]} onPress={onPress}>
      <Text style={[st.toggleChipText, value && st.toggleChipTextActive]}>{label}</Text>
    </Pressable>
  );

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
            <Text style={st.label}>Name <Text style={st.optional}>(optional)</Text></Text>
            <TextInput style={st.input} placeholder='e.g. "Navy Peacoat"'
              placeholderTextColor={colors.textMuted} value={form.name}
              onChangeText={v => set('name', v)} />
          </View>

          <SelectField label='Type' value={form.clothingType} items={CLOTHING_TYPES}
            onValueChange={v => set('clothingType', v)} required />
          <SelectField label='Category' value={form.clothingCategory} items={CATEGORIES}
            onValueChange={v => set('clothingCategory', v)} />
          <SelectField label='Top / Bottom' value={form.topOrBottom} items={TOP_BOTTOM}
            onValueChange={v => set('topOrBottom', v)} />
          <SelectField label='Fabric' value={form.fabricType} items={FABRICS}
            onValueChange={v => set('fabricType', v)} />
          <SelectField label='Color' value={form.color} items={COLORS}
            onValueChange={v => set('color', v)} />

          {/* Merchant */}
          <View style={st.field}>
            <Text style={st.label}>Merchant</Text>
            <TextInput style={st.input} placeholder='e.g. Zara'
              placeholderTextColor={colors.textMuted} value={form.merchant}
              onChangeText={v => set('merchant', v)} />
          </View>

          {/* Toggles */}
          <View style={st.toggleRow}>
            <Toggle label='Accessory'  value={form.isAccessory} onPress={() => set('isAccessory', !form.isAccessory)} />
            <Toggle label='Wrist wear' value={form.isWristWear} onPress={() => set('isWristWear', !form.isWristWear)} />
            <Toggle label='Ankle wear' value={form.isAnkleWear} onPress={() => set('isAnkleWear', !form.isAnkleWear)} />
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

        {/* Android option sheet */}
        {Platform.OS !== 'ios' && sheet && (
          <Modal transparent animationType='slide' onRequestClose={() => setSheet(null)}>
            <Pressable style={st.androidBackdrop} onPress={() => setSheet(null)} />
            <View style={st.androidSheet}>
              <View style={st.androidSheetHeader}>
                <Text style={st.androidSheetTitle}>{sheet.label}</Text>
                <Pressable style={st.closeBtn} onPress={() => setSheet(null)}>
                  <Text style={st.closeBtnText}>✕</Text>
                </Pressable>
              </View>
              <ScrollView>
                <Pressable style={st.androidOption} onPress={() => { sheet.onSelect(''); setSheet(null); }}>
                  <Text style={st.androidOptionText}>—</Text>
                </Pressable>
                {sheet.items.map(item => (
                  <Pressable key={item} style={st.androidOption} onPress={() => sheet.onSelect(item)}>
                    <Text style={st.androidOptionText}>{item}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Modal>
        )}
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
  preview:       { width: 120, height: 120, borderRadius: radius.sm },
  clearImg:      { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: colors.dangerBg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.dangerBorder },
  clearImgText:  { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.dangerText },
  imagePlaceholder: { width: 120, height: 120, borderRadius: radius.sm, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
  pickImageBtn:  { paddingVertical: 8, paddingHorizontal: spacing.md, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder },
  pickImageBtnText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  field:         { gap: 6 },
  label:         { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.medium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  optional:      { color: colors.textMuted, fontWeight: fontWeights.regular, textTransform: 'none' },
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
  toggleRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleChip:    { paddingVertical: 7, paddingHorizontal: 14, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.pill },
  toggleChipActive:     { backgroundColor: colors.saveBtnBg, borderColor: colors.saveBtnBg },
  toggleChipText:       { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  toggleChipTextActive: { color: colors.saveBtnText, fontWeight: fontWeights.semibold },
  footer:        { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  cancelBtn:     { flex: 1, paddingVertical: 14, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' },
  cancelBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
  submitBtn:     { flex: 2, paddingVertical: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center' },
  submitBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
  androidBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  androidSheet:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bgDefault, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, maxHeight: '60%' },
  androidSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  androidSheetTitle: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  androidOption: { paddingVertical: 14, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  androidOptionText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary },
});
