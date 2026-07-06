import { deflate } from 'pako';
import { parsePNGPixels, parsePNGPixelsRGBA } from '../pngDecoder';

// ─── Minimal synthetic PNG builder (test-only) ───────────────────────────────
// Builds an uncompressed-filter (type 0), 8-bit RGBA PNG from raw pixel
// values so the parser can be tested against known-exact output, including
// the alpha channel that parsePNGPixels intentionally discards.

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(type.split('').map((c) => c.charCodeAt(0)));
  const typeAndData = new Uint8Array(typeBytes.length + data.length);
  typeAndData.set(typeBytes, 0);
  typeAndData.set(data, typeBytes.length);

  const out = new Uint8Array(4 + typeAndData.length + 4);
  new DataView(out.buffer).setUint32(0, data.length, false);
  out.set(typeAndData, 4);
  new DataView(out.buffer).setUint32(4 + typeAndData.length, crc32(typeAndData), false);
  return out;
}

function buildRGBAPng(width: number, height: number, pixels: number[][]): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width, false);
  dv.setUint32(4, height, false);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const stride = 1 + width * 4;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type 0 (None) for every row
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixels[y * width + x];
      const base = y * stride + 1 + x * 4;
      raw[base] = r; raw[base + 1] = g; raw[base + 2] = b; raw[base + 3] = a;
    }
  }

  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = pngChunk('IHDR', ihdr);
  const idatChunk = pngChunk('IDAT', deflate(raw));
  const iendChunk = pngChunk('IEND', new Uint8Array(0));

  const out = new Uint8Array(signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let off = 0;
  out.set(signature, off); off += signature.length;
  out.set(ihdrChunk, off); off += ihdrChunk.length;
  out.set(idatChunk, off); off += idatChunk.length;
  out.set(iendChunk, off);
  return out;
}

describe('PNG pixel parsing', () => {
  const pixels = [
    [255, 0, 0, 255],     // opaque red
    [0, 255, 0, 128],     // half-alpha green
    [0, 0, 255, 0],       // fully transparent blue (segmented-out background)
    [255, 255, 255, 255], // opaque white
  ];
  const png = buildRGBAPng(2, 2, pixels);

  it('parsePNGPixels decodes RGB and drops alpha — the existing classifier path', () => {
    expect(parsePNGPixels(png)).toEqual([
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
    ]);
  });

  it('parsePNGPixelsRGBA preserves the alpha channel for the segmented-color path', () => {
    expect(parsePNGPixelsRGBA(png)).toEqual(pixels);
  });

  it('returns [] for garbage input rather than throwing', () => {
    expect(parsePNGPixels(new Uint8Array([1, 2, 3]))).toEqual([]);
    expect(parsePNGPixelsRGBA(new Uint8Array([1, 2, 3]))).toEqual([]);
  });
});
