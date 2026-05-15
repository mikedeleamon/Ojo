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
 *   2. colorExtractor (pure JS) → resize to 8×8 PNG, decode pixels → semantic names
 *   3. Heuristic lookup table → fabric best-guess
 */

import { NativeModules } from 'react-native';
import { extractColorsFromImage } from './colorExtractor';

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

// ─── Label → GarmentType Map ─────────────────────────────────────────────────

const LABEL_TO_GARMENT: Array<{ patterns: string[]; type: GarmentType }> = [
  // ── Accessories — checked FIRST so "Hat"/"Cap" beat generic "Outerwear"/"Jacket" ──
  { patterns: ['hat', 'fedora', 'beanie', 'beret', 'bucket hat', 'sun hat', 'cowboy hat'], type: 'hat' },
  { patterns: ['cap', 'baseball cap', 'snapback', 'trucker hat', 'visor'], type: 'cap' },
  { patterns: ['scarf', 'bandana', 'neckerchief'], type: 'scarf' },
  { patterns: ['gloves', 'mittens'], type: 'gloves' },
  { patterns: ['belt'], type: 'belt' },
  { patterns: ['bag', 'handbag', 'backpack', 'tote', 'purse', 'clutch', 'satchel'], type: 'bag' },
  { patterns: ['watch', 'wristwatch'], type: 'watch' },
  { patterns: ['sneaker', 'sneakers', 'trainer', 'running shoe', 'athletic shoe'], type: 'sneakers' },
  { patterns: ['boot', 'boots', 'ankle boot', 'chelsea boot'], type: 'boots' },
  { patterns: ['sandal', 'sandals', 'flip-flop', 'flip flop'], type: 'sandals' },
  { patterns: ['shoe', 'shoes', 'loafer', 'oxford shoe', 'derby'], type: 'shoes' },
  { patterns: ['sock', 'socks'], type: 'socks' },

  // ── Tops ──
  // "t-shirt" must come before generic "shirt" / "top" to avoid mismatches.
  { patterns: ['t-shirt', 'tshirt', 't shirt', 'crew neck tee', 'graphic tee'], type: 't-shirt' },
  { patterns: ['long sleeve', 'long-sleeve', 'longsleeve'], type: 'long-sleeve-shirt' },
  { patterns: ['dress shirt', 'button-up', 'button up', 'oxford shirt', 'poplin shirt', 'formal shirt'], type: 'dress-shirt' },
  { patterns: ['polo', 'polo shirt'], type: 'polo' },
  { patterns: ['tank', 'tank top', 'sleeveless', 'camisole', 'singlet'], type: 'tank-top' },

  // ── Layers ──
  { patterns: ['hoodie', 'hooded sweatshirt', 'hooded pullover'], type: 'hoodie' },
  { patterns: ['sweatshirt', 'crewneck sweatshirt', 'pullover'], type: 'sweatshirt' },
  { patterns: ['sweater', 'knitwear', 'knit top', 'turtleneck', 'rollneck'], type: 'sweater' },
  { patterns: ['cardigan'], type: 'cardigan' },

  // ── Outerwear — "outerwear" removed (too generic; causes hat→jacket misfires) ──
  { patterns: ['blazer', 'sport coat', 'sport jacket', 'suit jacket', 'suit'], type: 'blazer' },
  { patterns: ['jacket', 'bomber', 'harrington', 'windbreaker', 'trucker jacket'], type: 'jacket' },
  { patterns: ['coat', 'overcoat', 'trench', 'topcoat', 'peacoat'], type: 'coat' },
  { patterns: ['puffer', 'down jacket', 'quilted jacket', 'parka'], type: 'puffer' },
  { patterns: ['vest', 'waistcoat', 'gilet'], type: 'vest' },

  // ── Bottoms ──
  { patterns: ['jeans', 'denim pants', 'denim jeans', 'denim'], type: 'jeans' },
  { patterns: ['pants', 'trousers', 'chinos', 'slacks', 'cargo pants'], type: 'pants' },
  { patterns: ['shorts'], type: 'shorts' },
  { patterns: ['leggings', 'tights', 'yoga pants'], type: 'leggings' },
  { patterns: ['skirt', 'mini skirt', 'maxi skirt', 'midi skirt'], type: 'skirt' },

  // ── Full body ──
  { patterns: ['dress', 'sundress', 'maxi dress', 'mini dress', 'midi dress'], type: 'dress' },
  { patterns: ['jumpsuit', 'romper', 'overalls'], type: 'jumpsuit' },

  // ── Generic catch-alls — last so specific patterns above win ──
  { patterns: ['shirt', 'top', 'jersey', 'sportswear'], type: 't-shirt' },
  { patterns: ['wool', 'knitwear'], type: 'sweater' },
  { patterns: ['outerwear'], type: 'jacket' },
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
  'hat':               { type: 'cotton / wool / polyester',         confidence: 'low' },
  'cap':               { type: 'cotton / polyester',                confidence: 'medium' },
  'scarf':             { type: 'wool / cotton / silk',              confidence: 'low' },
  'gloves':            { type: 'leather / wool / synthetic',        confidence: 'low' },
  'belt':              { type: 'leather / synthetic',               confidence: 'medium' },
  'bag':               { type: 'leather / canvas / nylon',          confidence: 'low' },
  'shoes':             { type: 'leather / synthetic',               confidence: 'medium' },
  'boots':             { type: 'leather / suede',                   confidence: 'medium' },
  'sneakers':          { type: 'mesh / synthetic / rubber',         confidence: 'high' },
  'sandals':           { type: 'leather / synthetic',               confidence: 'medium' },
  'socks':             { type: 'cotton / polyester blend',          confidence: 'high' },
  'watch':             { type: 'metal / leather / silicone',        confidence: 'medium' },
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

  // Sort all labels by confidence descending.
  const sorted = [...rawLabels].sort((a, b) => b.confidence - a.confidence);

  // Labels that describe a person, body part, or scene — not a garment.
  // These are excluded from garment matching so that e.g. "Muscle (90%)" on a
  // model photo doesn't shadow the actual clothing labels further down the list.
  const NON_GARMENT = new Set([
    'person', 'man', 'woman', 'human', 'body', 'people',
    'muscle', 'muscles', 'arm', 'leg', 'hand', 'foot', 'feet', 'neck', 'chest',
    'face', 'beard', 'hair', 'skin', 'nose', 'eye', 'head',
    'dude', 'guy', 'girl', 'boy', 'adult', 'model', 'fashion model',
    'portrait', 'photo', 'photography', 'stock photo', 'selfie',
    'finger', 'thumb', 'wrist', 'elbow', 'shoulder', 'knee', 'ankle',
  ]);

  // Collect EVERY label→pattern match, tagging each with the pattern's index
  // in LABEL_TO_GARMENT (lower index = higher specificity). Then pick the
  // match with the best specificity; break ties by label confidence.
  //
  // This ensures "Hat (76%)" beats "Outerwear (90%)" when both are present
  // because hat patterns come before the outerwear catch-all in the list.
  interface LabelMatch { type: GarmentType; confidence: number; labelText: string; priority: number; }
  const allMatches: LabelMatch[] = [];

  for (const label of sorted) {
    const normalised = label.text.toLowerCase().trim();
    if (NON_GARMENT.has(normalised)) continue; // skip person / body-part labels

    for (let i = 0; i < LABEL_TO_GARMENT.length; i++) {
      const { patterns, type } = LABEL_TO_GARMENT[i];
      if (patterns.some(p => normalised.includes(p))) {
        allMatches.push({ type, confidence: label.confidence, labelText: label.text, priority: i });
        break; // one pattern group per label — move on to next label
      }
    }
  }

  // Pick best: lowest priority index wins; break ties with highest confidence.
  allMatches.sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
  const bestMatch = allMatches[0];

  let garmentType: GarmentType = bestMatch?.type ?? 'unknown';
  let confidence = bestMatch?.confidence ?? (sorted[0]?.confidence ?? 0);
  let topLabelText = bestMatch?.labelText ?? (sorted[0]?.text ?? '');

  // Step 2: Dominant colors via pure-JS pixel sampling (no native modules).
  // extractColorsFromImage resizes to an 8×8 PNG and reads pixel data directly.
  const colors = await extractColorsFromImage(imageUri, cfg.maxColors);

  // Step 3: Fabric heuristic
  const fabric = GARMENT_TO_FABRIC[garmentType];

  return { garmentType, topLabelText, colors, fabric, confidence, rawLabels };
}
