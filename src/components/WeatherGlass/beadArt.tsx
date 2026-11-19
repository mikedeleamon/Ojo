/**
 * beadArt — how a water drop on the glass is drawn, shared by the beads and
 * the running drops.
 */

import { useId } from 'react';
import { Circle, G, Path, RadialGradient, Stop } from 'react-native-svg';

export const useGradientId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/** The bead's body: clear in the middle, bright at the rim, like a lens. */
export const BeadGradient = ({ id }: { id: string }) => (
    <RadialGradient id={id} cx='45%' cy='40%' r='60%'>
        <Stop offset='0' stopColor='#ffffff' stopOpacity={0.03} />
        <Stop offset='0.62' stopColor='#ffffff' stopOpacity={0.06} />
        <Stop offset='1' stopColor='#ffffff' stopOpacity={0.26} />
    </RadialGradient>
);

/** Which part of a bead's hairline rim to draw. */
export type BeadRim = 'full' | 'lower' | 'upper';

/** The top or bottom half of a bead's rim, as an arc from its left side to its right. */
const rimArc = (x: number, y: number, r: number, half: 'lower' | 'upper') =>
    `M${x - r} ${y}A${r} ${r} 0 0 ${half === 'upper' ? 1 : 0} ${x + r} ${y}`;

interface BeadShapeProps {
    x: number;
    y: number;
    r: number;
    o: number;
    gradient: string;
    /** 'lower' leaves the top open, for a drop whose head runs into its tail. Default 'full'. */
    rim?: BeadRim;
    /** Rim width in the art's own points. Default 0.5; art that is drawn big and scaled down asks for more. */
    rimWidth?: number;
}

/**
 * One bead: a soft shadow below it, the lens body, a hairline rim, the
 * specular highlight up-left, and on the bigger ones the bright refracted spot
 * opposite it. Pinpricks get only the body and a highlight.
 */
export const BeadShape = ({ x, y, r, o, gradient, rim = 'full', rimWidth = 0.5 }: BeadShapeProps) => (
    <G opacity={o}>
        {r >= 1.6 && <Circle cx={x + r * 0.22} cy={y + r * 0.34} r={r} fill='#000000' fillOpacity={0.16} />}
        <Circle cx={x} cy={y} r={r} fill={`url(#${gradient})`} />
        {rim === 'full' ? (
            <Circle cx={x} cy={y} r={r} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={rimWidth} />
        ) : (
            <Path d={rimArc(x, y, r, rim)} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={rimWidth} />
        )}
        {r >= 1.1 && (
            <Circle cx={x - r * 0.34} cy={y - r * 0.36} r={Math.max(0.35, r * 0.26)} fill='#ffffff' fillOpacity={0.85} />
        )}
        {r >= 2.4 && <Circle cx={x + r * 0.26} cy={y + r * 0.44} r={r * 0.3} fill='#ffffff' fillOpacity={0.22} />}
    </G>
);

/** The top half of a bead's rim on its own: what BeadShape leaves off with rim='lower'. */
export const BeadUpperRim = ({ x, y, r, rimWidth = 0.5 }: { x: number; y: number; r: number; rimWidth?: number }) => (
    <Path d={rimArc(x, y, r, 'upper')} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={rimWidth} />
);

/**
 * The tail of a running drop: from the sides of its head (radius `r`, centred
 * on `x`, at the bottom of this shape) drawn in to a tip `length` above it.
 * The head itself is a BeadShape with rim='lower', drawn over this.
 */
export const TearTail = ({ x, bottom, r, length, rimWidth = 0.5 }: { x: number; bottom: number; r: number; length: number; rimWidth?: number }) => {
    const tip = bottom - length;
    const right = `M${x} ${tip}C${x + r * 0.2} ${bottom - length * 0.6} ${x + r} ${bottom - r * 0.95} ${x + r} ${bottom}`;
    const left = `M${x} ${tip}C${x - r * 0.2} ${bottom - length * 0.6} ${x - r} ${bottom - r * 0.95} ${x - r} ${bottom}`;
    return (
        <G>
            <Path
                d={`${right}L${x - r} ${bottom}C${x - r} ${bottom - r * 0.95} ${x - r * 0.2} ${bottom - length * 0.6} ${x} ${tip}Z`}
                fill='#ffffff'
                fillOpacity={0.07}
            />
            <Path d={right} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={rimWidth} />
            <Path d={left} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={rimWidth} />
        </G>
    );
};
