/**
 * beadArt — how a water drop on the glass is drawn, shared by the beads, the
 * running drops, and the drawn stand-ins for the Liquid Glass drops.
 */

import { useId } from 'react';
import { Circle, G, RadialGradient, Stop } from 'react-native-svg';

export const useGradientId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/** The bead's body: clear in the middle, bright at the rim, like a lens. */
export const BeadGradient = ({ id }: { id: string }) => (
    <RadialGradient id={id} cx='45%' cy='40%' r='60%'>
        <Stop offset='0' stopColor='#ffffff' stopOpacity={0.03} />
        <Stop offset='0.62' stopColor='#ffffff' stopOpacity={0.06} />
        <Stop offset='1' stopColor='#ffffff' stopOpacity={0.26} />
    </RadialGradient>
);

/**
 * One bead: a soft shadow below it, the lens body, a hairline rim, the
 * specular highlight up-left, and on the bigger ones the bright refracted spot
 * opposite it. Pinpricks get only the body and a highlight.
 */
export const BeadShape = ({ x, y, r, o, gradient }: { x: number; y: number; r: number; o: number; gradient: string }) => (
    <G opacity={o}>
        {r >= 1.6 && <Circle cx={x + r * 0.22} cy={y + r * 0.34} r={r} fill='#000000' fillOpacity={0.16} />}
        <Circle cx={x} cy={y} r={r} fill={`url(#${gradient})`} />
        <Circle cx={x} cy={y} r={r} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={0.5} />
        {r >= 1.1 && (
            <Circle cx={x - r * 0.34} cy={y - r * 0.36} r={Math.max(0.35, r * 0.26)} fill='#ffffff' fillOpacity={0.85} />
        )}
        {r >= 2.4 && <Circle cx={x + r * 0.26} cy={y + r * 0.44} r={r * 0.3} fill='#ffffff' fillOpacity={0.22} />}
    </G>
);

