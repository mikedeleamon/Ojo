// ─── Garment Types ───────────────────────────────────────────────────────────

export type GarmentType =
  | 't-shirt'
  | 'long-sleeve-shirt'
  | 'dress-shirt'
  | 'polo'
  | 'tank-top'
  | 'hoodie'
  | 'sweatshirt'
  | 'sweater'
  | 'cardigan'
  | 'jacket'
  | 'blazer'
  | 'coat'
  | 'puffer'
  | 'vest'
  | 'jeans'
  | 'pants'
  | 'shorts'
  | 'leggings'
  | 'skirt'
  | 'dress'
  | 'jumpsuit'
  | 'unknown';

// ─── Fabric Types ─────────────────────────────────────────────────────────────

export type FabricConfidence = 'high' | 'medium' | 'low';

export interface FabricGuess {
  type: string;
  confidence: FabricConfidence;
  note?: string;
}

// ─── Color ────────────────────────────────────────────────────────────────────

export interface DetectedColor {
  name: string;
  hex: string;
  prominence: number;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface ClothingIdentificationResult {
  garmentType: GarmentType;
  colors: DetectedColor[];
  fabric: FabricGuess;
  confidence: number;
  rawLabels: RawLabel[];
}

export interface RawLabel {
  text: string;
  confidence: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ClothingIdentifierConfig {
  modelPath?: string;
  confidenceThreshold?: number;
  maxColors?: number;
}
