import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    useFrameCallback,
    SharedValue,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Path data ───────────────────────────────────────────────────────────────

const MOON_D =
    'M662.97,832.52h-36.75c-118-8.77-212.63-102.78-221.74-220.8l-.08-36.01c8.47-118.89,103.45-213.68,222.32-222.29l36.06.04c118.04,8.82,212.63,102.8,221.75,220.82l.08,36.02c-8.45,118.51-102.93,213.28-221.64,222.22Z';

/** Center and radius of the moon disc in the 1280×1280 viewBox. */
const MOON_CX = 644;
const MOON_CY = 593;
const MOON_R  = 240;

/**
 * Geometric SVG path for the illuminated portion of the moon.
 * phase: 0 = new moon, 0.25 = first quarter (right lit), 0.5 = full, 0.75 = last quarter.
 */
function moonPhasePath(cx: number, cy: number, r: number, phase: number): string {
    const p = ((phase % 1) + 1) % 1;
    if (p < 0.02 || p > 0.98) return '';
    if (Math.abs(p - 0.5) < 0.01) {
        return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
    }
    const top    = `${cx},${cy - r}`;
    const bottom = `${cx},${cy + r}`;
    const rx     = r * Math.abs(Math.cos(2 * Math.PI * p));
    if (p < 0.5) {
        const termSweep = p < 0.25 ? 0 : 1;
        return `M ${top} A ${r},${r} 0 0,1 ${bottom} A ${rx},${r} 0 0,${termSweep} ${top} Z`;
    } else {
        const termSweep = p < 0.75 ? 0 : 1;
        return `M ${top} A ${r},${r} 0 0,0 ${bottom} A ${rx},${r} 0 0,${termSweep} ${top} Z`;
    }
}

const STARS: { id: string; delay: number; duration: number; d: string }[] = [
    {
        id: 'star-1',
        delay: 0,
        duration: 3200,
        d: 'M684.66,136.16c-2.74,3.5-5.65,6.77-10.05,7.26-5.78.64-7.99-4.54-11.25-6.77-4.44-.08-8.56,1.04-12.1-2.4-3.33-3.23-1.33-8.45-1.92-11.59-2.59-3.49-6.75-5.2-6.71-10.2s3.18-7.89,7.04-10.92c-.36-3.6-1.44-8.45,1.61-11.72,3.34-3.59,8.33-2.62,12.11-2.21,2.48-3.96,5.11-7.9,10.16-7.91,5.31,0,8.83,3.04,10.96,8.19,3.87-1.16,8.42-1.38,11.66,1.4,3.64,3.13,2.62,8.1,2.29,11.88,3.23,2.74,8.21,5,7.83,10.46-.34,4.92-2.39,9.22-8.54,10.63,2.07,4.11,1.73,8.16-.65,11.23-2.86,3.67-6.99,4.25-12.44,2.67ZM673.05,108.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-2',
        delay: 2200,
        duration: 2800,
        d: 'M292.66,165.18c-2.73,3.45-5.66,6.76-10.04,7.24-5.88.64-7.86-4.54-11.34-6.74-4.15-.33-8.61,1.25-12.04-2.49-2.97-3.23-1.83-8.13-1.69-11.67-3.16-3.06-6.8-5.29-6.91-10.03-.12-5.17,3.26-8.01,7.02-10.91-.42-3.71-1.4-8.47,1.61-11.75,3.33-3.64,8.33-2.6,12.11-2.24,2.46-3.89,5.12-7.93,10.16-7.89,5.31.04,8.83,2.97,10.95,8.23,3.93-1.36,8.39-1.21,11.64,1.31,4.08,3.16,1.99,8.36,2.62,11.82,2.36,3.15,8.21,4.87,7.56,10.64-.53,4.78-2.29,9.22-8.59,10.57,2.13,4.12,1.75,8.18-.62,11.23-2.87,3.71-6.98,4.21-12.44,2.69ZM281.05,137.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-3',
        delay: 800,
        duration: 4000,
        d: 'M988.64,201.13c-2.7,3.58-5.65,6.78-10.03,7.28-5.8.66-7.98-4.53-11.27-6.76-4.4-.12-8.58,1.08-12.1-2.42-3.25-3.23-1.44-8.37-1.87-11.61-2.72-3.38-6.75-5.24-6.76-10.15,0-5.2,3.21-7.88,7.03-10.95-.31-3.57-1.44-8.43,1.62-11.71,3.35-3.59,8.32-2.62,12.12-2.22,2.44-3.89,5.12-7.91,10.15-7.9,5.32.02,8.82,3.01,10.96,8.21,3.88-1.23,8.4-1.31,11.65,1.36,3.82,3.15,2.35,8.2,2.44,11.86,2.85,2.91,8.2,4.94,7.71,10.53-.43,4.87-2.35,9.22-8.56,10.61,2.08,4.11,1.75,8.18-.64,11.23-2.87,3.65-6.95,4.3-12.45,2.64ZM977.05,173.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-4',
        delay: 3000,
        duration: 2400,
        d: 'M566.66,280.11c-2.74,3.67-5.66,6.78-10.05,7.3-5.8.69-7.98-4.54-11.27-6.75-4.39-.13-8.58,1.09-12.1-2.43-3.23-3.23-1.47-8.34-1.87-11.63-2.72-3.32-6.77-5.23-6.76-10.13,0-5.23,3.16-7.84,7.04-10.96-.34-3.55-1.45-8.42,1.6-11.69,3.35-3.59,8.33-2.62,12.11-2.21,2.48-3.94,5.11-7.92,10.16-7.9,5.33.02,8.81,2.98,10.96,8.22,3.87-1.25,8.4-1.33,11.65,1.35,3.81,3.15,2.37,8.19,2.42,11.86,2.87,2.89,8.2,4.95,7.72,10.53-.42,4.87-2.35,9.22-8.56,10.61,2.09,4.12,1.75,8.16-.64,11.23-2.82,3.62-7.02,4.34-12.42,2.61ZM555.05,252.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-5',
        delay: 1400,
        duration: 3200,
        d: 'M1116.67,363.17c-2.77,3.46-5.63,6.81-10.08,7.25-5.69.56-8.05-4.37-11.21-6.85-4.51.16-8.6,1.02-12.11-2.32s-1.32-8.45-1.95-11.6c-2.58-3.45-6.74-5.22-6.71-10.19s3.21-7.93,7.04-10.91c-.37-3.63-1.43-8.45,1.61-11.73,3.34-3.6,8.33-2.62,12.11-2.22,2.48-3.94,5.11-7.91,10.17-7.9,5.29,0,8.85,3,10.94,8.23,3.96-1.37,8.39-1.17,11.64,1.3,4.16,3.16,1.9,8.41,2.67,11.8,2.23,3.22,8.21,4.84,7.52,10.67-.56,4.75-2.27,9.22-8.6,10.56,2.14,4.13,1.75,8.18-.62,11.23-2.86,3.69-7.01,4.23-12.42,2.67ZM1105.05,335.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-6',
        delay: 400,
        duration: 2800,
        d: 'M336.66,384.19c-2.75,3.42-5.65,6.77-10.06,7.23-5.8.61-7.95-4.51-11.28-6.78-4.35-.12-8.58,1.1-12.08-2.41-3.23-3.24-1.46-8.35-1.87-11.62-2.7-3.37-6.8-5.2-6.75-10.16s3.02-7.97,7.12-10.88c-.64-3.73-1.43-8.47,1.52-11.74,3.32-3.67,8.33-2.59,12.12-2.26,2.42-3.86,5.13-7.9,10.15-7.89,5.3.01,8.87,3.08,10.94,8.2,3.93-1.21,8.41-1.29,11.67,1.38,3.83,3.14,2.34,8.21,2.44,11.86,2.84,2.92,8.2,4.94,7.71,10.54-.43,4.86-2.35,9.22-8.57,10.61,2.1,4.12,1.74,8.17-.63,11.23-2.87,3.71-6.99,4.2-12.43,2.7ZM325.05,356.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-7',
        delay: 1800,
        duration: 4000,
        d: 'M923.7,401.12c-2.82,3.64-5.67,6.76-10.09,7.29-5.78.68-8-4.55-11.25-6.76-4.46-.09-8.57,1.03-12.11-2.41-3.33-3.23-1.33-8.44-1.92-11.59-2.59-3.48-6.74-5.21-6.72-10.2s3.21-7.93,7.04-10.91c-.37-3.63-1.42-8.45,1.61-11.73,3.34-3.61,8.34-2.6,12.11-2.22,2.48-3.92,5.11-7.92,10.17-7.9s8.89,2.98,10.91,8.24c4.01-1.43,8.4-1.16,11.66,1.29,4.17,3.14,1.9,8.42,2.67,11.8,2.26,3.23,8.21,4.85,7.53,10.67-.56,4.75-2.27,9.22-8.6,10.56,2.14,4.14,1.74,8.16-.62,11.24-2.79,3.64-7.11,4.29-12.39,2.62ZM912.05,373.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-8',
        delay: 2600,
        duration: 2400,
        d: 'M128.67,436.15c-2.7,3.62-5.77,6.62-10,7.28-6.1.95-7.81-5.07-11.41-6.52-4.19-.92-8.47,1.15-12.06-2.69-3.08-3.29-1.39-8.28-1.88-11.61-2.54-3.38-6.76-5.19-6.71-10.15s3.16-7.88,7.05-10.93c-.36-3.58-1.45-8.43,1.6-11.71,3.35-3.59,8.32-2.62,12.12-2.22,2.45-3.92,5.12-7.91,10.15-7.9,5.31.01,8.84,3.02,10.94,8.22,3.94-1.34,8.39-1.17,11.64,1.32,4.15,3.17,1.9,8.4,2.67,11.81,2.23,3.21,8.21,4.84,7.52,10.67-.56,4.75-2.27,9.22-8.6,10.56,2.14,4.13,1.75,8.17-.61,11.24-2.84,3.68-7.02,4.24-12.42,2.66ZM117.05,408.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-9',
        delay: 1000,
        duration: 3200,
        d: 'M222.65,640.16c-2.72,3.49-5.64,6.77-10.04,7.25-5.78.64-7.99-4.53-11.25-6.77-4.43-.08-8.57,1.04-12.1-2.4-3.33-3.24-1.32-8.43-1.93-11.6-2.57-3.47-6.76-5.2-6.71-10.19s3.14-7.85,7.05-10.94c-.36-3.56-1.46-8.43,1.6-11.7,3.35-3.59,8.32-2.63,12.12-2.22,2.45-3.92,5.11-7.91,10.15-7.9,5.33.01,8.8,3.01,10.97,8.2,3.84-1.17,8.41-1.38,11.65,1.39,3.66,3.14,2.59,8.1,2.31,11.89,3.18,2.75,8.21,4.99,7.82,10.47-.35,4.92-2.39,9.22-8.54,10.63,2.07,4.11,1.74,8.17-.65,11.23-2.87,3.68-6.97,4.25-12.44,2.67ZM211.05,612.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
    {
        id: 'star-10',
        delay: 1600,
        duration: 2800,
        d: 'M1105.67,684.14c-2.71,3.67-5.79,6.63-10,7.29-6.1.96-7.82-5.08-11.41-6.52-4.2-.92-8.47,1.15-12.07-2.69-3.08-3.28-1.39-8.29-1.87-11.61-2.57-3.39-6.75-5.19-6.72-10.16s3.19-7.93,7.05-10.91c-.37-3.63-1.42-8.45,1.61-11.73,3.34-3.62,8.34-2.6,12.11-2.23,2.5-3.91,5.1-7.93,10.18-7.89s8.89,2.93,10.91,8.26c4.02-1.5,8.41-1.16,11.66,1.27,4.21,3.13,1.86,8.45,2.69,11.79,2.21,3.26,8.21,4.84,7.51,10.69-.56,4.75-2.26,9.22-8.6,10.56,2.14,4.13,1.75,8.17-.61,11.24-2.84,3.67-7.03,4.26-12.42,2.64ZM1094.05,656.4c-2.79,1.02-3.43,3.62-2.35,5.3.95,1.49,2.64,2.57,4.35,1.92,1.86-.72,3.28-2.74,2.58-4.67-.53-1.47-2.4-3.35-4.57-2.55Z',
    },
];

// ─── Generated sparkle geometry ─────────────────────────────────────────────
// Produces a thin 4-pointed star path centred at (cx, cy) with outer radius r.
// The waist ratio (0.12) keeps the points needle-thin, matching the Illustrator
// sparkle aesthetic at any size.

function generateSparkle(cx: number, cy: number, r: number): string {
    const w = r * 0.12;
    return [
        `M ${cx},${(cy - r).toFixed(2)}`,
        `L ${(cx + w).toFixed(2)},${(cy - w).toFixed(2)}`,
        `L ${(cx + r).toFixed(2)},${cy}`,
        `L ${(cx + w).toFixed(2)},${(cy + w).toFixed(2)}`,
        `L ${cx},${(cy + r).toFixed(2)}`,
        `L ${(cx - w).toFixed(2)},${(cy + w).toFixed(2)}`,
        `L ${(cx - r).toFixed(2)},${cy}`,
        `L ${(cx - w).toFixed(2)},${(cy - w).toFixed(2)}`,
        'Z',
    ].join(' ');
}

// Star seeds use xf and yf (0–1 fractions of the viewBox dimensions) so paths
// can be recomputed for any canvas size. When vbW=vbH=1280, xf*1280 and
// yf*1280 reproduce the original absolute positions.
// Stars in the moon zone (y 350–840, x 390–890 in the 1280² space) stay at
// xf < 0.38 or xf > 0.62 to clear the centred moon on any canvas width.
const EXTRA_STAR_SEEDS: {
    xf: number;
    yf: number;
    r: number;
    delay: number;
    duration: number;
}[] = [
    // ── Top strip ─────────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.02, r: 14, delay: 600, duration: 3600 },
    { xf: 0.18, yf: 0.012, r: 12, delay: 2100, duration: 2800 },
    { xf: 0.35, yf: 0.027, r: 16, delay: 900, duration: 3400 },
    { xf: 0.5, yf: 0.014, r: 14, delay: 1400, duration: 4000 },
    { xf: 0.65, yf: 0.023, r: 18, delay: 3000, duration: 2600 },
    { xf: 0.82, yf: 0.016, r: 12, delay: 500, duration: 3200 },
    { xf: 0.98, yf: 0.022, r: 16, delay: 1800, duration: 3800 },
    // ── Upper ─────────────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.125, r: 15, delay: 1700, duration: 3800 },
    { xf: 0.12, yf: 0.156, r: 12, delay: 300, duration: 3200 },
    { xf: 0.25, yf: 0.07, r: 16, delay: 2400, duration: 2800 },
    { xf: 0.75, yf: 0.078, r: 14, delay: 700, duration: 4200 },
    { xf: 0.88, yf: 0.172, r: 18, delay: 1900, duration: 3000 },
    { xf: 0.97, yf: 0.133, r: 14, delay: 2600, duration: 2600 },
    // ── Middle band sides (avoid xf 0.38–0.62 to clear the centred moon) ──────
    { xf: 0.02, yf: 0.352, r: 16, delay: 2700, duration: 2600 },
    { xf: 0.08, yf: 0.5, r: 14, delay: 500, duration: 3800 },
    { xf: 0.15, yf: 0.609, r: 12, delay: 1300, duration: 3400 },
    { xf: 0.25, yf: 0.406, r: 15, delay: 2200, duration: 2800 },
    { xf: 0.75, yf: 0.391, r: 15, delay: 3400, duration: 3600 },
    { xf: 0.85, yf: 0.563, r: 14, delay: 800, duration: 4000 },
    { xf: 0.92, yf: 0.352, r: 16, delay: 2000, duration: 2600 },
    { xf: 0.98, yf: 0.5, r: 18, delay: 1100, duration: 3200 },
    // ── Lower ─────────────────────────────────────────────────────────────────
    { xf: 0.03, yf: 0.684, r: 16, delay: 2800, duration: 2800 },
    { xf: 0.2, yf: 0.719, r: 14, delay: 400, duration: 3800 },
    { xf: 0.5, yf: 0.703, r: 20, delay: 1600, duration: 3400 },
    { xf: 0.8, yf: 0.734, r: 16, delay: 2600, duration: 2600 },
    { xf: 0.97, yf: 0.684, r: 18, delay: 650, duration: 4200 },
    // ── Bottom strip ──────────────────────────────────────────────────────────
    { xf: 0.07, yf: 0.813, r: 18, delay: 1800, duration: 3000 },
    { xf: 0.3, yf: 0.875, r: 14, delay: 3100, duration: 2800 },
    { xf: 0.5, yf: 0.836, r: 22, delay: 900, duration: 3600 },
    { xf: 0.72, yf: 0.875, r: 16, delay: 2300, duration: 3200 },
    { xf: 0.93, yf: 0.813, r: 20, delay: 600, duration: 4000 },
];

function getGeneratedStars(vbW: number, vbH: number, count: number) {
    return EXTRA_STAR_SEEDS.slice(0, count).map((s, i) => ({
        id: `gen-${i}`,
        delay: s.delay,
        duration: s.duration,
        d: generateSparkle(Math.round(s.xf * vbW), Math.round(s.yf * vbH), s.r),
    }));
}

// ─── Animated star ───────────────────────────────────────────────────────────
// All stars derive their opacity from a single shared `clock` value (ms since
// mount, driven by a single useFrameCallback). This replaces the previous
// per-star setup of useSharedValue + withDelay(withRepeat(withSequence(...)))
// — mounting 40 of those simultaneously was a significant chunk of the
// MainPage mount cost.

interface TwinklingStarProps {
    d: string;
    delay: number;
    duration: number;
    fill: string;
    animate: boolean;
    clock: SharedValue<number>;
}

function TwinklingStar({
    d,
    delay,
    duration,
    fill,
    animate,
    clock,
}: TwinklingStarProps) {
    const animatedProps = useAnimatedProps(() => {
        'worklet';
        if (!animate) return { opacity: 1 };
        const half = duration * 0.5;
        const t = (clock.value + delay) % duration;
        // Triangle wave 1 → 0.15 → 1, with cubic ease-in-out per half to match
        // the perceptual feel of withTiming's default easing.
        const p = t < half ? t / half : (t - half) / half;
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const opacity = t < half ? 1 - 0.85 * eased : 0.15 + 0.85 * eased;
        return { opacity };
    });

    return (
        <AnimatedPath
            animatedProps={animatedProps}
            fill={fill}
            fillRule='evenodd'
            d={d}
        />
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ClearNightIconProps {
    size?: number;
    color?: string;
    /** Total stars to render. 1–10 uses Illustrator paths; 11+ adds generated sparkles. */
    starCount?: number;
    /** Stretch the canvas to the full screen width (large/hero variant). */
    fullWidth?: boolean;
    /** Stretch the canvas to the full screen height (large/hero variant). */
    fullHeight?: boolean;
    /** Run the twinkle animation. Defaults to true; pass false for small icons
     * where the animation isn't perceptible but its per-frame cost stacks
     * across many instances (e.g. the hourly forecast strip). */
    animate?: boolean;
    /**
     * Fractional moon phase: 0 = new moon, 0.25 = first quarter, 0.5 = full,
     * 0.75 = last quarter. Omit for the full-moon disc (existing default).
     */
    moonPhase?: number;
    /**
     * Mirror the moon disc horizontally for Southern Hemisphere observers so
     * the lit limb appears on the correct side. Does not affect stars.
     */
    mirrorDisc?: boolean;
}

export default function ClearNightIcon({
    size = 180,
    color = '#fefefe',
    starCount = 10,
    fullWidth = false,
    fullHeight = false,
    animate = true,
    moonPhase,
    mirrorDisc = false,
}: ClearNightIconProps) {
    const reduceMotion = useReduceMotion();
    const animateStars = animate && !reduceMotion;
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    // Expand the viewBox to match the physical screen dimensions while keeping
    // the scale factor (1280/size units per pixel) identical in both axes so
    // the moon always renders at the same physical size.
    const vbW = fullWidth ? Math.round((screenWidth / size) * 1280) : 1280;
    const vbH = fullHeight ? Math.round((screenHeight / size) * 1280) : 1280;
    // Translate the moon + Illustrator stars so they remain visually centred.
    const offsetX = (vbW - 1280) / 2;
    const offsetY = (vbH - 1280) / 2;

    const moonD = useMemo(
        () => moonPhase !== undefined
            ? moonPhasePath(MOON_CX, MOON_CY, MOON_R, moonPhase)
            : MOON_D,
        [moonPhase],
    );

    const illustratorStars = STARS.slice(0, Math.min(starCount, STARS.length));
    const extraCount = Math.max(0, starCount - STARS.length);
    // Recompute generated star paths whenever either canvas dimension changes.
    const generatedStars = useMemo(
        () => getGeneratedStars(vbW, vbH, extraCount),
        [vbW, vbH, extraCount],
    );

    // Single UI-thread clock driving every star's twinkle. One useFrameCallback
    // replaces 40 withRepeat schedules; stars derive their phase from
    // (clock + delay) % duration.
    const clock = useSharedValue(0);
    useFrameCallback((frameInfo) => {
        'worklet';
        clock.value = frameInfo.timeSinceFirstFrame ?? 0;
    }, animateStars);

    return (
        <Svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            width={fullWidth ? screenWidth : size}
            height={fullHeight ? screenHeight : size}
            accessibilityLabel='Clear night'
        >
            {/* Moon disc — mirrored independently so Southern Hemisphere
                observers see the correct lit limb without flipping the stars. */}
            {moonD.length > 0 && (
                <G
                    transform={
                        mirrorDisc
                            ? `translate(${offsetX}, ${offsetY}) translate(${MOON_CX}, ${MOON_CY}) scale(-1, 1) translate(${-MOON_CX}, ${-MOON_CY})`
                            : `translate(${offsetX}, ${offsetY})`
                    }
                >
                    <Path fill={color} d={moonD} />
                </G>
            )}
            {/* Illustrator stars — always in original positions, not mirrored */}
            <G transform={`translate(${offsetX}, ${offsetY})`}>
                {illustratorStars.map((star) => (
                    <TwinklingStar
                        key={star.id}
                        d={star.d}
                        delay={star.delay}
                        duration={star.duration}
                        fill={color}
                        animate={animateStars}
                        clock={clock}
                    />
                ))}
            </G>
            {/* Generated stars spread across the full canvas width */}
            {generatedStars.map((star) => (
                <TwinklingStar
                    key={star.id}
                    d={star.d}
                    delay={star.delay}
                    duration={star.duration}
                    fill={color}
                    animate={!reduceMotion}
                    clock={clock}
                />
            ))}
        </Svg>
    );
}
