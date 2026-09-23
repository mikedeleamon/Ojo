/**
 * ShootingStar — an occasional streak across WeatherHUD's clear-night sky.
 *
 * One small Animated.View holding a static gradient streak. Each shot picks a
 * spot and heading (a React state change, once every ~14–30 s), then a single
 * native timing moves the streak along its heading and fades it in and out.
 * The streak's own Svg never changes during a shot, so it's rasterized once.
 *
 * Numbers live in lib/weather/backdropSpec (SHOOTING_STAR), which the
 * Instagram-story loop renderer reads too.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { SHOOTING_STAR } from '../../lib/weather/backdropSpec';

const S = SHOOTING_STAR;
/** Box height around the streak: room for the head dot. */
const BOX_H = Math.ceil(S.head) + 2;

interface Shot {
    /** Streak midpoint, in canvas points. */
    cx: number;
    cy: number;
    /** Rotation of the travel axis, in degrees (clockwise, as RN rotates). */
    rotate: number;
}

function randomShot(width: number, height: number): Shot {
    const r = S.region;
    const angle = S.angleMinDeg + Math.random() * S.angleSpreadDeg;
    return {
        cx: (r.xMin + Math.random() * (r.xMax - r.xMin)) * width,
        cy: (r.yMin + Math.random() * (r.yMax - r.yMin)) * height,
        // Rightward heads down-right; leftward flips the axis so it heads down-left.
        rotate: Math.random() < 0.5 ? angle : 180 - angle,
    };
}

interface ShootingStarProps {
    animate: boolean;
    color?: string;
}

export default function ShootingStar({ animate, color = '#fefefe' }: ShootingStarProps) {
    const reduceMotion = useReduceMotion();
    const { width, height } = useWindowDimensions();
    const run = animate && !reduceMotion;
    const progress = useRef(new Animated.Value(0)).current;
    const [shot, setShot] = useState<Shot | null>(null);
    const gradientId = `shoot${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    useEffect(() => {
        progress.setValue(0);
        if (!run) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let currentAnim: Animated.CompositeAnimation | null = null;

        // Same shape as SheetFlash: the random gap is the point, so it stays on
        // a JS timer, but that fires once per shot.
        const scheduleNext = () => {
            if (cancelled) return;
            timer = setTimeout(() => {
                if (cancelled) return;
                setShot(randomShot(width, height));
                progress.setValue(0);
                currentAnim = Animated.timing(progress, {
                    toValue: 1,
                    duration: S.ms,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                });
                currentAnim.start(({ finished }) => {
                    if (finished && !cancelled) scheduleNext();
                });
            }, S.gapMinMs + Math.random() * S.gapSpreadMs);
        };
        scheduleNext();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            if (currentAnim) currentAnim.stop();
            progress.setValue(0);
        };
    }, [run, width, height, progress]);

    if (!run || !shot) return null;

    const boxW = S.travel + S.tail;
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, S.travel] });
    const opacity = progress.interpolate(S.fade as unknown as Animated.InterpolationConfigType);

    return (
        <View
            pointerEvents='none'
            style={{
                position: 'absolute',
                left: shot.cx - boxW / 2,
                top: shot.cy - BOX_H / 2,
                width: boxW,
                height: BOX_H,
                transform: [{ rotate: `${shot.rotate}deg` }],
            }}
        >
            <Animated.View
                shouldRasterizeIOS
                style={{ width: S.tail, height: BOX_H, opacity, transform: [{ translateX }] }}
            >
                <Svg width={S.tail} height={BOX_H}>
                    <Defs>
                        <LinearGradient id={gradientId} x1='0' y1='0' x2='1' y2='0'>
                            <Stop offset='0' stopColor={color} stopOpacity={0} />
                            <Stop offset='1' stopColor={color} stopOpacity={S.opacity} />
                        </LinearGradient>
                    </Defs>
                    <Rect
                        x={0}
                        y={(BOX_H - S.width) / 2}
                        width={S.tail - S.head / 2}
                        height={S.width}
                        rx={S.width / 2}
                        fill={`url(#${gradientId})`}
                    />
                    <Circle
                        cx={S.tail - S.head / 2}
                        cy={BOX_H / 2}
                        r={S.head / 2}
                        fill={color}
                        fillOpacity={S.opacity}
                    />
                </Svg>
            </Animated.View>
        </View>
    );
}
