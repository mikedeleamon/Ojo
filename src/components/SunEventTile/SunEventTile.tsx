import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, GlassCard } from '../primitives';
import SunriseSunsetIcon from '../WeatherIcons/SunriseSunsetIcon';
import { ColorTokens, fonts, fontSizes, radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
    time:        string;   // ISO timestamp of the sunrise / sunset moment
    temperature: number;   // already converted to the user's preferred unit
    tempUnit:    string;   // 'F' | 'C'
}

const formatExactTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });

const makeStyles = (colors: ColorTokens) => StyleSheet.create({
    card: {
        alignItems:        'center',
        gap:               6,
        paddingVertical:   spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor:   colors.glassBg,
        borderRadius:      radius.md,
        borderWidth:       1,
        borderColor:       colors.glassBorder,
        minWidth:          64,
    },
    time: {
        fontFamily: fonts.body,
        fontSize:   11,
        fontWeight: '700' as const,
        color:      colors.textPrimary,
    },
    temp: {
        fontFamily: fonts.body,
        fontSize:   fontSizes.xs,
        color:      colors.textPrimary,
    },
});

const SunEventTile = ({ time, temperature, tempUnit }: Props) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <GlassCard glassStyle="clear" style={styles.card}>
            <Text style={styles.time}>{formatExactTime(time)}</Text>
            <SunriseSunsetIcon size={36} />
            <Text style={styles.temp}>{temperature}° {tempUnit}</Text>
        </GlassCard>
    );
};

export default memo(SunEventTile);
