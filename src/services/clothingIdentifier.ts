/**
 * clothingIdentifier.ts — on-device clothing identification pipeline.
 *
 * Pipeline:
 *   1. ML Kit image labeling  → garment type + confidence
 *      NOTE: @react-native-ml-kit/image-labeling ships no arm64 Simulator
 *      slice, so NativeModules.ImageLabeling will be undefined in the
 *      iOS Simulator on Apple Silicon. Step 1 is skipped gracefully and
 *      garmentType / confidence are left as 'unknown' / 0 on Simulator.
 *      The feature works fully on a physical device.
 *   2. react-native-palette   → dominant colors → semantic names
 *   3. Heuristic lookup table → fabric best-guess
 */

import { NativeModules } from 'react-native';
import { getPalette } from 'react-native-palette';

// Resolve ML Kit lazily so that the module can be absent on Simulator
// without crashing at import time.
interface Label { text: string; confidence: number; index: number; }
const _mlKit = NativeModules.ImageLabeling as
  { label: (uri: string) => Promise<Label[]> } | undefined;

import {
  ClothingIdentificationResult,
  ClothingIdentifierConfig,
  FabricGuess,
  GarmentType,
  RawLabel,
} from './clothingIdentifier.types';
import { paletteToDetectedColors, RawPalette } from './colorUtils';

// ─── Label → GarmentType Map ─────────────────────────────────────────────────

const LABEL_TO_GARMENT: Array<{ patterns: string[]; type: GarmentType }> = [
  { patterns: ['t-shirt', 'tshirt', 't shirt', 'crew neck tee', 'graphic tee'], type: 't-shirt' },
  { patterns: ['long sleeve', 'long-sleeve', 'longsleeve'], type: 'long-sleeve-shirt' },
  { patterns: ['dress shirt', 'button-up', 'button up', 'oxford', 'poplin shirt'], type: 'dress-shirt' },
  { patterns: ['polo', 'polo shirt'], type: 'polo' },
  { patterns: ['tank', 'tank top', 'sleeveless', 'camisole', 'singlet'], type: 'tank-top' },
  { patterns: ['hoodie', 'hooded sweatshirt', 'hooded pullover'], type: 'hoodie' },
  { patterns: ['sweatshirt', 'crewneck sweatshirt', 'pullover'], type: 'sweatshirt' },
  { patterns: ['sweater', 'knitwear', 'knit top', 'turtleneck', 'rollneck'], type: 'sweater' },
  { patterns: ['cardigan'], type: 'cardigan' },
  { patterns: ['blazer', 'sport coat', 'sport jacket'], type: 'blazer' },
  { patterns: ['jacket', 'bomber', 'harrington', 'windbreaker', 'trucker jacket'], type: 'jacket' },
  { patterns: ['coat', 'overcoat', 'trench', 'topcoat', 'peacoat'], type: 'coat' },
  { patterns: ['puffer', 'down jacket', 'quilted jacket', 'parka'], type: 'puffer' },
  { patterns: ['vest', 'waistcoat', 'gilet'], type: 'vest' },
  { patterns: ['jeans', 'denim pants', 'denim jeans'], type: 'jeans' },
  { patterns: ['pants', 'trousers', 'chinos', 'slacks', 'cargo pants'], type: 'pants' },
  { patterns: ['shorts'], type: 'shorts' },
  { patterns: ['leggings', 'tights', 'yoga pants'], type: 'leggings' },
  { patterns: ['skirt', 'mini skirt', 'maxi skirt', 'midi skirt'], type: 'skirt' },
  { patterns: ['dress', 'sundress', 'maxi dress', 'mini dress', 'midi dress'], type: 'dress' },
  { patterns: ['jumpsuit', 'romper', 'overalls'], type: 'jumpsuit' },
];

function labelToGarmentType(label: string): GarmentType {
  const normalised = label.toLowerCase().trim();
  for (const { patterns, type } of LABEL_TO_GARMENT) {
    if (patterns.some((p) => normalised.includes(p))) return type;
  }
  return 'unknown';
}

// ─── Garment → Fabric Heuristics ─────────────────────────────────────────────

const GARMENT_TO_FABRIC: Record<GarmentType, FabricGuess> = {
  't-shirt':           { type: 'cotton / cotton-blend',             confidence: 'high',   note: 'Most tees are jersey knit cotton' },
  'long-sleeve-shirt': { type: 'cotton / cotton-blend',             confidence: 'high' },
  'dress-shirt':       { type: 'cotton / poplin',                   confidence: 'high',   note: 'Dress shirts are almost always woven cotton' },
  'polo':              { type: 'cotton piqué',                      confidence: 'high' },
  'tank-top':          { type: 'cotton / modal',                    confidence: 'medium' },
  'hoodie':            { type: 'cotton fleece / french terry',      confidence: 'high' },
  'sweatshirt':        { type: 'cotton fleece',                     confidence: 'high' },
  'sweater':           { type: 'wool / acrylic / cotton knit',      confidence: 'medium', note: 'Varies widely — wool, acrylic, and cotton are all common' },
  'cardigan':          { type: 'wool / acrylic knit',               confidence: 'medium' },
  'blazer':            { type: 'wool / polyester / linen',          confidence: 'medium' },
  'jacket':            { type: 'nylon / polyester / cotton canvas', confidence: 'medium' },
  'coat':              { type: 'wool / wool-blend',                 confidence: 'medium' },
  'puffer':            { type: 'nylon shell / down or synthetic fill', confidence: 'high', note: 'Outer shell is almost always nylon or polyester' },
  'vest':              { type: 'polyester / wool',                  confidence: 'low' },
  'jeans':             { type: 'denim (cotton)',                    confidence: 'high' },
  'pants':             { type: 'cotton / polyester / wool',         confidence: 'low',   note: 'Fabric varies widely by style' },
  'shorts':            { type: 'cotton / nylon',                    confidence: 'medium' },
  'leggings':          { type: 'spandex / polyester blend',         confidence: 'high' },
  'skirt':             { type: 'cotton / polyester / satin',        confidence: 'low' },
  'dress':             { type: 'polyester / cotton / silk-like',    confidence: 'low' },
  'jumpsuit':          { type: 'cotton / denim / polyester',        confidence: 'low' },
  'unknown':           { type: 'unknown',                           confidence: 'low' },
};

// ─── Main Identifier ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<ClothingIdentifierConfig> = {
  modelPath: '',
  confidenceThreshold: 0.5,
  maxColors: 3,
};

export async function identifyClothing(
  imageUri: string,
  config: ClothingIdentifierConfig = {},
): Promise<ClothingIdentificationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Step 1: Garment type via ML Kit (device only — unavailable on Simulator)
  const mlKitLabels: Label[] = _mlKit ? await _mlKit.label(imageUri) : [];

  const rawLabels: RawLabel[] = mlKitLabels.map((l: Label) => ({
    text: l.text,
    confidence: l.confidence,
  }));

  const best = rawLabels
    .filter((l) => l.confidence >= cfg.confidenceThreshold)
    .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  const garmentType = best ? labelToGarmentType(best.text) : 'unknown';
  const confidence = best?.confidence ?? 0;

  // Step 2: Dominant colors via react-native-palette
  let colors: ReturnType<typeof paletteToDetectedColors> = [];
  try {
    const palette: RawPalette = await new Promise((resolve, reject) =>
      getPalette(imageUri, (err: Error | null, p: RawPalette) =>
        err ? reject(err) : resolve(p),
      ),
    );
    colors = paletteToDetectedColors(palette, cfg.maxColors);
  } catch {
    colors = [];
  }

  // Step 3: Fabric heuristic
  const fabric = GARMENT_TO_FABRIC[garmentType];

  return { garmentType, colors, fabric, confidence, rawLabels };
}
