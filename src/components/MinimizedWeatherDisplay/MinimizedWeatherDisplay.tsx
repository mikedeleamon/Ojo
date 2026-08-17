import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Text, GlassCard } from '../primitives';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import {
    ColorTokens,
    fonts,
    fontSizes,
    radius,
    spacing,
} from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
    weather: string;
    temperature: number;
    time: string;
    tempUnit: string;
    isDay: boolean;
    isNow?: boolean;
}

const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: true });

const makeStyles = (colors: ColorTokens) =>
    StyleSheet.create({
        card: {
            alignItems: 'center',
            gap: 6,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            backgroundColor: colors.glassBg,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            minWidth: 64,
        },
        cardNow: {
            borderColor: colors.glassBgStrong,
            backgroundColor: colors.glassBgStrong,
        },
        time: {
            fontFamily: fonts.body,
            fontSize: 11,
            color: colors.textSecondary,
        },
        timeNow: { color: colors.textPrimary, fontWeight: '600' as const },
        temp: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textPrimary,
        },
    });

const MinimizedWeatherDisplay = ({
    weather,
    temperature,
    time,
    tempUnit,
    isDay,
    isNow,
}: Props) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        // disableGlass: twelve of these are mounted at once and they sit directly
        // above the full-screen night/storm backdrops. As native glass, each one
        // re-blurred its backdrop on every frame the sky moved. The card style
        // already carries the translucent bg + border the fallback path uses, so
        // the tiles look the same either way — at 64 pt wide the material was
        // barely legible regardless. To avoid the performance hit, we disable the native glass effect and just use the fallback style by uncommenting the following line:
        // <GlassCard disableGlass style={[styles.card, isNow && styles.cardNow]}>
        <GlassCard
            glassStyle={isNow ? 'regular' : 'clear'}
            style={[styles.card, isNow && styles.cardNow]}
        >
            <Text style={[styles.time, isNow && styles.timeNow]}>
                {isNow ? 'Now' : formatTime(time)}
            </Text>
            <WeatherIconDisplay
                condition={weather}
                isDay={isDay}
                size='small'
            />
            <Text style={styles.temp}>
                {temperature}° {tempUnit}
            </Text>
        </GlassCard>
    );
};

export default memo(MinimizedWeatherDisplay);
