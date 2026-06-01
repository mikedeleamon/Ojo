// All helpers below are marked 'worklet' so Reanimated can invoke them from the
// UI thread inside useAnimatedProps. They remain ordinary functions when called
// from JS — the directive is additive, not exclusive.

/** Parse hex (#RRGGBB or #RGB) to [r, g, b] (0–255). */
export const hexToRgb = (hex: string): [number, number, number] => {
    'worklet';
    const h = hex.replace('#', '');
    if (h.length === 3) {
        return [
            parseInt(h[0] + h[0], 16),
            parseInt(h[1] + h[1], 16),
            parseInt(h[2] + h[2], 16),
        ];
    }
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ];
};

/** Convert [r, g, b] back to #RRGGBB. */
export const rgbToHex = (r: number, g: number, b: number): string => {
    'worklet';
    const toHex = (n: number) => {
        'worklet';
        return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Convert RGB (0–255) to HSL (h: 0–360, s/l: 0–1). */
export const rgbToHsl = (
    r: number,
    g: number,
    b: number,
): [number, number, number] => {
    'worklet';
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
            case g: h = ((b - r) / d + 2) * 60; break;
            case b: h = ((r - g) / d + 4) * 60; break;
        }
    }
    return [h, s, l];
};

/** Convert HSL back to RGB (0–255). */
export const hslToRgb = (
    h: number,
    s: number,
    l: number,
): [number, number, number] => {
    'worklet';
    h = ((h % 360) + 360) % 360;
    if (s === 0) {
        const v = l * 255;
        return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = h / 360;
    const hue2rgb = (t: number) => {
        'worklet';
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [
        hue2rgb(hk + 1 / 3) * 255,
        hue2rgb(hk) * 255,
        hue2rgb(hk - 1 / 3) * 255,
    ];
};

/**
 * Interpolate two hex colors via HSL space.
 * Stays in vibrant hue space rather than passing through muddy grey midpoints,
 * which is what RGB interpolation does for distant hues.
 */
export const lerpColor = (from: string, to: string, t: number): string => {
    'worklet';
    const [r1, g1, b1] = hexToRgb(from);
    const [r2, g2, b2] = hexToRgb(to);
    const [h1, s1, l1] = rgbToHsl(r1, g1, b1);
    const [h2, s2, l2] = rgbToHsl(r2, g2, b2);

    let dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
    const h = h1 + dh * t;

    const effectiveH = s1 < 0.05 ? h2 : h;

    const s = s1 + (s2 - s1) * t;
    const l = l1 + (l2 - l1) * t;

    const [r, g, b] = hslToRgb(effectiveH, s, l);
    return rgbToHex(r, g, b);
};

/** Smooth easing (ease-in-out) for staggered per-stop progress. */
export const easeInOut = (t: number): number => {
    'worklet';
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

// ── Fast HSL path for the per-frame gradient worklet ─────────────────────────
// Pre-parsing hex to HSL once on the JS side lets the UI-thread worklet skip
// `parseInt` and `toString(16)` for the "from" side every frame. Only the
// final HSL→hex serialisation happens in the worklet.

/** Parse #RRGGBB / #RGB to [h, s, l]. JS-side (called once per transition). */
export const hexToHsl = (hex: string): [number, number, number] => {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHsl(r, g, b);
};

/** Flatten an array of hex colors to a packed [h0,s0,l0, h1,s1,l1, …] buffer. */
export const flattenHsl = (colors: readonly string[]): number[] => {
    const out: number[] = new Array(colors.length * 3);
    for (let i = 0; i < colors.length; i++) {
        const [h, s, l] = hexToHsl(colors[i]);
        out[i * 3] = h;
        out[i * 3 + 1] = s;
        out[i * 3 + 2] = l;
    }
    return out;
};

const HEX_CHARS = '0123456789abcdef';

/** HSL → #RRGGBB. Worklet-safe; avoids padStart by indexing a constant table. */
export const hslToHex = (h: number, s: number, l: number): string => {
    'worklet';
    const [r, g, b] = hslToRgb(h, s, l);
    const ri = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
    const gi = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
    const bi = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
    return (
        '#' +
        HEX_CHARS[(ri >> 4) & 0xf] + HEX_CHARS[ri & 0xf] +
        HEX_CHARS[(gi >> 4) & 0xf] + HEX_CHARS[gi & 0xf] +
        HEX_CHARS[(bi >> 4) & 0xf] + HEX_CHARS[bi & 0xf]
    );
};

/**
 * Interpolate a packed HSL gradient with per-stop staggering and shortest-path
 * hue blending. JS-side helper for snapshotting an in-flight transition.
 */
export const lerpHslFlat = (
    from: readonly number[],
    to: readonly number[],
    t: number,
): number[] => {
    const stagger = 0.15;
    const stops = from.length / 3;
    const out = new Array(from.length);
    for (let i = 0; i < stops; i++) {
        const offset = (i / Math.max(1, stops - 1)) * stagger;
        let stopT = (t - offset) / (1 - stagger);
        if (stopT < 0) stopT = 0;
        else if (stopT > 1) stopT = 1;
        const e = easeInOut(stopT);
        const b = i * 3;
        const h1 = from[b],     s1 = from[b + 1], l1 = from[b + 2];
        const h2 = to[b],       s2 = to[b + 1],   l2 = to[b + 2];
        let dh = h2 - h1;
        if (dh > 180) dh -= 360;
        else if (dh < -180) dh += 360;
        const h = s1 < 0.05 ? h2 : h1 + dh * e;
        out[b]     = h;
        out[b + 1] = s1 + (s2 - s1) * e;
        out[b + 2] = l1 + (l2 - l1) * e;
    }
    return out;
};

/**
 * Interpolate an array of color stops with per-stop staggering.
 * Each stop's animation is offset by a small delay so the gradient appears to
 * "wave" through colors rather than every pixel moving in lockstep.
 */
export const lerpGradient = (
    from: readonly string[],
    to: readonly string[],
    t: number,
): string[] => {
    'worklet';
    const stagger = 0.15;
    return to.map((_, i) => {
        const offset = (i / Math.max(1, to.length - 1)) * stagger;
        const stopT = Math.max(0, Math.min(1, (t - offset) / (1 - stagger)));
        return lerpColor(from[i] ?? from[0], to[i] ?? to[0], easeInOut(stopT));
    });
};
