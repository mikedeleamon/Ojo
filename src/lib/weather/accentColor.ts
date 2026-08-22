import { hexToHsl, hslToHex } from '../../components/WeatherHUD/colorMath';

/**
 * Derives a single accent colour from a weather gradient, for chrome that has
 * to sit *beside* the gradient rather than be painted with it — currently the
 * native tab bar tint (see app/(tabs)/_layout.tsx).
 *
 * Why not just use a gradient stop verbatim: the stops are chosen to look right
 * as a full-bleed background, which is the opposite of what a 20pt tab icon
 * needs. `cloudy` is three greys, `snow` ends on near-white, `clearNight` is
 * almost black — all of them illegible or lifeless as a tint. So we pick the
 * stop that carries the most of the condition's identity, then pull it into a
 * lightness/saturation band that stays readable on both a light and a dark tab
 * bar without losing the hue that ties it to the sky behind it.
 */

/** Accent band — the widest range that still reads on light *and* dark chrome. */
const MIN_L = 0.55;
const MAX_L = 0.72;
/** Below this the hue is noise, not a colour (pure greys). */
const GREY_S = 0.05;
/** Floor so slate/grey palettes tint rather than land on dead grey. */
const MIN_S = 0.45;
/** Ceiling: fully-saturated tints vibrate against the blurred bar material. */
const MAX_S = 0.85;

/** Lightness the scorer treats as ideal; stops are penalised by distance from it. */
const IDEAL_L = 0.55;

/** Used when every stop is a true grey, so there's no hue worth preserving. */
export const FALLBACK_ACCENT = '#7DD3FC';

/**
 * Scores a stop on how well it represents the palette: saturated is good,
 * near-black or near-white is bad regardless of how saturated it claims to be.
 */
const identityScore = (s: number, l: number): number =>
    s * (1 - Math.min(1, Math.abs(l - IDEAL_L) / IDEAL_L));

const clamp = (n: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, n));

/**
 * @param gradient Stop array from `gradientFor` (top → bottom of screen).
 * @returns A `#rrggbb` accent, or {@link FALLBACK_ACCENT} for greyscale input.
 */
export const accentFromGradient = (gradient: readonly string[]): string => {
    if (gradient.length === 0) return FALLBACK_ACCENT;

    let best: [number, number, number] | null = null;
    let bestScore = -1;

    for (const stop of gradient) {
        const [h, s, l] = hexToHsl(stop);
        const score = identityScore(s, l);
        if (score > bestScore) {
            bestScore = score;
            best = [h, s, l];
        }
    }

    if (!best) return FALLBACK_ACCENT;

    const [h, s, l] = best;
    // A greyscale winner means the whole palette was grey — its hue is an
    // artefact of rounding, so boosting saturation would invent a colour.
    if (s < GREY_S) return FALLBACK_ACCENT;

    return hslToHex(h, clamp(s, MIN_S, MAX_S), clamp(l, MIN_L, MAX_L));
};
