/**
 * colorExtractor.ts — pure-JS pixel-based color extraction.
 *
 * Strategy:
 *   1. Resize the image to a 32×32 thumbnail using expo-image-manipulator (PNG).
 *   2. Decode the base64 PNG in JavaScript: pako inflates the IDAT chunk,
 *      PNG filter reconstruction gives us raw RGB pixels.
 *   3. Convert to CIE Lab, drop extreme-lightness outliers (shadow creases,
 *      specular highlights), k-means cluster in Lab space, then name each
 *      cluster's centroid — naming happens once per cluster, not per pixel.
 *
 * No native modules — works on any platform without a rebuild.
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { inflate } from 'pako';
import { rgbToLab, nearestColorNameFromLab } from './colorUtils';
import type { DetectedColor } from './clothingIdentifier.types';

const SAMPLE_SIZE = 32; // 32×32 = 1024 pixel samples

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractColorsFromImage(
  imageUri: string,
  maxColors = 3,
): Promise<DetectedColor[]> {
  try {
    // Center-crop to inner 60% first to focus on the garment, not the background
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
  } catch (e) {
    console.warn('[Ojo] colorExtractor error:', e);
    return [];
  }
}

// ─── Base64 decode ────────────────────────────────────────────────────────────

export function base64ToBytes(b64: string): Uint8Array {
  // atob is available in React Native (Hermes) since RN 0.72
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ─── Minimal PNG parser ───────────────────────────────────────────────────────

function readU32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

export function parsePNGPixels(bytes: Uint8Array): Array<[number, number, number]> {
  // Validate PNG signature
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return [];

  let offset = 8;
  let width = 0, height = 0, colorType = 2;
  const idatParts: Uint8Array[] = [];

  // Walk chunks
  while (offset + 8 <= bytes.length) {
    const length = readU32(bytes, offset);
    const type   = String.fromCharCode(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
    const data   = bytes.slice(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width     = readU32(data, 0);
      height    = readU32(data, 4);
      // data[8] = bit depth, data[9] = color type
      colorType = data[9]; // 2 = RGB, 6 = RGBA
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length; // 4 length + 4 type + N data + 4 CRC
  }

  if (!width || !height || !idatParts.length) return [];

  // Concatenate all IDAT chunks then decompress
  const totalLen  = idatParts.reduce((s, c) => s + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of idatParts) { compressed.set(chunk, pos); pos += chunk.length; }

  let raw: Uint8Array;
  try { raw = inflate(compressed); } catch { return []; }

  // Channels: RGB = 3, RGBA = 4
  const ch     = colorType === 6 ? 4 : 3;
  const stride = 1 + width * ch; // 1 filter byte + pixel data per row

  const recon = new Uint8Array(height * width * ch);
  const pixels: Array<[number, number, number]> = [];

  for (let y = 0; y < height; y++) {
    const filter   = raw[y * stride];
    const rowBase  = y * stride + 1;
    const reconRow = y * width * ch;
    const prevRow  = y > 0 ? recon.subarray((y - 1) * width * ch, y * width * ch) : null;

    for (let x = 0; x < width; x++) {
      for (let c = 0; c < ch; c++) {
        const rawVal = raw[rowBase + x * ch + c];
        const left   = x > 0 ? recon[reconRow + (x - 1) * ch + c] : 0;
        const up     = prevRow ? prevRow[x * ch + c] : 0;
        const upLeft = (x > 0 && prevRow) ? prevRow[(x - 1) * ch + c] : 0;

        let v: number;
        switch (filter) {
          case 0:  v = rawVal; break;                                               // None
          case 1:  v = (rawVal + left) & 0xFF; break;                              // Sub
          case 2:  v = (rawVal + up) & 0xFF; break;                                // Up
          case 3:  v = (rawVal + Math.floor((left + up) / 2)) & 0xFF; break;       // Average
          case 4:  v = (rawVal + paeth(left, up, upLeft)) & 0xFF; break;           // Paeth
          default: v = rawVal;
        }
        recon[reconRow + x * ch + c] = v;
      }
    }

    for (let x = 0; x < width; x++) {
      const i = reconRow + x * ch;
      pixels.push([recon[i], recon[i + 1], recon[i + 2]]);
    }
  }

  return pixels;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
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
