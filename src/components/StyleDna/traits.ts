import { formatTemp } from '../../lib/units';
import type { StyleArchetype } from '../../lib/styleArchetype';

export interface ArchetypeTrait {
    label: string;
    value: string;
}

/**
 * The few facts behind a Style DNA name, for the card and the share poster:
 * the go-to pairing, the weather it's usually worn in, the favorite fabric.
 * Temperatures follow the user's units.
 */
export function archetypeTraits(a: StyleArchetype, scale: 'imperial' | 'metric'): ArchetypeTrait[] {
    const out: ArchetypeTrait[] = [];
    const pair = a.pairs[0];
    if (pair) out.push({ label: 'Go-to pairing', value: `${pair.a} + ${pair.b}` });
    if (a.typicalFeelsLikeF !== null) {
        out.push({ label: 'Usually dressed for', value: formatTemp(a.typicalFeelsLikeF, scale) });
    }
    if (a.topFabric && a.topFabric !== 'Other') out.push({ label: 'Favorite fabric', value: a.topFabric });
    return out;
}
