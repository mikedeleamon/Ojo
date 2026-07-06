/**
 * colorExtractor.ts — pixel-based color extraction.
 *
 * Strategy:
 *   1. Try the native OjoVisionBridge (iOS 17+ Vision subject segmentation)
 *      to get a garment-only cutout. Falls back to a blind inner-60%
 *      center-crop whenever segmentation is unavailable or unconfident —
 *      old OS, Android, Expo Go, or no subject found.
 *   2. Resize to a 32×32 thumbnail using expo-image-manipulator (PNG).
 *   3. Decode the base64 PNG (see pngDecoder.ts): pako inflates the IDAT
 *      chunk, PNG filter reconstruction gives us raw pixels (RGB, or RGBA
 *      when the source is a segmented cutout — transparent pixels are
 *      dropped before clustering).
 *   4. Convert to CIE Lab, drop extreme-lightness outliers (shadow creases,
 *      specular highlights), k-means cluster in Lab space, then name each
 *      cluster's centroid — naming happens once per cluster, not per pixel.
 *
 * No native modules required — the segmentation step degrades gracefully
 * when the bridge isn't linked, so this still works on any platform.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { rgbToLab, nearestColorNameFromLab } from './colorUtils';
import { segmentGarment, isVisionBridgeAvailable } from '../lib/vision/native';
import { base64ToBytes, parsePNGPixels, parsePNGPixelsRGBA } from './pngDecoder';
import type { DetectedColor } from './clothingIdentifier.types';

const SAMPLE_SIZE = 32; // 32×32 = 1024 pixel samples

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractColorsFromImage(
  imageUri: string,
  maxColors = 3,
): Promise<DetectedColor[]> {
  try {
    const maskedUri = await segmentGarment(imageUri);
    // Diagnostic: `bridge=absent` here means the native module isn't linked
    // into the build (Podfile.lock missing OjoVisionBridge) — every photo
    // then silently uses the heuristic crop, so segmentation is never tested.
    console.log(
      `[Ojo][vision] bridge=${isVisionBridgeAvailable() ? 'linked' : 'absent'} `
      + `segment=${maskedUri ? 'cutout' : 'null'}`,
    );

    if (maskedUri) {
      const colors = await extractFromMaskedImage(maskedUri, maxColors);
      if (colors.length > 0) {
        logColorPath('segmented', colors);
        return colors;
      }
      console.log('[Ojo][vision] cutout had no usable pixels — falling back to heuristic crop');
    }

    const colors = await extractFromHeuristicCrop(imageUri, maxColors);
    logColorPath('heuristic-crop', colors);
    return colors;
  } catch (e) {
    console.warn('[Ojo] colorExtractor error:', e);
    return [];
  }
}

/** One greppable line per identification: which path won and the colors it
 *  produced — so an on-device test can be read from the Metro logs. */
function logColorPath(path: string, colors: DetectedColor[]): void {
  const summary = colors
    .map((c) => `${c.name} ${(c.prominence * 100).toFixed(0)}%`)
    .join(', ');
  console.log(`[Ojo][vision] colors via ${path}: ${summary || '(none)'}`);
}

/** Vision has already isolated the garment — no blind crop needed, just
 *  resize and drop whatever background sliver came through as transparent. */
async function extractFromMaskedImage(
  maskedUri: string,
  maxColors: number,
): Promise<DetectedColor[]> {
  const small = await ImageManipulator.manipulateAsync(
    maskedUri,
    [{ resize: { width: SAMPLE_SIZE, height: SAMPLE_SIZE } }],
    { format: ImageManipulator.SaveFormat.PNG, base64: true },
  );
  if (!small.base64) return [];

  const bytes = base64ToBytes(small.base64);
  const rgba = parsePNGPixelsRGBA(bytes);
  if (rgba.length === 0) return [];

  const ALPHA_THRESHOLD = 32; // drop fully- and near-transparent (anti-aliased edge) pixels
  const pixels: Array<[number, number, number]> = rgba
    .filter(([, , , a]) => a >= ALPHA_THRESHOLD)
    .map(([r, g, b]) => [r, g, b]);
  if (pixels.length === 0) return [];

  return clusterColors(pixels, maxColors);
}

/** No segmentation available — same blind inner-60% center-crop as before. */
async function extractFromHeuristicCrop(
  imageUri: string,
  maxColors: number,
): Promise<DetectedColor[]> {
  const original = await ImageManipulator.manipulateAsync(imageUri, []);
  const ow = original.width;
  const oh = original.height;
  const cropRatio = 0.6;
  const cx = Math.round(ow * (1 - cropRatio) / 2);
  const cy = Math.round(oh * (1 - cropRatio) / 2);
  const cw = Math.round(ow * cropRatio);
  const ch = Math.round(oh * cropRatio);

  const small = await ImageManipulator.manipulateAsync(
    imageUri,
    [
      { crop: { originX: cx, originY: cy, width: cw, height: ch } },
      { resize: { width: SAMPLE_SIZE, height: SAMPLE_SIZE } },
    ],
    { format: ImageManipulator.SaveFormat.PNG, base64: true },
  );
  if (!small.base64) return [];

  const bytes = base64ToBytes(small.base64);
  const pixels = parsePNGPixels(bytes);
  if (pixels.length === 0) return [];

  return clusterColors(pixels, maxColors);
}

// ─── Color clustering ─────────────────────────────────────────────────────────
// Cluster the sampled pixels in CIE Lab space (perceptually uniform, unlike
// raw RGB) instead of voting on whichever fixed color-table entry each pixel
// happens to land nearest to. Naming happens once per cluster centroid, not
// per pixel, so folds and shadows within one fabric color land in the same
// cluster instead of splitting the vote across neighboring color names.

const TRIM_PERCENT = 0.1; // drop the darkest/lightest 10% — shadow creases and specular highlights, not the fabric's real color
const KMEANS_ITERATIONS = 8;

type LabPoint = { l: number; a: number; b: number };

function kMeansLab(points: LabPoint[], k: number): Array<LabPoint & { count: number }> {
  const n = points.length;
  const K = Math.max(1, Math.min(k, n));

  // Deterministic seed (no RNG): spread initial centroids evenly across the
  // lightness range so the same photo always clusters the same way.
  const byLightness = [...points].sort((p, q) => p.l - q.l);
  let centroids: LabPoint[] = Array.from({ length: K }, (_, i) => {
    const idx = K === 1 ? 0 : Math.round((i * (n - 1)) / (K - 1));
    return { ...byLightness[idx] };
  });

  const assignments = new Int32Array(n);
  for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < K; c++) {
        const dl = points[i].l - centroids[c].l;
        const da = points[i].a - centroids[c].a;
        const db = points[i].b - centroids[c].b;
        const dist = dl * dl + da * da + db * db;
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      assignments[i] = best;
    }

    const sums = Array.from({ length: K }, () => ({ l: 0, a: 0, b: 0, count: 0 }));
    for (let i = 0; i < n; i++) {
      const s = sums[assignments[i]];
      s.l += points[i].l; s.a += points[i].a; s.b += points[i].b; s.count++;
    }
    centroids = centroids.map((c, idx) => (sums[idx].count > 0
      ? { l: sums[idx].l / sums[idx].count, a: sums[idx].a / sums[idx].count, b: sums[idx].b / sums[idx].count }
      : c));
  }

  const counts = new Array(K).fill(0);
  for (let i = 0; i < n; i++) counts[assignments[i]]++;

  return centroids
    .map((c, i) => ({ ...c, count: counts[i] }))
    .filter((c) => c.count > 0);
}

function clusterColors(
  pixels: Array<[number, number, number]>,
  maxColors: number,
): DetectedColor[] {
  const labPoints = pixels.map(([r, g, b]) => rgbToLab(r, g, b));

  // Drop extreme-lightness outliers before clustering (fall back to the full
  // set if trimming would leave too few points to cluster meaningfully).
  const byLightness = [...labPoints].sort((p, q) => p.l - q.l);
  const trimCount = Math.floor(byLightness.length * TRIM_PERCENT);
  const loBound = byLightness[trimCount]?.l ?? -Infinity;
  const hiBound = byLightness[byLightness.length - 1 - trimCount]?.l ?? Infinity;
  const trimmed = labPoints.filter((p) => p.l >= loBound && p.l <= hiBound);
  const points = trimmed.length >= maxColors ? trimmed : labPoints;

  const clusters = kMeansLab(points, maxColors + 2);
  const total = clusters.reduce((sum, c) => sum + c.count, 0);

  // Merge clusters that map to the same color name (e.g. two shades of navy
  // in different lighting) so the same name isn't reported twice.
  const named = new Map<string, { hex: string; count: number }>();
  for (const cluster of clusters) {
    const { name, hex } = nearestColorNameFromLab(cluster.l, cluster.a, cluster.b);
    const entry = named.get(name);
    if (entry) entry.count += cluster.count;
    else named.set(name, { hex, count: cluster.count });
  }

  return [...named.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, maxColors)
    .map(([name, { hex, count }]) => ({ name, hex, prominence: total > 0 ? count / total : 0 }));
}
