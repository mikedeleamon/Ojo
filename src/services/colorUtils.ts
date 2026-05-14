import { DetectedColor } from './clothingIdentifier.types';

const COLOR_TABLE: Array<{ name: string; hex: string; r: number; g: number; b: number }> = [
  { name: 'white',        hex: '#FFFFFF', r: 255, g: 255, b: 255 },
  { name: 'off-white',    hex: '#FAF7F0', r: 250, g: 247, b: 240 },
  { name: 'cream',        hex: '#FFF8DC', r: 255, g: 248, b: 220 },
  { name: 'light gray',   hex: '#D3D3D3', r: 211, g: 211, b: 211 },
  { name: 'gray',         hex: '#808080', r: 128, g: 128, b: 128 },
  { name: 'charcoal',     hex: '#36454F', r: 54,  g: 69,  b: 79  },
  { name: 'dark gray',    hex: '#404040', r: 64,  g: 64,  b: 64  },
  { name: 'black',        hex: '#1C1C1C', r: 28,  g: 28,  b: 28  },
  { name: 'navy',         hex: '#1F305E', r: 31,  g: 48,  b: 94  },
  { name: 'dark blue',    hex: '#003153', r: 0,   g: 49,  b: 83  },
  { name: 'blue',         hex: '#4169E1', r: 65,  g: 105, b: 225 },
  { name: 'light blue',   hex: '#ADD8E6', r: 173, g: 216, b: 230 },
  { name: 'sky blue',     hex: '#87CEEB', r: 135, g: 206, b: 235 },
  { name: 'cobalt',       hex: '#0047AB', r: 0,   g: 71,  b: 171 },
  { name: 'denim blue',   hex: '#1560BD', r: 21,  g: 96,  b: 189 },
  { name: 'teal',         hex: '#008080', r: 0,   g: 128, b: 128 },
  { name: 'turquoise',    hex: '#40E0D0', r: 64,  g: 224, b: 208 },
  { name: 'forest green', hex: '#228B22', r: 34,  g: 139, b: 34  },
  { name: 'olive',        hex: '#708238', r: 112, g: 130, b: 56  },
  { name: 'green',        hex: '#00A550', r: 0,   g: 165, b: 80  },
  { name: 'mint',         hex: '#98FF98', r: 152, g: 255, b: 152 },
  { name: 'sage',         hex: '#BCB88A', r: 188, g: 184, b: 138 },
  { name: 'red',          hex: '#CC0000', r: 204, g: 0,   b: 0   },
  { name: 'crimson',      hex: '#DC143C', r: 220, g: 20,  b: 60  },
  { name: 'burgundy',     hex: '#800020', r: 128, g: 0,   b: 32  },
  { name: 'wine',         hex: '#722F37', r: 114, g: 47,  b: 55  },
  { name: 'coral',        hex: '#FF7F7F', r: 255, g: 127, b: 127 },
  { name: 'orange',       hex: '#FF6600', r: 255, g: 102, b: 0   },
  { name: 'rust',         hex: '#B7410E', r: 183, g: 65,  b: 14  },
  { name: 'tan',          hex: '#D2B48C', r: 210, g: 180, b: 140 },
  { name: 'camel',        hex: '#C19A6B', r: 193, g: 154, b: 107 },
  { name: 'khaki',        hex: '#C3B091', r: 195, g: 176, b: 145 },
  { name: 'beige',        hex: '#F5F5DC', r: 245, g: 245, b: 220 },
  { name: 'brown',        hex: '#7B4F2E', r: 123, g: 79,  b: 46  },
  { name: 'chocolate',    hex: '#3D1C02', r: 61,  g: 28,  b: 2   },
  { name: 'yellow',       hex: '#FFD700', r: 255, g: 215, b: 0   },
  { name: 'mustard',      hex: '#FFDB58', r: 255, g: 219, b: 88  },
  { name: 'pink',         hex: '#FFB6C1', r: 255, g: 182, b: 193 },
  { name: 'hot pink',     hex: '#FF69B4', r: 255, g: 105, b: 180 },
  { name: 'blush',        hex: '#FAD2CF', r: 250, g: 210, b: 207 },
  { name: 'mauve',        hex: '#E0B0B0', r: 224, g: 176, b: 176 },
  { name: 'purple',       hex: '#6A0DAD', r: 106, g: 13,  b: 173 },
  { name: 'lavender',     hex: '#B57EDC', r: 181, g: 126, b: 220 },
  { name: 'plum',         hex: '#4B0082', r: 75,  g: 0,   b: 130 },
  { name: 'gold',         hex: '#CFB53B', r: 207, g: 181, b: 59  },
  { name: 'silver',       hex: '#C0C0C0', r: 192, g: 192, b: 192 },
];

function colorDistance(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2),
  );
}

export function rgbToColorName(r: number, g: number, b: number): { name: string; hex: string } {
  let minDist = Infinity;
  let best = COLOR_TABLE[0];

  for (const color of COLOR_TABLE) {
    const dist = colorDistance(r, g, b, color.r, color.g, color.b);
    if (dist < minDist) {
      minDist = dist;
      best = color;
    }
  }

  return { name: best.name, hex: best.hex };
}

export interface PaletteSwatch {
  rgb: [number, number, number];
  population: number;
}

export type RawPalette = Partial<Record<
  'vibrant' | 'darkVibrant' | 'lightVibrant' | 'muted' | 'darkMuted' | 'lightMuted',
  PaletteSwatch
>>;

export function paletteToDetectedColors(
  palette: RawPalette | null | undefined,
  maxColors: number = 3,
): DetectedColor[] {
  if (!palette) return [];
  const swatches = Object.values(palette).filter(Boolean) as PaletteSwatch[];

  if (swatches.length === 0) return [];

  const totalPopulation = swatches.reduce((sum, s) => sum + s.population, 0);

  const results: DetectedColor[] = swatches.map((swatch) => {
    const [r, g, b] = swatch.rgb;
    const { name, hex } = rgbToColorName(r, g, b);
    return {
      name,
      hex,
      prominence: totalPopulation > 0 ? swatch.population / totalPopulation : 0,
    };
  });

  const seen = new Set<string>();
  return results
    .sort((a, b) => b.prominence - a.prominence)
    .filter(({ name }) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .slice(0, maxColors);
}
