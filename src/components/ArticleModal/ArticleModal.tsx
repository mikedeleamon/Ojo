import { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet, Modal, ScrollView, TextInput, Pressable,
  Image, Alert, AccessibilityInfo, findNodeHandle, View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Path } from 'react-native-svg';
import * as ImageManipulator from 'expo-image-manipulator';
import { View, Text } from '../primitives';
import { pickImage, captureImage, uploadImageToR2 } from '../../lib/imageService';
import { getErrorMessage } from '../../lib/auth';
import { ClothingArticle, ArticleFormData, BodyZone } from '../../types';
import { identifyClothing } from '../../services/clothingIdentifier';
import type { GarmentType, FabricGuess, DetectedColor } from '../../services/clothingIdentifier.types';
import { ColorTokens, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

import { CATEGORIES, COLORS, FABRICS, ARTICLE_GENDERS } from '../../lib/colors/palettes';
import {
  TYPE_GROUPS,
  TYPE_DEFAULTS,
  KNOWN_TYPES,
  GARMENT_TO_FORM_TYPE,
  DETECTED_COLOR_TO_FORM,
  detectedFabricToForm,
} from './detection';

const BODY_ZONES: BodyZone[] = ['Head', 'Neck', 'Wrist', 'Hand', 'Waist', 'Ankle', 'Carried'];
const TOP_BOTTOM: string[]   = ['Top', 'Bottom', 'Full body', 'Footwear', 'N/A'];

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

import {
  METALLIC_GRADIENTS,
  METALLIC_START,
  METALLIC_END,
} from '../../lib/colors/metallicGradients';
import { makeSt } from './ArticleModal.styles';

// ─── Default state + edit hydration ───────────────────────────────────────────

const EMPTY: ArticleFormData = {
  name: '', clothingType: '', topOrBottom: '', clothingCategory: '',
  fabricType: '', color: '', gender: 'Unisex', isAccessory: false, bodyZone: undefined,
  merchant: '', purchasePrice: undefined, imageUrl: '',
  detectedGarmentType: undefined, detectedColors: undefined,
  detectedFabric: undefined, identificationConfidence: undefined,
};

const toForm = (a: ClothingArticle): ArticleFormData => ({
  name:             a.name             ?? '',
  clothingType:     a.clothingType     ?? '',
  topOrBottom:      a.topOrBottom      ?? '',
  clothingCategory: a.clothingCategory ?? '',
  fabricType:       a.fabricType       ?? '',
  color:            a.color            ?? '',
  gender:           a.gender           ?? 'Unisex',
  isAccessory:      a.isAccessory      ?? false,
  bodyZone:         a.bodyZone,
  merchant:         a.merchant         ?? '',
  purchasePrice:    a.purchasePrice,
  imageUrl:         a.imageUrl         ?? '',
  detectedGarmentType:      a.detectedGarmentType,
  detectedColors:           a.detectedColors,
  detectedFabric:           a.detectedFabric,
  identificationConfidence: a.identificationConfidence,
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

const FieldLabel = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeSt(colors), [colors]);
  return <Text style={st.label}>{children}</Text>;
};

// Grouped visual type picker — replaces the flat 26-item ActionSheet.
// Cross-platform (no ActionSheetIOS), always visible, one tap to select.
// Tapping the active type again does nothing — a type must always be set.
const TypePickerField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (type: string) => void;
}) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeSt(colors), [colors]);
  return (
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
};

// Inline chip grid — all options visible, one tap to select / deselect
const ChipField = ({
  label, value, items, onValueChange, required = false,
}: {
  label: string; value: string; items: string[];
  onValueChange: (v: string) => void; required?: boolean;
}) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeSt(colors), [colors]);
  return (
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
};

// Color swatch dots — visual and compact
const ColorField = ({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeSt(colors), [colors]);
  return (
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
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
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
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  closetId:          string;
  onClose:           () => void;
  onSubmit:          (data: ArticleFormData) => Promise<void>;
  initialData?:      ClothingArticle;
  onDelete?:         () => Promise<void>;
  // Pre-captured image from the tab-bar FAB — triggers auto-identification on mount
  initialImageData?: { uri: string; localUri: string; width: number; height: number } | null;
}

const ArticleModal = ({ closetId, onClose, onSubmit, initialData, onDelete, initialImageData }: Props) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeSt(colors), [colors]);
  const isEditing = !!initialData;
  const [form,       setForm]      = useState<ArticleFormData>(initialData ? toForm(initialData) : EMPTY);
  const [error,      setError]     = useState<string | null>(null);
  const [saving,     setSaving]    = useState(false);
  const [deleting,   setDeleting]  = useState(false);
  const [identifying,    setIdentifying]   = useState(false);
  const [previewError,   setPreviewError]  = useState(false);
  const [topLabelText,   setTopLabelText]  = useState<string>('');
  const uploadIgnoredRef = useRef(false);

  const headerRef = useRef<RNView>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      if (headerRef.current) {
        const node = findNodeHandle(headerRef.current);
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      }
    }, 350); // allow the slide animation to finish
    return () => clearTimeout(id);
  }, []);

  // When the tab-bar FAB provides a pre-captured image, kick off identification
  // and upload automatically so the form arrives pre-filled.
  useEffect(() => {
    if (!initialImageData) return;
    const { uri, localUri, width, height } = initialImageData;
    if (localUri && width && height) {
      runIdentification(localUri, width, height);
    }
    uploadImageToR2(uri, closetId).then(r2Url => {
      if (uploadIgnoredRef.current) return;
      if (r2Url) {
        set('imageUrl', r2Url);
      } else {
        Alert.alert('Upload failed', 'Could not upload the image. You can add one manually.');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  const set = <K extends keyof ArticleFormData>(key: K, val: ArticleFormData[K]) => {
    if (key === 'imageUrl') setPreviewError(false);
    setForm(f => ({ ...f, [key]: val }));
  };

  const runIdentification = async (localUri: string, width: number, height: number) => {
    setIdentifying(true);
    try {
      // Crop to the upper-centre of the frame: full width minus 10% margins,
      // but only the top 55% of height. This keeps the main garment (shirt,
      // jacket, hat, etc.) in view while excluding incidental trousers / shoes
      // that appear at the bottom of full-body product shots.
      const cropped = await ImageManipulator.manipulateAsync(
        localUri,
        [{ crop: { originX: width * 0.1, originY: height * 0.05, width: width * 0.8, height: height * 0.55 } }],
        { format: ImageManipulator.SaveFormat.JPEG },
      );
      const result = await identifyClothing(cropped.uri, { confidenceThreshold: 0.5, maxColors: 3 });

      // Debug — check Metro console to see what ML Kit + palette returned
      console.log('[Ojo] identification result:', JSON.stringify({
        garmentType:  result.garmentType,
        topLabelText: result.topLabelText,
        confidence:   result.confidence,
        colorsCount:  result.colors.length,
        colors:       result.colors,
        fabric:       result.fabric.type,
        rawLabels:    result.rawLabels.slice(0, 6).map(l => `${l.text} (${(l.confidence * 100).toFixed(0)}%)`),
      }, null, 2));

      setTopLabelText(result.topLabelText);

      setForm(f => {
        const next = {
          ...f,
          // Always store raw detection data
          detectedGarmentType:      result.garmentType,
          detectedColors:           result.colors,
          detectedFabric:           result.fabric,
          identificationConfidence: result.confidence,
        };

        // ── Auto-fill clothingType (+ cascading defaults) ──
        const formType = GARMENT_TO_FORM_TYPE[result.garmentType];
        if (formType && !f.clothingType) {
          next.clothingType = formType;
          const defaults = TYPE_DEFAULTS[formType] ?? {};
          next.topOrBottom  = defaults.topOrBottom  ?? f.topOrBottom;
          next.gender       = defaults.gender       ?? 'Unisex';
          next.isAccessory  = defaults.isAccessory  ?? false;
          next.bodyZone     = defaults.isAccessory
            ? (defaults.bodyZone as BodyZone ?? f.bodyZone)
            : undefined;
        }

        // ── Auto-fill color (most prominent detected color) ──
        if (!f.color && result.colors.length > 0) {
          const topColor = result.colors[0];
          const formColor = DETECTED_COLOR_TO_FORM[topColor.name];
          if (formColor) next.color = formColor;
        }

        // ── Auto-fill fabric ──
        if (!f.fabricType && result.fabric.type !== 'unknown') {
          const formFabric = detectedFabricToForm(result.fabric);
          if (formFabric) next.fabricType = formFabric;
        }

        return next;
      });
    } catch (err) {
      console.warn('[Ojo] identification failed:', err);
      // Non-fatal — item saves without detected fields
    } finally {
      setIdentifying(false);
    }
  };

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

      // Gender: follow the new type's default only when the current value still
      // matches the previous type's suggestion (i.e. user hasn't manually changed it).
      const genderIsAutoValue =
        f.gender === 'Unisex' || f.gender === prevDefaults.gender || f.gender === undefined;

      return {
        ...f,
        clothingType: type,
        topOrBottom:  newDefaults.topOrBottom ?? f.topOrBottom,
        fabricType:   fabricIsAutoValue ? (newDefaults.fabricType ?? '') : f.fabricType,
        gender:       genderIsAutoValue ? (newDefaults.gender ?? 'Unisex') : f.gender,
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
    if (result.uri) {
      if (result.localUri && result.width && result.height) {
        runIdentification(result.localUri, result.width, result.height);
      }
      // Upload to R2 and set the public URL
      const r2Url = await uploadImageToR2(result.uri, closetId);
      if (r2Url) {
        set('imageUrl', r2Url);
      } else {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      }
    }
  };

  const handleCaptureImage = async () => {
    const result = await captureImage();
    if (result.error) { Alert.alert('Error', result.error); return; }
    if (result.uri) {
      if (result.localUri && result.width && result.height) {
        runIdentification(result.localUri, result.width, result.height);
      }
      // Upload to R2 and set the public URL
      const r2Url = await uploadImageToR2(result.uri, closetId);
      if (r2Url) {
        set('imageUrl', r2Url);
      } else {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete?.(); }
    catch (err) { setError(getErrorMessage(err, 'Failed to delete article.')); }
    finally { setDeleting(false); }
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
          <RNView
            ref={headerRef}
            accessible={true}
            accessibilityLabel={isEditing ? 'Edit Article' : 'Add Article'}
          >
            <Text style={st.title}>{isEditing ? 'Edit Article' : 'Add Article'}</Text>
          </RNView>
          <Pressable
            style={st.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
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
            {form.imageUrl && !previewError ? (
              <View style={st.previewWrap}>
                <Image
                  source={{ uri: form.imageUrl }}
                  style={st.preview}
                  resizeMode='cover'
                  onError={() => setPreviewError(true)}
                />
                <Pressable style={st.clearImg} onPress={() => { uploadIgnoredRef.current = true; set('imageUrl', ''); }} accessibilityRole="button">
                  <Text style={st.clearImgText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <View style={st.imagePlaceholder}>
                <Text style={st.imagePlaceholderText}>
                  {previewError ? 'Image unavailable' : 'No image'}
                </Text>
              </View>
            )}

            {/* Photo source buttons */}
            <View style={st.imageButtons}>
              <Pressable style={st.imageBtn} onPress={handleCaptureImage} accessibilityRole="button">
                <Text style={st.imageBtnText}>📷 Camera</Text>
              </Pressable>
              <Pressable style={st.imageBtn} onPress={handlePickImage} accessibilityRole="button">
                <Text style={st.imageBtnText}>🖼 Library</Text>
              </Pressable>
            </View>

            {/* Detection results */}
            {(identifying || form.detectedGarmentType != null || (form.detectedColors && form.detectedColors.length > 0)) ? (
              <View style={st.detectionCard}>
                {identifying ? (
                  <Text style={st.detectionLabel}>🔍 Identifying…</Text>
                ) : (
                  <>
                    <Text style={st.detectionLabel}>✨ DETECTED</Text>

                    {/* Headline: e.g. "Red T-Shirt" */}
                    {(() => {
                      const colorName = form.detectedColors?.[0]
                        ? DETECTED_COLOR_TO_FORM[form.detectedColors[0].name] ?? form.detectedColors[0].name
                        : '';
                      // Prefer the mapped form-type name; fall back to raw ML Kit label text
                      const garmentName = form.detectedGarmentType && form.detectedGarmentType !== 'unknown'
                        ? (GARMENT_TO_FORM_TYPE[form.detectedGarmentType] ?? form.detectedGarmentType)
                        : topLabelText;
                      const headline = [colorName, garmentName].filter(Boolean).join(' ');
                      return headline ? (
                        <Text style={st.detectionHeadline}>{headline}</Text>
                      ) : null;
                    })()}

                    {/* Detail chips: fabric + confidence */}
                    <View style={st.detectionRow}>
                      {form.detectedFabric && form.detectedFabric.type !== 'unknown' && (
                        <View style={st.detectionChip}>
                          <Text style={st.detectionChipText}>{form.detectedFabric.type}</Text>
                        </View>
                      )}
                      {form.identificationConfidence != null && form.identificationConfidence > 0 && (
                        <View style={[st.detectionChip, st.detectionChipMuted]}>
                          <Text style={st.detectionChipTextMuted}>
                            {Math.round(form.identificationConfidence * 100)}% conf.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Color swatches */}
                    {form.detectedColors && form.detectedColors.length > 0 && (
                      <View style={st.detectionColors}>
                        {form.detectedColors.map((c, i) => (
                          <View key={i} style={st.detectionSwatchWrap}>
                            <View style={[st.detectionSwatch, { backgroundColor: c.hex }]} />
                            <Text style={st.detectionSwatchLabel}>{c.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            ) : null}
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
              accessibilityLabel="Name (optional)"
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

          {/* Gender — auto-set for Dress/Skirt/Blouse, always overridable */}
          <ChipField
            label='Gender'
            value={form.gender ?? 'Unisex'}
            items={[...ARTICLE_GENDERS]}
            onValueChange={v => set('gender', v || 'Unisex')}
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
              accessibilityLabel="Merchant"
            />
          </View>

          {/* Purchase Price — optional; unlocks cost-per-wear analytics */}
          <View style={st.field}>
            <FieldLabel>
              Purchase Price <Text style={st.optional}>(optional)</Text>
            </FieldLabel>
            <TextInput
              style={st.input}
              placeholder='e.g. 79.99'
              placeholderTextColor={colors.textMuted}
              keyboardType='decimal-pad'
              value={form.purchasePrice != null ? String(form.purchasePrice) : ''}
              onChangeText={v => {
                const parsed = parseFloat(v);
                set('purchasePrice', v === '' ? undefined : isNaN(parsed) ? undefined : parsed);
              }}
              accessibilityLabel="Purchase price in dollars (optional)"
            />
            {form.purchasePrice == null && (
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSizes.xs,
                  color: colors.textMuted,
                  marginTop: 2,
                }}
              >
                💡 Add a price to unlock cost-per-wear in Insights.
              </Text>
            )}
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

          {isEditing && onDelete && (
            <View style={st.dangerSection}>
              <Pressable
                style={[st.deleteBtn, deleting && { opacity: 0.5 }]}
                onPress={handleDelete}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel={deleting ? 'Deleting article' : 'Delete article'}
                accessibilityState={{ busy: deleting, disabled: deleting }}
              >
                <Text style={st.deleteBtnText}>
                  {deleting ? 'Deleting…' : 'Delete article'}
                </Text>
              </Pressable>
            </View>
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
            accessibilityLabel={saving
              ? (isEditing ? 'Saving' : 'Adding')
              : (isEditing ? 'Save changes' : 'Add to closet')}
            accessibilityState={{ busy: saving, disabled: saving }}
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

