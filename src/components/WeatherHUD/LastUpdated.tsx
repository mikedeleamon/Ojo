import { useState, useEffect } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { Text } from '../primitives';
import { formatLastUpdated } from './weatherPalette';

interface Props {
    date: Date;
    style?: StyleProp<TextStyle>;
}

/**
 * Self-ticking "X mins ago" label. Owns its own 60s timer so refreshing the
 * relative time doesn't re-render the entire WeatherHUD tree (forecast strip,
 * SVG icons, gradient host) once a minute — only this Text node updates.
 */
export default function LastUpdated({ date, style }: Props) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 60_000);
        return () => clearInterval(id);
    }, []);

    return <Text style={style}>{formatLastUpdated(date)}</Text>;
}
