import { useMemo } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { View, Text } from '../primitives';
import { ColorTokens, fonts, fontSizes } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useSpinAnimation } from '../../hooks/useSpinAnimation';
import ClearNightIcon from '../WeatherIcons/ClearNightIcon';
import ClearNightIconMoon from '../WeatherIcons/ClearNightIconMoon';
import RainyIcon from '../WeatherIcons/RainyIcon';
import StormIcon from '../WeatherIcons/StormIcon';
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

const iconFor = (condition: string, isDay: boolean) => {
    const c = condition.toLowerCase();
    if (c.includes('thunder') || c.includes('t-storm')) return ICONS.Storm;
    if (c.includes('snow') || c.includes('flurr')) return ICONS.Snow;
    if (c.includes('rain') || c.includes('shower') || c.includes('drizzle') || c.includes('precip'))
        return ICONS.Rainy;
    if (c.includes('sunny') || c.includes('mostly sunny')) return ICONS.Sunny;
    if (c.includes('clear') || c.includes('mostly clear'))
        return isDay ? ICONS.Sunny : ICONS.ClearNight;
    if (
        c.includes('partly') ||
        c.includes('intermittent') ||
        c.includes('hazy')
    )
        return isDay ? ICONS.PartlyCloudy : ICONS.PartlyCloudyNight;
    if (c.includes('cloud') || c.includes('overcast') || c.includes('dreary'))
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
}

const makeStyles = (colors: ColorTokens) => StyleSheet.create({
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
    // Spin only matters at the hero size. At 36px the rotation is imperceptible
    // and the per-frame transform updates pile up across ~12 forecast cells,
    // adding noticeable scroll cost. Skip the hook entirely when small.
    const rotate = useSpinAnimation(isLarge && isSunny ? 12_000 : 0);

    const iconSize = isLarge ? 180 : 36;
    const iconStyle = isLarge ? styles.iconLarge : styles.iconSmall;

    return (
        <View style={[styles.root, isLarge ? styles.large : styles.small]}>
            {isClearNight ? (
                isLarge ? (
                    <ClearNightIconMoon size={iconSize} showStars={false} />
                ) : (
                    <ClearNightIcon size={iconSize} starCount={10} animate={false} />
                )
            ) : isRainy ? (
                <RainyIcon size={iconSize} />
            ) : isStorm ? (
                <StormIcon size={iconSize} />
            ) : isPartlyCloudyNight ? (
                <PartlyCloudyNightIcon size={iconSize} />
            ) : isPartlyCloudy ? (
                <PartlyCloudyIcon size={iconSize} />
            ) : isCloudy ? (
                <CloudyIcon size={iconSize} />
            ) : isSunny ? (
                isLarge ? (
                    <Animated.View style={[iconStyle, { transform: [{ rotate }] }]}>
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
                        <Text style={styles.feelsLike}>feels {feelsLike}°</Text>
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
