import { StyleSheet, Image } from 'react-native';
import { View, Text } from '../primitives';
import { colors, fonts, fontSizes } from '../../theme/tokens';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS = {
    Cloudy: require('../../../assets/images/weatherIcons/Cloudy.png'),
    Snow: require('../../../assets/images/weatherIcons/Snow.png'),
    Rainy: require('../../../assets/images/weatherIcons/Rainy.png'),
    Sunny: require('../../../assets/images/weatherIcons/Sunny.png'),
    ClearNight: require('../../../assets/images/weatherIcons/ClearNight.png'),
    Storm: require('../../../assets/images/weatherIcons/Storm.png'),
    PartlyCloudy: require('../../../assets/images/weatherIcons/PartlyCloudy.png'),
    PartlyCloudyNight: require('../../../assets/images/weatherIcons/PartlyCloudyNight.png'),
};

const iconFor = (condition: string, isDay: boolean) => {
    const c = condition.toLowerCase();
    if (c.includes('thunder') || c.includes('t-storm')) return ICONS.Storm;
    if (c.includes('snow') || c.includes('flurr')) return ICONS.Snow;
    if (c.includes('rain') || c.includes('shower') || c.includes('drizzle'))
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

const WeatherIconDisplay = ({
    condition,
    isDay,
    size = 'small',
    temperature,
    feelsLike,
}: Props) => {
    const icon = iconFor(condition, isDay);
    const isLarge = size === 'large';

    return (
        <View style={[styles.root, isLarge ? styles.large : styles.small]}>
            <Image
                source={icon}
                style={isLarge ? styles.iconLarge : styles.iconSmall}
                resizeMode='contain'
                accessibilityLabel={condition}
            />
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

const styles = StyleSheet.create({
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
