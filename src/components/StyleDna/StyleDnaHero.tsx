/**
 * StyleDnaHero — the top of the Style DNA card in Insights: the generative art
 * with the user's style name set over it, and the facts behind the name.
 *
 * The art is always the dark brand ground (like Recap and the share cards),
 * whatever the app theme, so the name over it is always white. Locked, it shows
 * the art dimmed, made from the user's own colors, with the name held back.
 */

import { memo, useCallback, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { View, Text, Pressable, GlassCard } from '../primitives';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTheme, ForceDarkPalette } from '../../theme/ThemeContext';
import { fonts, fontSizes, radius, spacing } from '../../theme/tokens';
import type { StyleArchetype } from '../../lib/styleArchetype';
import StyleDnaArt from './StyleDnaArt';
import { archetypeTraits } from './traits';

interface Props {
    archetype: StyleArchetype;
    /** 'learning' marks the name as an early read. */
    level: 'learning' | 'active';
    tempScale: 'imperial' | 'metric';
    locked?: boolean;
    onShare?: () => void;
}

const ART_RATIO = 0.64;

function StyleDnaHero({ archetype, level, tempScale, locked = false, onShare }: Props) {
    const { colors } = useTheme();
    const reduceMotion = useReduceMotion();
    const focused = useIsFocused();
    const [width, setWidth] = useState(0);
    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setWidth((prev) => (prev === w ? prev : w));
    }, []);
    const height = Math.round(width * ART_RATIO);
    const traits = archetypeTraits(archetype, tempScale);

    return (
        <View style={styles.root}>
            <View style={[styles.artFrame, { height: height || undefined }]} onLayout={onLayout}>
                {width > 0 && (
                    <StyleDnaArt
                        archetype={archetype}
                        width={width}
                        height={height}
                        animate={!locked && focused && !reduceMotion}
                        dim={locked}
                    />
                )}
                {/* A scrim under the words so they hold up over a bright aura. */}
                <LinearGradient
                    colors={['rgba(11,17,32,0)', 'rgba(11,17,32,0.82)']}
                    locations={[0.35, 1]}
                    style={StyleSheet.absoluteFill}
                    pointerEvents='none'
                />
                <View style={styles.overlay} pointerEvents='box-none'>
                    <View style={styles.eyebrowRow}>
                        <Text style={styles.eyebrow}>Style DNA</Text>
                        {!locked && (
                            // Says what the read is built on, rather than a
                            // generic "Personalized". Dark glass, since it sits on
                            // the art whatever the app theme.
                            <ForceDarkPalette>
                                <GlassCard glassStyle='clear' style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {level === 'active'
                                            ? `From ${archetype.totalOutfits} outfits`
                                            : `Early read · ${archetype.totalOutfits} outfits`}
                                    </Text>
                                </GlassCard>
                            </ForceDarkPalette>
                        )}
                    </View>
                    {locked ? (
                        <>
                            <Text style={styles.name} accessibilityRole='header'>
                                Your style has a name.
                            </Text>
                            <Text style={styles.tagline}>
                                Drawn from what you actually wear. See it with Ojo Pro.
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.name} accessibilityRole='header' numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                                {archetype.name}
                            </Text>
                            <Text style={styles.tagline}>{archetype.tagline}</Text>
                        </>
                    )}
                </View>
            </View>

            {!locked && (
                <View style={styles.below}>
                    <Text style={[styles.detail, { color: colors.textSecondary }]}>
                        {archetype.detail}
                        {level === 'learning' ? ' Early read: it can change as you log more.' : ''}
                    </Text>
                    {traits.length > 0 && (
                        // Native Liquid Glass tiles on iOS 26; elsewhere (Android,
                        // older iOS) GlassCard draws the same translucent fill and
                        // border these had before. Not a GlassGroup: at 8 pt apart
                        // iOS would blend the tiles into one shape.
                        <View style={styles.traits}>
                            {traits.map((t) => (
                                <GlassCard
                                    key={t.label}
                                    style={styles.trait}
                                    accessible
                                    accessibilityLabel={`${t.label}: ${t.value}`}
                                >
                                    <Text style={[styles.traitLabel, { color: colors.textMuted }]}>{t.label}</Text>
                                    <Text style={[styles.traitValue, { color: colors.textPrimary }]}>{t.value}</Text>
                                </GlassCard>
                            ))}
                        </View>
                    )}
                    {onShare && (
                        <Pressable
                            onPress={onShare}
                            style={[styles.shareBtn, { borderColor: colors.glassBorder }]}
                            accessibilityRole='button'
                            accessibilityLabel='Share your Style DNA'
                        >
                            <Text style={[styles.shareText, { color: colors.textPrimary }]}>Share your Style DNA</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

export default memo(StyleDnaHero);

const styles = StyleSheet.create({
    root: { gap: spacing.sm },
    artFrame: {
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: '#0B1120',
        minHeight: 160,
    },
    overlay: {
        ...StyleSheet.absoluteFill,
        justifyContent: 'flex-end',
        padding: spacing.sm + 2,
        gap: 4,
    },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eyebrow: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.xs,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.72)',
    },
    // Fallback (Android, iOS before 26) gets GlassCard's translucent fill and border.
    badge: {
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: radius.pill,
    },
    badgeText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.2 },
    name: {
        fontFamily: fonts.display,
        fontSize: 27,
        lineHeight: 32,
        color: '#ffffff',
    },
    tagline: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        lineHeight: 18,
        color: 'rgba(255,255,255,0.86)',
    },
    below: { gap: spacing.sm },
    detail: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 19 },
    traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    trait: {
        borderWidth: 1,
        borderRadius: radius.sm,
        paddingVertical: 6,
        paddingHorizontal: 10,
        gap: 1,
    },
    traitLabel: { fontFamily: fonts.body, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
    traitValue: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
    shareBtn: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingVertical: 7,
        paddingHorizontal: 14,
    },
    shareText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
});
