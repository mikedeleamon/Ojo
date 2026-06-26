import { useMemo } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { View } from '../primitives';
import { ColorTokens } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { useSpinAnimation } from '../../hooks/useSpinAnimation';
import SunnyIcon from '../WeatherIcons/SunnyIcon';

const makeStyles = (colors: ColorTokens) => StyleSheet.create({
    root: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgDefault,
    },
    icon: { width: 80, height: 80 },
});

const Loading = () => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const rotate = useSpinAnimation(2_000);

    return (
        <View style={styles.root}>
            <Animated.View style={[styles.icon, { transform: [{ rotate }] }]}>
                <SunnyIcon size={80} color={colors.textPrimary} />
            </Animated.View>
        </View>
    );
};

export default Loading;
