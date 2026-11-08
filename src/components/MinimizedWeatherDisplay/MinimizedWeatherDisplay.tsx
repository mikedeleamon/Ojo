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
import { LIGHT_SKY_SCRIM } from '../../lib/weather/skyContrast';

/**
 * Now is frosted light glass: the native material tinted white, so it keeps its
 * depth and highlights instead of turning into a flat light card.
 *
 * 0.4 is as little white as its navy text allows: on a clear night the tile
 * measures L* 57 and the text 4.93:1 (0.3 drops to 3.77:1). Pale skies keep it
 * lighter (snow: L* 82, 10.7:1). It was 0.6, which read as near-white.
 */
const NOW_GLASS_TINT = 'rgba(255, 255, 255, 0.4)';

interface Props {
    weather: string;
    temperature: number;
    time: string;
    tempUnit: string;
    isDay: boolean;
    isNow?: boolean;
    /** Forwarded from the dev perf panel so the strip participates in the
     *  glass on/off bisection along with the rest of the HUD. */
    disableGlass?: boolean;
    /** The sky behind is pale (see skyContrast): darken the tile so its white
     *  text stays readable. */
    onLightSky?: boolean;
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
        // Now is inverted on every sky: light glass with dark text, the way the
        // app marks the selected item elsewhere (the active occasion chip, the
        // active closet tab, "Wore this today"). One cue that reads on any sky.
        // The background colour is the fallback path's; on iOS 26 the native
        // glass takes NOW_GLASS_TINT.
        cardNowInverted: { backgroundColor: colors.saveBtnBg, borderColor: colors.saveBtnBg },
        onInverted: { color: colors.saveBtnText },
        // Light sky: the glass gets a navy scrim (backgroundColor is the
        // fallback path's copy of it), and the hour label goes full strength.
        cardLight: { backgroundColor: LIGHT_SKY_SCRIM },
        timeLight: { color: colors.textPrimary },
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
    disableGlass,
    onLightSky = false,
}: Props) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        // One glass surface per hour, deliberately — this was consolidated into
        // a single card spanning the strip and that measured WORSE on an iPhone
        // 16. Offscreen tiles are clipped by the horizontal ScrollView and blur
        // nothing, and the gaps between tiles aren't blurred either, so ~5 small
        // visible patches cost less than one contiguous full-width surface.
        // Blurred AREA is what this screen is sensitive to, not surface count.
        <GlassCard
            glassStyle={isNow ? 'regular' : 'clear'}
            style={[
                styles.card,
                isNow && styles.cardNow,
                onLightSky && styles.cardLight,
                isNow && styles.cardNowInverted,
            ]}
            tintColor={!isNow && onLightSky ? LIGHT_SKY_SCRIM : undefined}
            glassTint={isNow ? NOW_GLASS_TINT : undefined}
            disableGlass={disableGlass}
        >
            <Text
                style={[
                    styles.time,
                    onLightSky && styles.timeLight,
                    isNow && styles.timeNow,
                    isNow && styles.onInverted,
                ]}
            >
                {isNow ? 'Now' : formatTime(time)}
            </Text>
            <WeatherIconDisplay
                condition={weather}
                isDay={isDay}
                size='small'
                color={isNow ? colors.saveBtnText : undefined}
            />
            <Text style={[styles.temp, isNow && styles.onInverted]}>
                {temperature}° {tempUnit}
            </Text>
        </GlassCard>
    );
};

export default memo(MinimizedWeatherDisplay);
