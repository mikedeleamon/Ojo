import { useMemo } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { View, Text } from '../primitives';
import { ColorTokens, fonts, fontSizes } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useSpinAnimation } from '../../hooks/useSpinAnimation';
import { getMoonPhase } from '../../lib/moonPhase';
import ClearNightIcon from '../WeatherIcons/ClearNightIcon';
import ClearNightIconMoon from '../WeatherIcons/ClearNightIconMoon';
import RainyIcon from '../WeatherIcons/RainyIcon';
import StormIcon from '../WeatherIcons/StormIcon';
import StormIconLightning from '../WeatherIcons/StormIconLightning';
import PartlyCloudyNightIcon from '../WeatherIcons/PartlyCloudyNightIcon';
import PartlyCloudyIcon from '../WeatherIcons/PartlyCloudyIcon';
import SunnyIcon from '../WeatherIcons/SunnyIcon';
import CloudyIcon from '../WeatherIcons/CloudyIcon';
import SnowIcon from '../WeatherIcons/SnowIcon';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS = {
    Cloudy: 'cloudy' as const,
    Snow: 'snow' as const,
    Sunny: 'sunny' as const,
    ClearNight: 'clear-night' as const,
    Rainy: 'rainy' as const,
    Storm: 'storm' as const,
    PartlyCloudy: 'partly-cloudy' as const,
    PartlyCloudyNight: 'partly-cloudy-night' as const,
};

/**
 * Map Apple WeatherKit `conditionCode` (e.g. "MostlyClear", "HeavyRain",
 * "Thunderstorms", "PartlyCloudy", "BlowingSnow") to one of the eight
 * Ojo-internal icon types. Substring-based so it also accepts free-form
 * phrases when WeatherText originates somewhere other than WeatherKit.
 */
const iconFor = (condition: string, isDay: boolean) => {
    const c = condition.toLowerCase();
    if (
        c.includes('thunder') ||
        c.includes('storm') ||
        c.includes('hurricane') ||
        c.includes('t-storm')
    )
        return ICONS.Storm;
    if (
        c.includes('snow') ||
        c.includes('flurr') ||
        c.includes('blizzard') ||
        c.includes('sleet') ||
        c.includes('hail') ||
        c.includes('wintry')
    )
        return ICONS.Snow;
    if (
        c.includes('rain') ||
        c.includes('shower') ||
        c.includes('drizzle') ||
        c.includes('precip')
    )
        return ICONS.Rainy;
    if (c.includes('sunny')) return ICONS.Sunny;
    // "MostlyClear" → sunny by day, starfield by night. Plain "Clear" → same logic.
    if (c.includes('clear')) return isDay ? ICONS.Sunny : ICONS.ClearNight;
    if (
        c.includes('partly') ||
        c.includes('intermittent') ||
        c.includes('hazy') ||
        c.includes('haze')
    ) {
        return isDay ? ICONS.PartlyCloudy : ICONS.PartlyCloudyNight;
    }
    if (
        c.includes('cloud') ||
        c.includes('overcast') ||
        c.includes('dreary') ||
        c.includes('fog') ||
        c.includes('smok') ||
        c.includes('mist') ||
        c.includes('dust')
    )
        return ICONS.Cloudy;
    return isDay ? ICONS.Sunny : ICONS.ClearNight;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    condition: string;
    isDay: boolean;
    size?: 'large' | 'small';
    temperature?: number | string;
    feelsLike?: number | string;
    /** Observer latitude in decimal degrees. Negative = Southern Hemisphere.
     *  When supplied, the moon disc is mirrored horizontally for SH viewers
     *  so the crescent lit limb appears on the correct side. */
    latitude?: number;
    /** Enable in-icon animation (sun spin, rain fall, storm bolts, star twinkle).
     *  Defaults to `size === 'large'` so existing callers are unchanged. The
     *  sticky mini header opts in explicitly with `animate` to mirror the hero. */
    animate?: boolean;
}

const makeStyles = (colors: ColorTokens) =>
    StyleSheet.create({
        root: { alignItems: 'center' },
        large: { gap: 8 },
        small: { gap: 4 },
        iconLarge: { width: 180, height: 180 },
        iconSmall: { width: 36, height: 36 },
        temps: { alignItems: 'center', gap: 2 },
        temp: {
            fontFamily: fonts.display,
            fontSize: 64,
            color: colors.textPrimary,
            lineHeight: 68,
        },
        feelsLike: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
        },
        miniTemp: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
        },
    });

const WeatherIconDisplay = ({
    condition,
    isDay,
    size = 'small',
    temperature,
    feelsLike,
    latitude,
    animate = size === 'large',
}: Props) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const icon = iconFor(condition, isDay);
    const isLarge = size === 'large';
    const isSunny = icon === ICONS.Sunny;
    const isClearNight = icon === ICONS.ClearNight;
    const isRainy = icon === ICONS.Rainy;
    const isStorm = icon === ICONS.Storm;
    const isPartlyCloudyNight = icon === ICONS.PartlyCloudyNight;
    const isPartlyCloudy = icon === ICONS.PartlyCloudy;
    const isCloudy = icon === ICONS.Cloudy;
    const isSnow = icon === ICONS.Snow;
    // Spin/twinkle/rain are opt-in via `animate`. Default mirrors size==='large',
    // so the 12-cell forecast strip stays cheap (no per-frame transforms there),
    // while the sticky mini header can opt in explicitly.
    const rotate = useSpinAnimation(animate && isSunny ? 12_000 : 0);

    const iconSize = isLarge ? 180 : 36;
    const iconStyle = isLarge ? styles.iconLarge : styles.iconSmall;

    // Tonight's lunar phase, derived from the date. Recomputed once per mount —
    // the phase moves far too slowly to need per-render updates.
    const moonPhase = useMemo(() => getMoonPhase(), []);

    // In the Southern Hemisphere the lit limb is on the opposite side to NH.
    // scaleX(-1) on the disc achieves this with zero extra SVG geometry.
    // We only mirror when a latitude is actually supplied; no lat = no flip,
    // which keeps all existing call sites (no lat prop) unchanged.
    const southernHemisphere = latitude !== undefined && latitude < 0;

    return (
        <View style={[styles.root, isLarge ? styles.large : styles.small]}>
            {isClearNight ? (
                isLarge ? (
                    // Hero: moon phase disc only — stars are in the full-screen backdrop.
                    <ClearNightIconMoon
                        size={iconSize}
                        showStars={false}
                        moonPhase={moonPhase}
                        mirrorDisc={southernHemisphere}
                    />
                ) : (
                    // Small (forecast strip + sticky mini): stars + moon phase.
                    // animate=true on the sticky mini enables twinkling; the
                    // forecast strip gets animate=false (cheap, no per-frame cost).
                    <ClearNightIcon
                        size={iconSize}
                        starCount={10}
                        animate={animate}
                        moonPhase={moonPhase}
                        mirrorDisc={southernHemisphere}
                    />
                )
            ) : isRainy ? (
                <RainyIcon size={iconSize} animate={animate} />
            ) : isStorm ? (
                animate ? (
                    <StormIconLightning size={iconSize} />
                ) : (
                    <StormIcon size={iconSize} />
                )
            ) : isPartlyCloudyNight ? (
                <PartlyCloudyNightIcon size={iconSize} />
            ) : isPartlyCloudy ? (
                <PartlyCloudyIcon size={iconSize} animate={animate} />
            ) : isCloudy ? (
                <CloudyIcon size={iconSize} />
            ) : isSunny ? (
                animate ? (
                    <Animated.View
                        style={[iconStyle, { transform: [{ rotate }] }]}
                    >
                        <SunnyIcon size={iconSize} />
                    </Animated.View>
                ) : (
                    <SunnyIcon size={iconSize} />
                )
            ) : isSnow ? (
                <SnowIcon size={iconSize} />
            ) : null}
            {isLarge && temperature !== undefined && (
                <View style={styles.temps}>
                    <Text style={styles.temp}>{temperature}°</Text>
                    {feelsLike !== undefined && (
                        <Text style={styles.feelsLike}>
                            Feels like: {feelsLike}°
                        </Text>
                    )}
                </View>
            )}
            {!isLarge && temperature !== undefined && (
                <Text style={styles.miniTemp}>{temperature}°</Text>
            )}
        </View>
    );
};

export default WeatherIconDisplay;
