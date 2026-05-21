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
import { pickImage, captureImage } from '../../lib/imageService';
import { getErrorMessage } from '../../lib/auth';
import { ClothingArticle, ArticleFormData, BodyZone } from '../../types';
import { identifyClothing } from '../../services/clothingIdentifier';
import type { GarmentType, FabricGuess, DetectedColor } from '../../services/clothingIdentifier.types';
import { ColorTokens, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

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

// ─── Detection → Form mappings ────────────────────────────────────────────────
// Maps ML pipeline GarmentType to the form's clothingType values (TYPE_GROUPS).

const GARMENT_TO_FORM_TYPE: Partial<Record<GarmentType, string>> = {
  't-shirt':           'T-Shirt',
  'long-sleeve-shirt': 'Shirt',
  'dress-shirt':       'Shirt',
  'polo':              'Shirt',
  'tank-top':          'T-Shirt',
  'hoodie':            'Hoodie',
  'sweatshirt':        'Sweater',
  'sweater':           'Sweater',
  'cardigan':          'Sweater',
  'jacket':            'Jacket',
  'blazer':            'Jacket',
  'coat':              'Coat',
  'puffer':            'Jacket',
  'vest':              'Jacket',
  'jeans':             'Jeans',
  'pants':             'Pants',
  'shorts':            'Shorts',
  'leggings':          'Pants',
  'skirt':             'Skirt',
  'dress':             'Dress',
  'jumpsuit':          'Dress',
  'hat':               'Hat',
  'cap':               'Cap',
  'scarf':             'Scarf',
  'gloves':            'Gloves',
  'belt':              'Belt',
  'bag':               'Bag',
  'shoes':             'Shoes',
  'boots':             'Boots',
  'sneakers':          'Sneakers',
  'sandals':           'Sandals',
  'socks':             'Socks',
  'watch':             'Watch',
};

// Maps detected color names (from colorUtils) → the form's COLORS list.
const DETECTED_COLOR_TO_FORM: Record<string, string> = {
  'white': 'White', 'off-white': 'Cream', 'cream': 'Cream',
  'light gray': 'Grey', 'gray': 'Grey', 'charcoal': 'Grey', 'dark gray': 'Grey',
  'black': 'Black',
  'navy': 'Navy', 'dark blue': 'Navy', 'blue': 'Blue', 'light blue': 'Sky Blue',
  'sky blue': 'Sky Blue', 'cobalt': 'Cobalt', 'denim blue': 'Blue',
  'teal': 'Teal', 'turquoise': 'Teal',
  'forest green': 'Green', 'olive': 'Olive', 'green': 'Green', 'mint': 'Mint', 'sage': 'Sage',
  'red': 'Red', 'crimson': 'Crimson', 'burgundy': 'Burgundy', 'wine': 'Burgundy',
  'coral': 'Coral', 'orange': 'Orange', 'rust': 'Rust',
  'tan': 'Beige', 'camel': 'Beige', 'khaki': 'Khaki', 'beige': 'Beige',
  'brown': 'Brown', 'chocolate': 'Brown',
  'yellow': 'Yellow', 'mustard': 'Yellow',
  'pink': 'Pink', 'hot pink': 'Hot Pink', 'blush': 'Blush', 'mauve': 'Pink',
  'purple': 'Purple', 'lavender': 'Lavender', 'plum': 'Plum',
  'gold': 'Gold', 'silver': 'Silver',
};

// Extracts the best-matching form fabric from a detected fabric string.
function detectedFabricToForm(fabric: FabricGuess): string {
  const t = fabric.type.toLowerCase();
  if (t.includes('denim'))     return 'Denim';
  if (t.includes('leather'))   return 'Leather';
  if (t.includes('silk'))      return 'Silk';
  if (t.includes('linen'))     return 'Linen';
  if (t.includes('wool'))      return 'Wool';
  if (t.includes('cotton'))    return 'Cotton';
  if (t.includes('polyester')) return 'Polyester';
  if (t.includes('nylon') || t.includes('spandex') || t.includes('synthetic')) return 'Synthetic';
  return '';
}

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
  isAccessory:      a.isAccessory      ?? false,
  bodyZone:         a.bodyZone,
  merchant:         a.merchant         ?? '',
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
  onClose:      () => void;
  onSubmit:     (data: ArticleFormData) => Promise<void>;
  initialData?: ClothingArticle;
  onDelete?:    () => Promise<void>;
}

const ArticleModal = ({ onClose, onSubmit, initialData, onDelete }: Props) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeSt(colors), [colors]);
  const isEditing = !!initialData;
  const [form,       setForm]      = useState<ArticleFormData>(initialData ? toForm(initialData) : EMPTY);
  const [error,      setError]     = useState<string | null>(null);
  const [saving,     setSaving]    = useState(false);
  const [deleting,   setDeleting]  = useState(false);
  const [identifying,    setIdentifying]   = useState(false);
  const [topLabelText,   setTopLabelText]  = useState<string>('');

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

  const set = <K extends keyof ArticleFormData>(key: K, val: ArticleFormData[K]) =>
    setForm(f => ({ ...f, [key]: val }));

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
    if (result.uri) {
      set('imageUrl', result.uri);
      if (result.localUri && result.width && result.height) {
        runIdentification(result.localUri, result.width, result.height);
      }
    }
  };

  const handleCaptureImage = async () => {
    const result = await captureImage();
    if (result.error) { Alert.alert('Error', result.error); return; }
    if (result.uri) {
      set('imageUrl', result.uri);
      if (result.localUri && result.width && result.height) {
        runIdentification(result.localUri, result.width, result.height);
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

const makeSt = (colors: ColorTokens) => StyleSheet.create({
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
  imageButtons:         { flexDirection: 'row', gap: spacing.sm },
  imageBtn:             { flex: 1, paddingVertical: 7, paddingHorizontal: spacing.md, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' },
  imageBtnText:         { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },

  // Detection card
  detectionCard:        { width: '100%', backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, padding: spacing.sm, gap: 6 },
  detectionLabel:       { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  detectionHeadline:    { fontFamily: fonts.display, fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.semibold },
  detectionRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detectionChip:        { paddingVertical: 3, paddingHorizontal: 8, backgroundColor: colors.saveBtnBg, borderRadius: radius.pill },
  detectionChipText:    { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.saveBtnText, fontWeight: fontWeights.medium },
  detectionChipMuted:   { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
  detectionChipTextMuted: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.medium },
  detectionColors:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  detectionSwatchWrap:  { alignItems: 'center', gap: 3 },
  detectionSwatch:      { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.glassBorder },
  detectionSwatchLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.textMuted },
  detectionConfidence:  { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, marginTop: 2 },

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

  // Danger zone
  dangerSection: { borderTopWidth: 1, borderTopColor: colors.glassBorder, paddingTop: spacing.md },
  deleteBtn:     { paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg, alignItems: 'center' },
  deleteBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.dangerText, fontWeight: fontWeights.medium },

  // Footer
  footer:        { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.glassBorder },
  cancelBtn:     { flex: 1, paddingVertical: 14, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center' },
  cancelBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
  submitBtn:     { flex: 2, paddingVertical: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center' },
  submitBtnText: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
});
