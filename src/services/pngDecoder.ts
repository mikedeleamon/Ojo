/**
 * pngDecoder.ts — pure, dependency-free base64/PNG decoding.
 *
 * Deliberately has no import of expo-image-manipulator or any native module:
 * colorExtractor.ts and clothingIdentifier.ts both need this logic, but they
 * also pull in native-module imports that this project's jest config
 * (plain ts-jest, no RN preset) can't parse — keeping this file clean lets it
 * be unit-tested directly instead of only indirectly through those.
 */

import { inflate } from 'pako';

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

interface DecodedPNG {
  width: number;
  height: number;
  channels: number; // 3 = RGB, 4 = RGBA
  recon: Uint8Array;
}

/** Chunk-walk + zlib-inflate + PNG filter reconstruction — the one copy of
 *  this logic shared by both parsePNGPixels and parsePNGPixelsRGBA below. */
function decodePNGRaw(bytes: Uint8Array): DecodedPNG | null {
  // Validate PNG signature
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;

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

  if (!width || !height || !idatParts.length) return null;

  // Concatenate all IDAT chunks then decompress
  const totalLen  = idatParts.reduce((s, c) => s + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let pos = 0;
  for (const chunk of idatParts) { compressed.set(chunk, pos); pos += chunk.length; }

  let raw: Uint8Array;
  try { raw = inflate(compressed); } catch { return null; }

  // Channels: RGB = 3, RGBA = 4
  const channels = colorType === 6 ? 4 : 3;
  const stride = 1 + width * channels; // 1 filter byte + pixel data per row

  const recon = new Uint8Array(height * width * channels);

  for (let y = 0; y < height; y++) {
    const filter   = raw[y * stride];
    const rowBase  = y * stride + 1;
    const reconRow = y * width * channels;
    const prevRow  = y > 0 ? recon.subarray((y - 1) * width * channels, y * width * channels) : null;

    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        const rawVal = raw[rowBase + x * channels + c];
        const left   = x > 0 ? recon[reconRow + (x - 1) * channels + c] : 0;
        const up     = prevRow ? prevRow[x * channels + c] : 0;
        const upLeft = (x > 0 && prevRow) ? prevRow[(x - 1) * channels + c] : 0;

        let v: number;
        switch (filter) {
          case 0:  v = rawVal; break;                                               // None
          case 1:  v = (rawVal + left) & 0xFF; break;                              // Sub
          case 2:  v = (rawVal + up) & 0xFF; break;                                // Up
          case 3:  v = (rawVal + Math.floor((left + up) / 2)) & 0xFF; break;       // Average
          case 4:  v = (rawVal + paeth(left, up, upLeft)) & 0xFF; break;           // Paeth
          default: v = rawVal;
        }
        recon[reconRow + x * channels + c] = v;
      }
    }
  }

  return { width, height, channels, recon };
}

export function parsePNGPixels(bytes: Uint8Array): Array<[number, number, number]> {
  const decoded = decodePNGRaw(bytes);
  if (!decoded) return [];

  const { width, height, channels, recon } = decoded;
  const pixels: Array<[number, number, number]> = [];
  for (let y = 0; y < height; y++) {
    const reconRow = y * width * channels;
    for (let x = 0; x < width; x++) {
      const i = reconRow + x * channels;
      pixels.push([recon[i], recon[i + 1], recon[i + 2]]);
    }
  }
  return pixels;
}

/** Same decode as parsePNGPixels, but keeps the alpha channel (255 when the
 *  source has none) — needed to tell segmented-out background apart from
 *  real garment pixels. */
export function parsePNGPixelsRGBA(bytes: Uint8Array): Array<[number, number, number, number]> {
  const decoded = decodePNGRaw(bytes);
  if (!decoded) return [];

  const { width, height, channels, recon } = decoded;
  const pixels: Array<[number, number, number, number]> = [];
  for (let y = 0; y < height; y++) {
    const reconRow = y * width * channels;
    for (let x = 0; x < width; x++) {
      const i = reconRow + x * channels;
      const a = channels === 4 ? recon[i + 3] : 255;
      pixels.push([recon[i], recon[i + 1], recon[i + 2], a]);
    }
  }
  return pixels;
}

/** Alpha-composite RGBA pixels onto a flat background (white by default).
 *  A segmented cutout's "background" is transparent, not any particular RGB
 *  value, so blending it out here (rather than just dropping alpha) avoids
 *  handing the classifier whatever incidental color sits under a
 *  fully-transparent pixel. A no-op for already-opaque images (alpha=255
 *  everywhere), so it's safe to apply unconditionally to any decoded PNG. */
export function compositeOnBackground(
  pixels: Array<[number, number, number, number]>,
  bg = 255,
): Array<[number, number, number]> {
  return pixels.map(([r, g, b, a]) => {
    const t = a / 255;
    return [
      Math.round(r * t + bg * (1 - t)),
      Math.round(g * t + bg * (1 - t)),
      Math.round(b * t + bg * (1 - t)),
    ];
  });
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
