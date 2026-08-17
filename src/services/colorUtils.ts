/**
 * Named-color anchors for garment photos.
 *
 * Two properties matter here, and both were wrong in the original table:
 *
 *  1. **Chromatic coverage at real-world saturation.** Fabric photographed
 *     under ordinary light lands at chroma ~10–25, not at the fully-saturated
 *     chroma ~40–80 of a CSS color keyword. With only saturated anchors, every
 *     muted garment's nearest neighbour was whichever neutral sat at its
 *     lightness — which is exactly why so much of the closet came back "gray".
 *     The muted anchors below (slate blue, dusty blue, hunter green, taupe,
 *     dusty rose, terracotta…) give those colors somewhere correct to land.
 *
 *  2. **No neutral duplicates.** "silver" (#C0C0C0) used to sit ~7 ΔE from
 *     "light gray" (#D3D3D3) with nothing else between them, so ordinary light
 *     gray garments were routinely named silver. A photo cannot distinguish
 *     metallic silver from light gray fabric, so the entry is gone; pick
 *     Silver by hand in the form when the garment really is metallic.
 */
const COLOR_TABLE: Array<{ name: string; hex: string; r: number; g: number; b: number }> = [
  // Neutrals
  { name: 'white',        hex: '#FFFFFF', r: 255, g: 255, b: 255 },
  { name: 'off-white',    hex: '#FAF7F0', r: 250, g: 247, b: 240 },
  { name: 'cream',        hex: '#FFF8DC', r: 255, g: 248, b: 220 },
  { name: 'light gray',   hex: '#D3D3D3', r: 211, g: 211, b: 211 },
  { name: 'gray',         hex: '#808080', r: 128, g: 128, b: 128 },
  { name: 'charcoal',     hex: '#36454F', r: 54,  g: 69,  b: 79  },
  { name: 'dark gray',    hex: '#404040', r: 64,  g: 64,  b: 64  },
  { name: 'black',        hex: '#1C1C1C', r: 28,  g: 28,  b: 28  },
  // Blues
  { name: 'navy',         hex: '#1F305E', r: 31,  g: 48,  b: 94  },
  { name: 'dark blue',    hex: '#003153', r: 0,   g: 49,  b: 83  },
  { name: 'blue',         hex: '#4169E1', r: 65,  g: 105, b: 225 },
  { name: 'light blue',   hex: '#ADD8E6', r: 173, g: 216, b: 230 },
  { name: 'sky blue',     hex: '#87CEEB', r: 135, g: 206, b: 235 },
  { name: 'cobalt',       hex: '#0047AB', r: 0,   g: 71,  b: 171 },
  { name: 'denim blue',   hex: '#1560BD', r: 21,  g: 96,  b: 189 },
  { name: 'slate blue',   hex: '#5E6E8C', r: 94,  g: 110, b: 140 },
  { name: 'dusty blue',   hex: '#7A92B0', r: 122, g: 146, b: 176 },
  { name: 'periwinkle',   hex: '#96A0DC', r: 150, g: 160, b: 220 },
  { name: 'teal',         hex: '#008080', r: 0,   g: 128, b: 128 },
  { name: 'turquoise',    hex: '#40E0D0', r: 64,  g: 224, b: 208 },
  // Greens
  { name: 'forest green', hex: '#228B22', r: 34,  g: 139, b: 34  },
  { name: 'hunter green', hex: '#355E3B', r: 53,  g: 94,  b: 59  },
  { name: 'olive',        hex: '#708238', r: 112, g: 130, b: 56  },
  { name: 'green',        hex: '#00A550', r: 0,   g: 165, b: 80  },
  { name: 'mint',         hex: '#98FF98', r: 152, g: 255, b: 152 },
  { name: 'sage',         hex: '#BCB88A', r: 188, g: 184, b: 138 },
  { name: 'seafoam',      hex: '#96BEAF', r: 150, g: 190, b: 175 },
  // Reds
  { name: 'red',          hex: '#CC0000', r: 204, g: 0,   b: 0   },
  { name: 'crimson',      hex: '#DC143C', r: 220, g: 20,  b: 60  },
  { name: 'burgundy',     hex: '#800020', r: 128, g: 0,   b: 32  },
  { name: 'wine',         hex: '#722F37', r: 114, g: 47,  b: 55  },
  { name: 'maroon',       hex: '#6E2D32', r: 110, g: 45,  b: 50  },
  // Oranges
  { name: 'coral',        hex: '#FF7F7F', r: 255, g: 127, b: 127 },
  { name: 'salmon',       hex: '#EB8C78', r: 235, g: 140, b: 120 },
  { name: 'orange',       hex: '#FF6600', r: 255, g: 102, b: 0   },
  { name: 'peach',        hex: '#FFBE96', r: 255, g: 190, b: 150 },
  { name: 'rust',         hex: '#B7410E', r: 183, g: 65,  b: 14  },
  { name: 'terracotta',   hex: '#B4644B', r: 180, g: 100, b: 75  },
  // Browns / earth
  { name: 'tan',          hex: '#D2B48C', r: 210, g: 180, b: 140 },
  { name: 'camel',        hex: '#C19A6B', r: 193, g: 154, b: 107 },
  { name: 'khaki',        hex: '#C3B091', r: 195, g: 176, b: 145 },
  { name: 'beige',        hex: '#F5F5DC', r: 245, g: 245, b: 220 },
  { name: 'taupe',        hex: '#968478', r: 150, g: 132, b: 120 },
  { name: 'brown',        hex: '#7B4F2E', r: 123, g: 79,  b: 46  },
  { name: 'chocolate',    hex: '#3D1C02', r: 61,  g: 28,  b: 2   },
  // Yellows
  { name: 'yellow',       hex: '#FFD700', r: 255, g: 215, b: 0   },
  { name: 'mustard',      hex: '#FFDB58', r: 255, g: 219, b: 88  },
  { name: 'gold',         hex: '#CFB53B', r: 207, g: 181, b: 59  },
  // Pinks / purples
  { name: 'pink',         hex: '#FFB6C1', r: 255, g: 182, b: 193 },
  { name: 'hot pink',     hex: '#FF69B4', r: 255, g: 105, b: 180 },
  { name: 'blush',        hex: '#FAD2CF', r: 250, g: 210, b: 207 },
  { name: 'mauve',        hex: '#E0B0B0', r: 224, g: 176, b: 176 },
  { name: 'dusty rose',   hex: '#C49696', r: 196, g: 150, b: 150 },
  { name: 'purple',       hex: '#6A0DAD', r: 106, g: 13,  b: 173 },
  { name: 'lavender',     hex: '#B57EDC', r: 181, g: 126, b: 220 },
  { name: 'plum',         hex: '#4B0082', r: 75,  g: 0,   b: 130 },
];

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/**
 * sRGB (D65) → CIE Lab. Lab distance tracks human color perception far better
 * than raw RGB Euclidean distance — e.g. navy and black sit close together in
 * RGB but read as clearly different colors, which Lab distance reflects.
 */
export function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

  const xn = x / 0.95047, yn = y / 1.0, zn = z / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xn), fy = f(yn), fz = f(zn);

  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Every name nearestColorNameFromLab can return. Consumers that translate
 *  detected names into their own vocabulary (e.g. the article form's picker)
 *  can assert against this so a new anchor can't be added without a mapping. */
export const DETECTABLE_COLOR_NAMES: readonly string[] = COLOR_TABLE.map((c) => c.name);

const COLOR_TABLE_LAB = COLOR_TABLE.map((c) => {
  const lab = rgbToLab(c.r, c.g, c.b);
  return { ...c, lab, chroma: Math.hypot(lab.a, lab.b) };
});

/**
 * Lightness weight (kL) for the CIE94 distance below. 2 is the textile
 * constant — CIE94 was parameterised separately for graphic arts (kL=1) and
 * textiles (kL=2) precisely because a fabric read as "the same color" across a
 * much wider lightness range than ink on paper does. Garment photos carry
 * exactly that kind of lightness spread: folds, shadow, and exposure move L*
 * around far more than they move hue.
 */
const KL = 2;
const K1 = 0.048; // chroma weighting constant (textiles)
const K2 = 0.014; // hue weighting constant (textiles)

/**
 * Squared CIE94 (textile) color difference between a sample Lab and a table
 * entry, which is the *reference* in CIE94's asymmetric formulation.
 *
 * Plain Lab-Euclidean distance charges the full chroma gap against every
 * anchor, and every neutral anchor sits at chroma 0. A sky-blue shirt shot
 * indoors (chroma ~15) is therefore ~16 ΔE from "gray" but ~37 from the
 * saturated "denim blue" — so it came back gray, and so did most of the
 * closet. CIE94 divides the chroma gap by (1 + K1·C_ref), which lets a
 * saturated anchor stay in contention on the strength of matching *hue*
 * while leaving neutral anchors (C_ref = 0) charged in full. That asymmetry
 * is the whole point: hue agreement, not lightness or saturation agreement,
 * is what makes two garments read as the same color.
 */
function cie94DistanceSq(
  l: number, a: number, b: number,
  ref: { lab: { l: number; a: number; b: number }; chroma: number },
): number {
  const cRef = ref.chroma;
  const cSample = Math.hypot(a, b);

  const dL = ref.lab.l - l;
  const dC = cRef - cSample;
  const da = ref.lab.a - a;
  const db = ref.lab.b - b;

  // ΔH² = Δa² + Δb² − ΔC², clamped: the identity is exact in theory but can go
  // slightly negative through floating-point error when ΔC ≈ √(Δa² + Δb²).
  const dH2 = Math.max(0, da * da + db * db - dC * dC);

  const sC = 1 + K1 * cRef;
  const sH = 1 + K2 * cRef;

  return (dL / KL) ** 2 + (dC / sC) ** 2 + dH2 / (sH * sH);
}

/**
 * Nearest named color to a Lab point. Exposed separately from rgbToColorName
 * so callers that already have Lab values (e.g. cluster centroids) can skip
 * converting back through RGB first.
 */
export function nearestColorNameFromLab(l: number, a: number, b: number): { name: string; hex: string } {
  let minDist = Infinity;
  let best = COLOR_TABLE_LAB[0];

  for (const color of COLOR_TABLE_LAB) {
    const dist = cie94DistanceSq(l, a, b, color);
    if (dist < minDist) {
      minDist = dist;
      best = color;
    }
  }

  return { name: best.name, hex: best.hex };
}

export function rgbToColorName(r: number, g: number, b: number): { name: string; hex: string } {
  const lab = rgbToLab(r, g, b);
  return nearestColorNameFromLab(lab.l, lab.a, lab.b);
}
