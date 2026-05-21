/**
 * clothingIdentifier.ts — on-device clothing identification pipeline.
 *
 * Pipeline:
 *   1. TFLite inference (MobileNetV3-Small trained on Fashionpedia)
 *        → garment type (34 classes) + sleeve length (4 classes)
 *   2. Sleeve override rules   → e.g. t-shirt + long-sleeve → long-sleeve-shirt
 *   3. colorExtractor (pure JS) → dominant colors
 *   4. Heuristic lookup table  → fabric best-guess
 *
 * Model file: src/assets/clothing_model.tflite
 * Copy it there once `python train_clothing.py` writes output/clothing_model.tflite.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import type { TensorflowModel } from 'react-native-fast-tflite';
import { base64ToBytes, extractColorsFromImage, parsePNGPixels } from './colorExtractor';

import type {
  ClothingIdentificationResult,
  ClothingIdentifierConfig,
  FabricGuess,
  GarmentType,
  RawLabel,
} from './clothingIdentifier.types';

// ─── Label tables — must match output/labels.json ────────────────────────────

const GARMENT_LABELS: GarmentType[] = [
  // Tops
  't-shirt', 'long-sleeve-shirt', 'dress-shirt', 'polo', 'tank-top',
  'hoodie', 'sweatshirt', 'sweater', 'cardigan',
  // Outerwear
  'jacket', 'blazer', 'coat', 'puffer', 'vest',
  // Bottoms
  'jeans', 'pants', 'shorts', 'leggings', 'skirt',
  // Full body
  'dress', 'jumpsuit',
  // Accessories / footwear
  'hat', 'cap', 'scarf', 'gloves', 'belt', 'bag',
  'shoes', 'boots', 'sneakers', 'sandals', 'socks', 'watch',
  // Fallback
  'unknown',
];

const SLEEVE_LABELS = ['short-sleeve', 'long-sleeve', 'sleeveless', 'n/a'] as const;

// Garment types where sleeve output is meaningful
const TOP_GARMENTS = new Set<GarmentType>([
  't-shirt', 'long-sleeve-shirt', 'dress-shirt', 'polo', 'tank-top',
  'hoodie', 'sweatshirt', 'sweater', 'cardigan', 'blazer',
]);

// Combined garment+sleeve → final GarmentType display name
const SLEEVE_OVERRIDES: Record<string, GarmentType> = {
  't-shirt+long-sleeve':   'long-sleeve-shirt',
  't-shirt+sleeveless':    'tank-top',
  'hoodie+sleeveless':     'tank-top',
  'sweatshirt+sleeveless': 'tank-top',
};

// ─── ImageNet normalisation (must match train_clothing.py) ───────────────────

const NORM_MEAN = [0.485, 0.456, 0.406];
const NORM_STD  = [0.229, 0.224, 0.225];
const MODEL_SIZE = 224;

// ─── Model singleton ──────────────────────────────────────────────────────────

let _model: TensorflowModel | null = null;

async function getModel(): Promise<TensorflowModel | null> {
  if (_model) return _model;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _model = await loadTensorflowModel(require('../assets/clothing_model.tflite'), []);
    console.log(
      '[Ojo] TFLite model loaded.',
      '\n  inputs :', JSON.stringify(_model.inputs),
      '\n  outputs:', JSON.stringify(_model.outputs),
    );
    return _model;
  } catch (e) {
    console.error('[Ojo] TFLite model FAILED to load:', e);
    return null;
  }
}

// ─── Image → Float32 tensor ───────────────────────────────────────────────────
// onnx2tf transposes PyTorch NCHW → NHWC by default, but we detect the actual
// layout from model.inputs[0].shape so we never guess wrong.

function buildTensor(
  pixels: Array<[number, number, number]>,
  shape: number[],   // e.g. [1,224,224,3] or [1,3,224,224]
): Float32Array {
  const isNHWC = shape[shape.length - 1] === 3;  // last dim = channels → NHWC
  const H = isNHWC ? shape[1] : shape[2];
  const W = isNHWC ? shape[2] : shape[3];
  const total = 3 * H * W;
  const tensor = new Float32Array(total);

  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = pixels[i];
    const rn = (r / 255 - NORM_MEAN[0]) / NORM_STD[0];
    const gn = (g / 255 - NORM_MEAN[1]) / NORM_STD[1];
    const bn = (b / 255 - NORM_MEAN[2]) / NORM_STD[2];

    if (isNHWC) {
      tensor[i * 3 + 0] = rn;
      tensor[i * 3 + 1] = gn;
      tensor[i * 3 + 2] = bn;
    } else {
      // NCHW: plane R then G then B
      const y = Math.floor(i / W);
      const x = i % W;
      tensor[0 * H * W + y * W + x] = rn;
      tensor[1 * H * W + y * W + x] = gn;
      tensor[2 * H * W + y * W + x] = bn;
    }
  }
  return tensor;
}

async function imageToTensor(
  imageUri: string,
  inputShape: number[],
): Promise<Float32Array | null> {
  try {
    console.log(`[Ojo] imageToTensor: uri=${imageUri?.substring(0, 80)}… shape=${JSON.stringify(inputShape)}`);

    const isNHWC = inputShape[inputShape.length - 1] === 3;
    const H = isNHWC ? inputShape[1] : inputShape[2];
    const W = isNHWC ? inputShape[2] : inputShape[3];

    if (!H || !W || isNaN(H) || isNaN(W)) {
      console.error(`[Ojo] imageToTensor: invalid H=${H} W=${W} from shape=${JSON.stringify(inputShape)}`);
      return null;
    }

    console.log(`[Ojo] imageToTensor: resizing to ${W}×${H} (${isNHWC ? 'NHWC' : 'NCHW'})`);
    const resized = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: W, height: H } }],
      { format: ImageManipulator.SaveFormat.PNG, base64: true },
    );
    if (!resized.base64) {
      console.error('[Ojo] imageToTensor: manipulateAsync returned no base64');
      return null;
    }
    console.log(`[Ojo] imageToTensor: base64 length=${resized.base64.length}`);

    const bytes = base64ToBytes(resized.base64);
    console.log(`[Ojo] imageToTensor: decoded ${bytes.length} bytes, first 8: [${bytes.slice(0, 8).join(',')}]`);

    const pixels = parsePNGPixels(bytes);
    if (pixels.length === 0) {
      console.error('[Ojo] imageToTensor: parsePNGPixels returned 0 pixels');
      return null;
    }

    console.log(`[Ojo] imageToTensor: ${pixels.length} pixels decoded, building tensor`);
    return buildTensor(pixels, inputShape);
  } catch (e) {
    console.error('[Ojo] imageToTensor error:', e);
    return null;
  }
}

function argmax(arr: Float32Array): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[best]) best = i;
  }
  return best;
}

/** Softmax-free confidence proxy: sigmoid of the winning logit. */
function logitToConfidence(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

// ─── Garment → Fabric heuristics ─────────────────────────────────────────────

const GARMENT_TO_FABRIC: Record<GarmentType, FabricGuess> = {
  't-shirt':           { type: 'cotton / cotton-blend',                confidence: 'high',   note: 'Most tees are jersey knit cotton' },
  'long-sleeve-shirt': { type: 'cotton / cotton-blend',                confidence: 'high' },
  'dress-shirt':       { type: 'cotton / poplin',                      confidence: 'high',   note: 'Dress shirts are almost always woven cotton' },
  'polo':              { type: 'cotton piqué',                         confidence: 'high' },
  'tank-top':          { type: 'cotton / modal',                       confidence: 'medium' },
  'hoodie':            { type: 'cotton fleece / french terry',         confidence: 'high' },
  'sweatshirt':        { type: 'cotton fleece',                        confidence: 'high' },
  'sweater':           { type: 'wool / acrylic / cotton knit',         confidence: 'medium', note: 'Varies widely — wool, acrylic, and cotton are all common' },
  'cardigan':          { type: 'wool / acrylic knit',                  confidence: 'medium' },
  'blazer':            { type: 'wool / polyester / linen',             confidence: 'medium' },
  'jacket':            { type: 'nylon / polyester / cotton canvas',    confidence: 'medium' },
  'coat':              { type: 'wool / wool-blend',                    confidence: 'medium' },
  'puffer':            { type: 'nylon shell / down or synthetic fill', confidence: 'high',   note: 'Outer shell is almost always nylon or polyester' },
  'vest':              { type: 'polyester / wool',                     confidence: 'low' },
  'jeans':             { type: 'denim (cotton)',                       confidence: 'high' },
  'pants':             { type: 'cotton / polyester / wool',            confidence: 'low',    note: 'Fabric varies widely by style' },
  'shorts':            { type: 'cotton / nylon',                       confidence: 'medium' },
  'leggings':          { type: 'spandex / polyester blend',            confidence: 'high' },
  'skirt':             { type: 'cotton / polyester / satin',           confidence: 'low' },
  'dress':             { type: 'polyester / cotton / silk-like',       confidence: 'low' },
  'jumpsuit':          { type: 'cotton / denim / polyester',           confidence: 'low' },
  'hat':               { type: 'cotton / wool / polyester',            confidence: 'low' },
  'cap':               { type: 'cotton / polyester',                   confidence: 'medium' },
  'scarf':             { type: 'wool / cotton / silk',                 confidence: 'low' },
  'gloves':            { type: 'leather / wool / synthetic',           confidence: 'low' },
  'belt':              { type: 'leather / synthetic',                  confidence: 'medium' },
  'bag':               { type: 'leather / canvas / nylon',             confidence: 'low' },
  'shoes':             { type: 'leather / synthetic',                  confidence: 'medium' },
  'boots':             { type: 'leather / suede',                      confidence: 'medium' },
  'sneakers':          { type: 'mesh / synthetic / rubber',            confidence: 'high' },
  'sandals':           { type: 'leather / synthetic',                  confidence: 'medium' },
  'socks':             { type: 'cotton / polyester blend',             confidence: 'high' },
  'watch':             { type: 'metal / leather / silicone',           confidence: 'medium' },
  'unknown':           { type: 'unknown',                              confidence: 'low' },
};

// ─── Aspect-ratio & shape heuristics ─────────────────────────────────────────
// When the model's confidence is low, these geometric cues correct obvious errors.
// Aspect ratio = width / height of the source image.

type ShapeCategory = 'footwear' | 'top' | 'bottom' | 'full-body' | 'accessory' | 'ambiguous';

const GARMENT_SHAPE_CATEGORY: Record<GarmentType, ShapeCategory> = {
  'shoes': 'footwear', 'boots': 'footwear', 'sneakers': 'footwear', 'sandals': 'footwear',
  't-shirt': 'top', 'long-sleeve-shirt': 'top', 'dress-shirt': 'top', 'polo': 'top',
  'tank-top': 'top', 'hoodie': 'top', 'sweatshirt': 'top', 'sweater': 'top',
  'cardigan': 'top', 'jacket': 'top', 'blazer': 'top', 'coat': 'top', 'puffer': 'top', 'vest': 'top',
  'jeans': 'bottom', 'pants': 'bottom', 'shorts': 'bottom', 'leggings': 'bottom', 'skirt': 'bottom',
  'dress': 'full-body', 'jumpsuit': 'full-body',
  'hat': 'accessory', 'cap': 'accessory', 'scarf': 'accessory', 'gloves': 'accessory',
  'belt': 'accessory', 'bag': 'accessory', 'socks': 'accessory', 'watch': 'accessory',
  'unknown': 'ambiguous',
};

/** Guess shape category from image aspect ratio */
function guessShapeFromAspect(aspectRatio: number): ShapeCategory {
  // Landscape (wider than tall) → strongly suggests footwear or belt
  if (aspectRatio > 1.5) return 'footwear';
  // Tall portrait → tops, bottoms, or full-body (never footwear)
  if (aspectRatio < 0.6) return 'bottom';
  // Roughly square with slight portrait lean → tops
  if (aspectRatio >= 0.6 && aspectRatio <= 0.9) return 'top';
  // Remaining (0.9–1.5) is ambiguous
  return 'ambiguous';
}

/**
 * Shape heuristic — ONLY override when the geometric signal is extreme
 * AND the model is very unsure. Previous version was too aggressive and
 * was overriding correct footwear/accessory predictions.
 */
function applyShapeHeuristic(
  garmentType: GarmentType,
  confidence: number,
  logits: Float32Array,
  aspectRatio: number,
): { corrected: GarmentType; confidence: number } {
  // Trust the model in almost all cases. Only intervene when:
  // 1. Model confidence is very low (< 0.55)
  // 2. Aspect ratio is extreme (very wide = likely footwear)
  // This prevents the heuristic from overriding correct but low-confidence predictions.
  if (confidence > 0.55) {
    return { corrected: garmentType, confidence };
  }

  // Only apply for the one strong geometric signal: very wide images are almost
  // always footwear. All other aspect ratios are too ambiguous to override.
  if (aspectRatio > 2.0) {
    const modelCategory = GARMENT_SHAPE_CATEGORY[garmentType];
    if (modelCategory !== 'footwear') {
      // Find the best footwear label
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < logits.length; i++) {
        const label = GARMENT_LABELS[i];
        if (GARMENT_SHAPE_CATEGORY[label] === 'footwear' && logits[i] > bestScore) {
          bestScore = logits[i];
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        const corrected = GARMENT_LABELS[bestIdx];
        const newConf = logitToConfidence(bestScore);
        console.log(
          `[Ojo] Shape heuristic override: ${garmentType} → ${corrected} `
          + `(aspect=${aspectRatio.toFixed(2)}, very wide → footwear)`
        );
        return { corrected, confidence: newConf };
      }
    }
  }

  return { corrected: garmentType, confidence };
}

// ─── Main identifier ──────────────────────────────────────────────────────────

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

  let garmentType: GarmentType = 'unknown';
  let topLabelText = '';
  let confidence = 0;
  const rawLabels: RawLabel[] = [];

  // ── Step 0: Get image dimensions for shape heuristics ─────────
  let aspectRatio = 1.0;
  try {
    const info = await ImageManipulator.manipulateAsync(imageUri, []);
    if (info.width && info.height) {
      aspectRatio = info.width / info.height;
    }
  } catch { /* fallback to 1.0 */ }

  // ── Step 1: TFLite inference ──────────────────────────────────
  const model = await getModel();
  const inputShape = model?.inputs[0]?.shape ?? [1, MODEL_SIZE, MODEL_SIZE, 3];
  const tensor = model ? await imageToTensor(imageUri, inputShape) : null;

  if (!model)  console.error('[Ojo] identifyClothing: model is null — check load errors above');
  if (!tensor) console.error('[Ojo] identifyClothing: tensor is null — check imageToTensor errors above');

  if (model && tensor) {
    try {
      const outputs = model.runSync([tensor.buffer as ArrayBuffer]);
      const garmentLogits = new Float32Array(outputs[0]);
      const sleeveLogits  = new Float32Array(outputs[1]);

      const gIdx = argmax(garmentLogits);
      const sIdx = argmax(sleeveLogits);

      garmentType = GARMENT_LABELS[gIdx] ?? 'unknown';
      confidence  = logitToConfidence(garmentLogits[gIdx]);

      // ── Step 1b: Geometric heuristic correction ─────────────────
      const corrected = applyShapeHeuristic(garmentType, confidence, garmentLogits, aspectRatio);
      garmentType = corrected.corrected;
      confidence  = corrected.confidence;

      const sleeveLabel = SLEEVE_LABELS[sIdx] ?? 'n/a';
      topLabelText = garmentType;

      // Apply sleeve override for tops (e.g. t-shirt + long-sleeve → long-sleeve-shirt)
      if (TOP_GARMENTS.has(garmentType) && sleeveLabel !== 'n/a') {
        const override = SLEEVE_OVERRIDES[`${garmentType}+${sleeveLabel}`];
        if (override) garmentType = override;
        topLabelText = `${garmentType} (${sleeveLabel})`;
      }

      rawLabels.push({ text: topLabelText, confidence });
    } catch (e) {
      console.error('[Ojo] TFLite runSync FAILED:', e);
    }
  }

  // ── Step 2: Dominant colors ───────────────────────────────────
  const colors = await extractColorsFromImage(imageUri, cfg.maxColors);

  // ── Step 3: Color-informed garment refinement ─────────────────
  // If dominant color is classic denim blue and model says generic "pants", upgrade to "jeans"
  if (garmentType === 'pants' && colors.length > 0) {
    const topColor = colors[0].name.toLowerCase();
    if (topColor.includes('denim') || topColor === 'navy' || topColor === 'dark blue') {
      garmentType = 'jeans';
      topLabelText = 'jeans';
    }
  }

  // ── Step 4: Fabric heuristic ──────────────────────────────────
  const fabric = GARMENT_TO_FABRIC[garmentType] ?? GARMENT_TO_FABRIC['unknown'];

  return { garmentType, topLabelText, colors, fabric, confidence, rawLabels };
}
