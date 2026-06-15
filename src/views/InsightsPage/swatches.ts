/**
 * swatches.ts
 * -----------
 * Shared colour-name → hex map for the Insights tab, plus small helpers used by
 * the chord diagram and the circle-pack palette. Kept in one place so the card
 * rows, the chord nodes, and the palette orbs all resolve colours identically.
 */

import { METALLIC_GRADIENTS } from '../../lib/colors/metallicGradients';

export const SWATCH: Record<string, string> = {
  Black: '#1a1a1a', White: '#f0f0f0', Grey: '#9ca3af', Brown: '#92400e',
  Beige: '#d4b896', Cream: '#fef3c7', Silver: '#c0c0c0', Gold: '#d4af37',
  'Rose Gold': '#c9776a', Champagne: '#f4e4c1', Navy: '#1e3a5f',
  Indigo: '#4338ca', Cobalt: '#2563eb', Blue: '#3b82f6', Teal: '#0d9488',
  Cyan: '#06b6d4', Green: '#22c55e', Mint: '#34d399', Lime: '#a3e635',
  Sage: '#86efac', Olive: '#65a30d', Khaki: '#a16207', Red: '#ef4444',
  Scarlet: '#f43f5e', Crimson: '#dc2626', Burgundy: '#9b1c1c',
  Orange: '#f97316', Coral: '#fb923c', Peach: '#fdba74', Rust: '#c2410c',
  Yellow: '#fbbf24', Purple: '#a855f7', Plum: '#7c3aed', Lilac: '#d8b4fe',
  Lavender: '#c4b5fd', Pink: '#f9a8d4', Rose: '#fb7185', Blush: '#fecdd3',
  Magenta: '#e879f9', 'Hot Pink': '#ec4899', Fuchsia: '#d946ef', Multi: '#888',
};

/** Fallback hue for an unknown colour name (neutral glass grey). */
const FALLBACK = '#9ca3af';

/** Solid representative hex for a colour name (metallics → mid stop). */
export const swatchHex = (name: string): string => {
  const metallic = METALLIC_GRADIENTS[name];
  if (metallic) return metallic[1] ?? metallic[0];
  return SWATCH[name] ?? FALLBACK;
};

/** Gradient stops for a metallic colour, or null for flat colours. */
export const metallicStops = (name: string): readonly string[] | null =>
  METALLIC_GRADIENTS[name] ?? null;

/** Relative luminance (0–1) of a #rrggbb hex, for picking readable text. */
export const luminance = (hex: string): number => {
  const h = hex.replace('#', '');
  if (h.length < 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Dark or light label colour that reads against a given fill. */
export const readableOn = (hex: string): string =>
  luminance(hex) > 0.6 ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)';
