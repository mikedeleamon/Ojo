import { useState } from 'react';
import { StyleSheet, Modal, ScrollView, TextInput, Pressable, Image, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  const PickerField = ({ label, value, items, onValueChange }: {
    label: string; value: string; items: string[]; onValueChange: (v: string) => void;
  }) => (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <View style={st.pickerWrap}>
        <Picker selectedValue={value} onValueChange={onValueChange}
          style={st.picker} itemStyle={{ color: colors.textPrimary }}>
          <Picker.Item label="—" value="" color={colors.textMuted} />
          {items.map(i => <Picker.Item key={i} label={i} value={i} color={colors.textPrimary} />)}
        </Picker>
      </View>
    </View>
  );

  const Toggle = ({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) => (
    <Pressable style={[st.toggleChip, value && st.toggleChipActive]} onPress={onPress}>
      <Text style={[st.toggleChipText, value && st.toggleChipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={st.root} edges={['top','bottom']}>
        {/* Header */}
        <View style={st.header}>
          <Text style={st.title}>{isEditing ? 'Edit Article' : 'Add Article'}</Text>
          <Pressable style={st.closeBtn} onPress={onClose}>
            <Text style={st.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
          {error ? <View style={st.errorBox}><Text style={st.errorText}>{error}</Text></View> : null}

          {/* Image */}
          <View style={st.imageSection}>
            {form.imageUrl ? (
              <View style={st.previewWrap}>
                <Image source={{ uri: form.imageUrl }} style={st.preview} resizeMode="cover" />
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

          <PickerField label="Type *" value={form.clothingType} items={CLOTHING_TYPES} onValueChange={v => set('clothingType', v)} />
          <PickerField label="Category" value={form.clothingCategory} items={CATEGORIES} onValueChange={v => set('clothingCategory', v)} />

          {/* Top/Bottom */}
          <View style={st.field}>
            <Text style={st.label}>Top / Bottom</Text>
            <View style={st.pickerWrap}>
              <Picker selectedValue={form.topOrBottom} onValueChange={v => set('topOrBottom', v)} style={st.picker}>
                {['','Top','Bottom','Full body','Footwear','N/A'].map(v =>
                  <Picker.Item key={v} label={v || '—'} value={v} color={v ? colors.textPrimary : colors.textMuted} />
                )}
              </Picker>
            </View>
          </View>

          <PickerField label="Fabric" value={form.fabricType} items={FABRICS} onValueChange={v => set('fabricType', v)} />
          <PickerField label="Color"  value={form.color}      items={COLORS}   onValueChange={v => set('color', v)} />

          {/* Merchant */}
          <View style={st.field}>
            <Text style={st.label}>Merchant</Text>
            <TextInput style={st.input} placeholder="e.g. Zara"
              placeholderTextColor={colors.textMuted} value={form.merchant}
              onChangeText={v => set('merchant', v)} />
          </View>

          {/* Toggles */}
          <View style={st.toggleRow}>
            <Toggle label="Accessory"  value={form.isAccessory} onPress={() => set('isAccessory', !form.isAccessory)} />
            <Toggle label="Wrist wear" value={form.isWristWear} onPress={() => set('isWristWear', !form.isWristWear)} />
            <Toggle label="Ankle wear" value={form.isAnkleWear} onPress={() => set('isAnkleWear', !form.isAnkleWear)} />
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
  pickerWrap:    { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, overflow: 'hidden' },
  picker:        { color: colors.textPrimary },
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
});
