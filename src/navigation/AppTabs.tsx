import React from 'react';
import {
    Alert,
    Image,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Svg, Path, Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { GlassView, GlassContainer, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useTheme } from '../theme/ThemeContext';
import { captureImage, pickImage } from '../lib/imageService';
import MainPage from '../views/MainPage/MainPage';
import ClosetPage from '../views/ClosetPage/ClosetPage';
import PreferencesScreen from '../features/settings/screens/PreferencesScreen';

const Tab = createBottomTabNavigator();

// Native iOS 26 liquid glass — falls back to BlurView on older versions
const useNativeGlass = isGlassEffectAPIAvailable();

const HangerIcon = ({ color }: { color: string }) => (
    <Svg
        width={26}
        height={26}
        viewBox='0 0 24 24'
        fill='none'
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
        accessibilityElementsHidden
        importantForAccessibility='no'
    >
        <Path
            d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </Svg>
);

const SparklesIcon = ({ color }: { color: string }) => (
    <Svg
        width={26}
        height={26}
        viewBox='0 0 24 24'
        fill='none'
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
        accessibilityElementsHidden
        importantForAccessibility='no'
    >
        <Path d='M15 4l1.5 3L20 8.5 16.5 10 15 13l-1.5-3L10 8.5 13.5 7z' />
        <Path d='M6 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z' />
    </Svg>
);

const CameraAddIcon = ({ color }: { color: string }) => (
    <Svg
        width={23}
        height={23}
        viewBox='0 0 24 24'
        fill='none'
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
        accessibilityElementsHidden
        importantForAccessibility='no'
    >
        <Path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' />
        <Circle
            cx='12'
            cy='13'
            r='4'
            stroke={color}
            strokeWidth={1.5}
        />
        <Path d='M12 11v4M10 13h4' />
    </Svg>
);

// Pill dimensions — exported so screens can compute scroll padding that clears the bar
export const PILL_H = 60;
const PILL_RADIUS = PILL_H / 2;

// Number of tab slots (Home, Closet, QuickAdd, Style)
const TAB_COUNT = 4;
// Indicator pill dimensions
const INDICATOR_W = 52;
const INDICATOR_H = 34;

// Real navigable tabs — QuickAdd (index 2) is a FAB and never active
const REAL_TAB_INDICES = [0, 1, 3];

/**
 * TabBarBackground — renders the pill glass bar plus per-tab indicator pills
 * whose glass material transitions in/out using expo-glass-effect's native
 * `animate` API, matching the toggle-switch motion of iOS controls.
 *
 * iOS 26: GlassContainer groups the bar and indicators so they merge into one
 *         connected liquid glass surface. Each indicator fades its glass
 *         from 'none' ↔ 'clear' with animationDuration, identical to how a
 *         UISwitch thumb appears/disappears.
 * Older:  software BlurView bar + static translucent rounded-rect indicator.
 */
const TabBarBackground = ({
    isDark,
    glassColors,
    pillWidth,
}: {
    isDark: boolean;
    glassColors: { glassBorder: string };
    pillWidth: number;
}) => {
    const activeIndex = useNavigationState((s) => s.index);
    const itemWidth   = pillWidth / TAB_COUNT;
    // QuickAdd is a FAB — don't show an indicator when it's "active"
    const indicatorIndex = activeIndex === 2 ? null : activeIndex;
    const indTop = (PILL_H - INDICATOR_H) / 2;

    const indLeft = (tabIdx: number) =>
        tabIdx * itemWidth + (itemWidth - INDICATOR_W) / 2;

    return (
        <View style={[StyleSheet.absoluteFill, styles.tabBgClip]}>
            {useNativeGlass ? (
                /*
                 * GlassContainer lets the bar glass and each indicator glass
                 * merge into a single connected surface at the `spacing` proximity.
                 * Switching tabs triggers the native UIKit material transition.
                 */
                <GlassContainer spacing={8} style={StyleSheet.absoluteFill}>
                    {/* Full-width bar — the "track" */}
                    <GlassView
                        glassEffectStyle='regular'
                        colorScheme={isDark ? 'dark' : 'light'}
                        style={StyleSheet.absoluteFill}
                    />
                    {/* Per-tab pill — material toggles like a Switch thumb */}
                    {REAL_TAB_INDICES.map((tabIdx) => (
                        <GlassView
                            key={tabIdx}
                            glassEffectStyle={{
                                style: indicatorIndex === tabIdx ? 'clear' : 'none',
                                animate: true,
                                animationDuration: 0.28,
                            }}
                            style={[
                                styles.indicator,
                                { left: indLeft(tabIdx), top: indTop },
                            ]}
                        />
                    ))}
                </GlassContainer>
            ) : (
                /* ── Fallback: software glassmorphism for iOS < 26 / Android ── */
                <>
                    <BlurView
                        tint={isDark ? 'dark' : 'light'}
                        intensity={85}
                        style={StyleSheet.absoluteFill}
                    >
                        <View
                            style={[
                                StyleSheet.absoluteFill,
                                {
                                    backgroundColor: isDark
                                        ? 'rgba(18,18,28,0.78)'
                                        : 'rgba(248,248,252,0.78)',
                                },
                            ]}
                        />
                        <View style={styles.specular} />
                    </BlurView>
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            styles.tabBgBorder,
                            { borderColor: glassColors.glassBorder },
                        ]}
                        pointerEvents='none'
                    />
                    {indicatorIndex !== null && (
                        <View
                            style={[
                                styles.indicator,
                                styles.indicatorFallback,
                                {
                                    left: indLeft(indicatorIndex),
                                    top: indTop,
                                    borderColor: glassColors.glassBorder,
                                },
                            ]}
                        />
                    )}
                </>
            )}
        </View>
    );
};

// Never rendered — tabBarButton takes over all interaction for QuickAdd
const QuickAddPlaceholder = () => null;

const QuickAddButton = () => {
    const navigation = useNavigation<any>();
    const { isDark } = useTheme();

    const handleQuickAdd = () => {
        Alert.alert('Add Garment', 'Choose a photo source', [
            {
                text: 'Camera',
                onPress: async () => {
                    const result = await captureImage();
                    if (result.error) {
                        Alert.alert('Error', result.error);
                        return;
                    }
                    if (
                        result.uri &&
                        result.localUri &&
                        result.width &&
                        result.height
                    ) {
                        navigation.navigate('Closet', {
                            quickAdd: {
                                uri: result.uri,
                                localUri: result.localUri,
                                width: result.width,
                                height: result.height,
                            },
                        });
                    }
                },
            },
            {
                text: 'Photo Library',
                onPress: async () => {
                    const result = await pickImage();
                    if (result.error) {
                        Alert.alert('Error', result.error);
                        return;
                    }
                    if (
                        result.uri &&
                        result.localUri &&
                        result.width &&
                        result.height
                    ) {
                        navigation.navigate('Closet', {
                            quickAdd: {
                                uri: result.uri,
                                localUri: result.localUri,
                                width: result.width,
                                height: result.height,
                            },
                        });
                    }
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const fabBg = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.80)';
    const fabBorder = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.12)';
    const iconColor = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.85)';

    const fabInner = useNativeGlass ? (
        <GlassView
            glassEffectStyle='clear'
            colorScheme={isDark ? 'dark' : 'light'}
            style={styles.fabBlurGlass}
        >
            <CameraAddIcon color={iconColor} />
        </GlassView>
    ) : (
        <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={70}
            style={[styles.fabBlur, { borderColor: fabBorder }]}
        >
            <View
                style={[
                    StyleSheet.absoluteFill,
                    { borderRadius: 28, backgroundColor: fabBg },
                ]}
            />
            <CameraAddIcon color={iconColor} />
        </BlurView>
    );

    return (
        <Pressable
            onPress={handleQuickAdd}
            style={styles.fabWrapper}
            accessibilityLabel='Quick add garment'
            accessibilityRole='button'
            accessibilityHint='Opens camera or photo library to identify and add a garment to your closet'
        >
            {fabInner}
        </Pressable>
    );
};

export default function AppTabs() {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();

    // 4-point gap above the home indicator
    const pillBottom = insets.bottom + 4;

    // 70% width with centered margins
    const pillMargin = Math.round((screenWidth * 0.3) / 2);
    const pillWidth  = screenWidth - pillMargin * 2;

    return (
        <Tab.Navigator
            // Disable React Navigation's built-in safe-area bottom padding —
            // we own the pill position entirely via tabBarStyle.
            safeAreaInsets={{ bottom: 0 }}
            screenOptions={{
                headerShown: false,
                tabBarBackground: () => (
                    <TabBarBackground
                        isDark={isDark}
                        glassColors={colors}
                        pillWidth={pillWidth}
                    />
                ),
                tabBarStyle: {
                    // Absolute positioning lets each screen fill the full height so their
                    // backgrounds (gradients, etc.) show through the pill gap and safe-area
                    // strip below it — no solid colour slab at the bottom.
                    position: 'absolute',
                    left: pillMargin,
                    right: pillMargin,
                    bottom: pillBottom,
                    height: PILL_H,
                    borderRadius: PILL_RADIUS,
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    // Floating shadow
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 20,
                    elevation: 12,
                },
                tabBarActiveTintColor: colors.textPrimary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontFamily: 'Outfit',
                    fontSize: 10,
                    fontWeight: '500',
                },
            }}
        >
            <Tab.Screen
                name='Home'
                component={MainPage}
                options={{
                    tabBarLabel: 'Home',
                    tabBarAccessibilityLabel:
                        "Home — today's outfit suggestion",
                    tabBarIcon: ({ focused }) => (
                        <Image
                            source={require('../../assets/images/weatherIcons/Sunny.png')}
                            style={{ width: 26, height: 26, opacity: focused ? 1 : 0.45 }}
                            accessibilityElementsHidden
                            importantForAccessibility='no'
                        />
                    ),
                }}
            />
            <Tab.Screen
                name='Closet'
                component={ClosetPage}
                options={{
                    tabBarLabel: 'Closet',
                    tabBarAccessibilityLabel: 'Closet — manage your wardrobe',
                    tabBarIcon: ({ color }) => <HangerIcon color={color} />,
                }}
            />
            <Tab.Screen
                name='QuickAdd'
                component={QuickAddPlaceholder}
                options={{
                    tabBarButton: () => <QuickAddButton />,
                    // No label — the FAB button is self-contained
                    tabBarLabel: () => null,
                }}
            />
            <Tab.Screen
                name='Style'
                options={{
                    tabBarLabel: 'Style',
                    tabBarAccessibilityLabel:
                        'Style — outfit history and style patterns',
                    tabBarIcon: ({ color }) => <SparklesIcon color={color} />,
                }}
            >
                {() => (
                    <SafeAreaView
                        style={{ flex: 1, backgroundColor: colors.bgDefault }}
                        edges={['top']}
                    >
                        <PreferencesScreen />
                    </SafeAreaView>
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    // Clips the BlurView to the pill shape — radius must match PILL_RADIUS
    tabBgClip: {
        borderRadius: PILL_RADIUS,
        overflow: 'hidden',
    },
    // Inset border overlay on top of the blur
    tabBgBorder: {
        borderRadius: PILL_RADIUS,
        borderWidth: 1,
    },
    // Thin specular highlight along the top edge of the pill
    specular: {
        position: 'absolute',
        top: 0,
        left: 24,
        right: 24,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.50)',
        borderRadius: 1,
    },
    // Centers the FAB inside its tab-item slot
    fabWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Pill-shaped glass FAB button (BlurView fallback)
    fabBlur: {
        width: 48,
        height: 48,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        overflow: 'hidden',
    },
    // Pill-shaped glass FAB button (native liquid glass)
    fabBlurGlass: {
        width: 48,
        height: 48,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    // Sliding indicator pill — positioned absolutely within the bar
    indicator: {
        position: 'absolute',
        width: INDICATOR_W,
        height: INDICATOR_H,
        borderRadius: 10,
        overflow: 'hidden',
    },
    // Translucent glass fallback for iOS < 26
    indicatorFallback: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 10,
        borderWidth: 1,
    },
});
