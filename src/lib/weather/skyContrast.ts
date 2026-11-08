/**
 * skyContrast — keeps Home's white text readable on pale skies.
 *
 * Home draws white text and clear glass straight onto the weather gradient.
 * That works on dark skies (clear night measures 5–10:1) but not on the pale
 * ones: snow, sunny and clear days, sunrise and sunset, hot, fog and haze all
 * fade toward a near-white horizon, and the hourly tiles and Share button
 * measured 1.1–1.7:1 there (WCAG asks 4.5:1 for text that size).
 *
 * The call is made from the gradient itself rather than a list of conditions,
 * because the clear-sky gradient is blended by sun elevation (skyGradient.ts):
 * the same "Clear" is dark at night and pale at noon.
 */

type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb | null {
    if (!/^#?[0-9a-f]{6}$/i.test(hex)) return null;
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb;
}

/** WCAG relative luminance of an sRGB colour with 0–255 channels. */
function luminanceOf(rgb: Rgb): number {
    const channel = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG relative luminance of a #RRGGBB colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
    const h = hex.replace('#', '');
    return luminanceOf([0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb);
}

/**
 * At or above this, white text on the gradient's lowest stop falls under about
 * 3.5:1, and the 65%-white labels Home uses there fall well under 3:1. Drizzle's
 * horizon (0.26) is the darkest sky that crosses it.
 */
export const LIGHT_SKY_LUMINANCE = 0.25;

/**
 * True when the sky gets pale enough that Home's glass tiles and secondary
 * text need the dark treatment. Judged on the last stop, the horizon, which is
 * the lightest band on every Ojo sky and where the Share button sits.
 */
export function isLightSky(gradient: readonly string[]): boolean {
    const horizon = gradient[gradient.length - 1];
    if (!horizon || !/^#?[0-9a-f]{6}$/i.test(horizon)) return false;
    return relativeLuminance(horizon) >= LIGHT_SKY_LUMINANCE;
}

/**
 * Dark navy laid over glass on a light sky, so white text has a surface. At
 * 0.6 white text clears 4.5:1 even over snow's near-white horizon (#E0F2FE).
 */
export const LIGHT_SKY_SCRIM = 'rgba(15, 23, 42, 0.6)';

/**
 * Home's outfit/details card on a light sky. Its glass takes a navy tint
 * (the native glass tint, so it keeps its depth and edge highlights), the
 * glass surfaces inside it a lighter one, and the card's grey text is lifted
 * to near-white. Together they keep every line on the card above 4.5:1 on
 * snow, sunny, hot and fog (lowest measured 4.88:1, folded cover) with the
 * card at L* 34–38, about halfway between bare glass and its night look. A
 * navy tint alone needed 0.7, which left the item labels at 3:1 and turned
 * the card into a dark slab under a pale sky.
 */
export const LIGHT_SKY_CARD_TINT = 'rgba(15, 23, 42, 0.4)';
export const LIGHT_SKY_INNER_TINT = 'rgba(15, 23, 42, 0.3)';
/**
 * Colour tokens swapped in on the card. Text stays white or near-white; the
 * score, confidence and UV/air pills move to opaque light shades of their
 * hues (emerald, amber, slate 300, red 200), which their translucent defaults
 * fall short of on the lighter card (green measured 3.2:1).
 */
export const LIGHT_SKY_CARD_TEXT = {
    textSecondary: 'rgba(255, 255, 255, 0.9)',
    textMuted: 'rgba(255, 255, 255, 0.82)',
    ratingHigh: '#6EE7B7',
    ratingMid: '#FCD34D',
    ratingLow: '#CBD5E1',
    ratingPoor: '#FECACA',
} as const;

/**
 * Text drawn straight onto a light sky: full white (Home's 55–75% greys vanish
 * there) with a soft dark halo. Full rather than 95% white because it lets the
 * sky behind it stay lighter: white passes 4.5:1 over a sky up to L* ~50, 95%
 * white only up to ~47. The halo isn't counted toward contrast.
 */
export const LIGHT_SKY_TEXT = {
    color: '#FFFFFF',
    textShadowColor: 'rgba(15, 23, 42, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
} as const;

/**
 * A fade over the top of a light sky, behind the place and temperature, sized
 * to that sky. White can't reach 4.5:1 on the palest skies by itself (snow's
 * mid band allows 1.8:1 at most), so the sky under the header is darkened, but
 * only as far as the header's text needs.
 *
 * The amount is worked out from the gradient rather than fixed. A single navy
 * fade for every light sky darkened hot and fog by about 0.45 when they needed
 * about 0.15 at most, turning hot maroon-brown, and darkened the tops of snow
 * and sunny more than the large city name there needs. The fade is the sky's
 * own top colour, deepened, so a blue sky stays blue instead of going slate.
 *
 * Fractions below are of the screen's height, the same box the sky gradient
 * fills. The header's small text (condition, updated time, feels-like, high and
 * low) sits between SMALL_TEXT_FROM and FADE_MID on every Home layout measured
 * (Duo cover and Duo two-pane); the place name above it is large text.
 */
const FADE_MID = 0.45;
const FADE_END = 0.64;

const SMALL_TEXT_FROM = 0.15;
const LARGE_TEXT_AT = 0.05;

/** Where a layout's small text sits on the sky, as fractions of the screen's height. */
export interface TextBand {
    from: number;
    to: number;
}
const DEFAULT_TEXT_BAND: TextBand = { from: SMALL_TEXT_FROM, to: FADE_MID };
/**
 * Duo inner screen turned upright: the condition line sits a little higher than
 * on other Home layouts, and the four stats lower, just above the fold.
 */
export const STACKED_HOME_TEXT_BAND: TextBand = { from: 0.135, to: 0.475 };
/**
 * WCAG AA is 4.5:1 for body text and 3:1 for large text. These sit a hair above
 * it on purpose: every bit of headroom darkens the palest skies. The backdrop
 * allowance below is the margin; it judges the sky by its bright side, and
 * on the simulator the header text measured 4.7:1 or better against the sky
 * beside it.
 */
const SMALL_TEXT_TARGET = 4.55;
const LARGE_TEXT_TARGET = 3.05;
/**
 * The backdrop layers sit between the gradient and the text and lighten the sky
 * there. Measured on the simulator, behind the header text: sun glare lifted it
 * 10–13% toward white and fog drift up to 14% at its brightest; the typical sky
 * beside the text, less. Glare and fog get 12%. Falling snow is sparse and
 * barely lifts the sky the text sits on, so particle skies (and skies with no
 * backdrop) get 5%. Over-allowing here is what darkens the sky for nothing.
 */
export const HAZY_BACKDROP_LIFT = 0.12;
export const PARTICLE_BACKDROP_LIFT = 0.05;
/** The fade's colour: the sky's top stop at this fraction of its brightness. */
const FADE_DEPTH = 0.3;

export interface SkyFade {
    colors: readonly [string, string, string];
    locations: readonly [number, number, number];
}

/** The sky behind the text at height `y`: the gradient (stops evenly spaced), lifted by the backdrop. */
function skyAt(stops: readonly Rgb[], y: number, lift: number): Rgb {
    const span = stops.length - 1;
    const t = Math.min(Math.max(y, 0), 1) * span;
    const i = Math.min(Math.floor(t), span - 1);
    const f = t - i;
    return stops[i].map((c, k) => {
        const v = c + (stops[i + 1][k] - c) * f;
        return v + (255 - v) * lift;
    }) as unknown as Rgb;
}

function mix(under: Rgb, over: Rgb, alpha: number): Rgb {
    return under.map((c, k) => c * (1 - alpha) + over[k] * alpha) as unknown as Rgb;
}

/** Contrast of LIGHT_SKY_TEXT's white against `bg`. */
function labelContrast(bg: Rgb): number {
    const text: Rgb = [255, 255, 255];
    return (luminanceOf(text) + 0.05) / (luminanceOf(bg) + 0.05);
}

/** The least opacity of `fade` over `bg` that brings the label to `target`. */
function alphaFor(bg: Rgb, fade: Rgb, target: number): number {
    if (labelContrast(bg) >= target) return 0;
    let lo = 0;
    let hi = 1;
    for (let n = 0; n < 24; n++) {
        const mid = (lo + hi) / 2;
        if (labelContrast(mix(bg, fade, mid)) >= target) hi = mid;
        else lo = mid;
    }
    return hi;
}

/**
 * The fade for a light sky, or null when its header already reads without one.
 * `backdropLift` is HAZY_BACKDROP_LIFT when sun glare or fog drift is drawn,
 * PARTICLE_BACKDROP_LIFT otherwise.
 * Full strength `top` at the top of the screen, `mid` at `band.to`, gone by
 * FADE_END. `mid` covers the lowest small text; `top` is the least that keeps
 * the large text at the top and every small-text line in between passing.
 */
export function lightSkyFade(
    gradient: readonly string[],
    backdropLift: number = HAZY_BACKDROP_LIFT,
    band: TextBand = DEFAULT_TEXT_BAND,
): SkyFade | null {
    const stops = gradient.map(parseHex);
    if (stops.length < 2 || stops.some((s) => s === null)) return null;
    const sky = stops as Rgb[];
    const fade = sky[0].map((c) => Math.round(c * FADE_DEPTH)) as unknown as Rgb;

    const mid = alphaFor(skyAt(sky, band.to, backdropLift), fade, SMALL_TEXT_TARGET);
    let top = alphaFor(skyAt(sky, LARGE_TEXT_AT, backdropLift), fade, LARGE_TEXT_TARGET);
    // Between the top and `band.to` the opacity is a straight line from `top`
    // to `mid`; raise `top` until every small-text height clears.
    // Whole steps, so float drift can't land a sample a hair under `band.to`,
    // where 1 - w is ~0 and the division below blows up.
    const steps = Math.round((band.to - band.from) / 0.05);
    for (let i = 0; i < steps; i++) {
        const y = band.from + i * 0.05;
        const w = y / band.to;
        const need = alphaFor(skyAt(sky, y, backdropLift), fade, SMALL_TEXT_TARGET);
        top = Math.max(top, (need - mid * w) / (1 - w));
    }
    top = Math.min(Math.max(top, 0), 1);
    // Draw even a faint fade: skipping one that's needed, however small, can
    // leave a sky a hair under 4.5:1.
    if (top <= 0 && mid <= 0) return null;

    const rgba = (a: number) => `rgba(${fade[0]}, ${fade[1]}, ${fade[2]}, ${Math.ceil(a * 100) / 100})`;
    return {
        colors: [rgba(top), rgba(mid), rgba(0)],
        locations: [0, band.to, FADE_END],
    };
}
