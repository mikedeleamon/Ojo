import type { ArticleFormData } from '../../types';
import type { GarmentType, FabricGuess } from '../../services/clothingIdentifier.types';

/**
 * Grouped clothing-type picker layout.
 * Order determines display order in the form.
 */
export const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Tops',        types: ['T-Shirt', 'Shirt', 'Blouse'] },
  { label: 'Layers',      types: ['Sweater', 'Hoodie'] },
  { label: 'Bottoms',     types: ['Pants', 'Jeans', 'Shorts', 'Skirt'] },
  { label: 'Outerwear',   types: ['Jacket', 'Coat'] },
  { label: 'Full Body',   types: ['Dress'] },
  { label: 'Footwear',    types: ['Shoes', 'Sneakers', 'Boots', 'Sandals'] },
  { label: 'Accessories', types: ['Hat', 'Cap', 'Scarf', 'Gloves', 'Belt', 'Bag', 'Watch', 'Jewelry', 'Socks'] },
  { label: 'Other',       types: ['Other'] },
];

/**
 * Defaults inferred when a type is selected.
 *  - topOrBottom  → always derived from type
 *  - fabricType   → suggested only when the field is still empty (non-destructive)
 *  - isAccessory  → fully driven by type for all known accessories
 *  - bodyZone     → set for known accessories; cleared when switching to non-accessory
 */
export const TYPE_DEFAULTS: Record<string, Partial<ArticleFormData>> = {
  Shirt:    { topOrBottom: 'Top' },
  'T-Shirt':{ topOrBottom: 'Top',      fabricType: 'Cotton' },
  Blouse:   { topOrBottom: 'Top', gender: "Women's" },
  Sweater:  { topOrBottom: 'N/A',      fabricType: 'Wool'   },
  Hoodie:   { topOrBottom: 'N/A',      fabricType: 'Cotton' },
  Jacket:   { topOrBottom: 'Top' },
  Coat:     { topOrBottom: 'Top' },
  Pants:    { topOrBottom: 'Bottom' },
  Jeans:    { topOrBottom: 'Bottom',   fabricType: 'Denim'  },
  Shorts:   { topOrBottom: 'Bottom' },
  Skirt:    { topOrBottom: 'Bottom', gender: "Women's" },
  Dress:    { topOrBottom: 'Full body', gender: "Women's" },
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

/**
 * Types with unambiguous classification. For these, the manual Accessory
 * toggle and Top/Bottom chip field are hidden — auto-derived from the type.
 */
export const KNOWN_TYPES = new Set(
  TYPE_GROUPS.flatMap(g => g.types).filter(t => t !== 'Other'),
);

/** Maps ML pipeline GarmentType → form clothingType values. */
export const GARMENT_TO_FORM_TYPE: Partial<Record<GarmentType, string>> = {
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

/** Maps detected color names (from colorUtils) → the form's COLORS list. */
export const DETECTED_COLOR_TO_FORM: Record<string, string> = {
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

/** Extracts the best-matching form fabric from a detected fabric string. */
export function detectedFabricToForm(fabric: FabricGuess): string {
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
