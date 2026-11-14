/**
 * StyleDnaShareCard — the Style DNA poster for an Instagram Story: the
 * generative art, the style name, and the facts behind it. Poster fills the 9:16
 * story; the sticker is a compact version for a video Story.
 *
 * The art renders still here (a capture is one frame anyway).
 */

import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../primitives';
import ShareCardFrame from './ShareCardFrame';
import { contentWidth, type ShareCardVariant } from './ShareCardFrame.styles';
import cs from './shareCardCommon.styles';
import StyleDnaArt from '../StyleDna/StyleDnaArt';
import { archetypeTraits } from '../StyleDna/traits';
import { ART_GROUND } from '../../lib/styleArt';
import { fonts, fontSizes } from '../../theme/tokens';
import type { StyleArchetype } from '../../lib/styleArchetype';
import type { ViewRef } from '../../types/nativeRefs';

interface Props {
    archetype: StyleArchetype;
    tempScale: 'imperial' | 'metric';
    variant?: ShareCardVariant;
}

const StyleDnaShareCard = forwardRef<ViewRef, Props>(({ archetype, tempScale, variant = 'poster' }, ref) => {
    const sticker = variant === 'sticker';
    const artW = contentWidth(variant);
    const artH = Math.round(artW * 0.62);
    const traits = archetypeTraits(archetype, tempScale);

    return (
        <ShareCardFrame ref={ref} variant={variant} gradientColors={ART_GROUND}>
            <Text style={cs.eyebrow}>My Style DNA</Text>
            <View style={[styles.art, { width: artW, height: artH }]}>
                <StyleDnaArt archetype={archetype} width={artW} height={artH} />
            </View>
            <Text
                style={[styles.name, sticker && styles.nameSticker]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
            >
                {archetype.name}
            </Text>
            <Text style={cs.subline}>{archetype.tagline}</Text>
            {!sticker && traits.length > 0 && (
                <View style={styles.traits}>
                    {traits.map((t) => (
                        <View key={t.label} style={styles.trait}>
                            <Text style={styles.traitLabel}>{t.label}</Text>
                            <Text style={styles.traitValue}>{t.value}</Text>
                        </View>
                    ))}
                </View>
            )}
            {!sticker && (
                <Text style={styles.count}>
                    Read from {archetype.totalOutfits} outfit{archetype.totalOutfits === 1 ? '' : 's'} worn
                </Text>
            )}
        </ShareCardFrame>
    );
});

StyleDnaShareCard.displayName = 'StyleDnaShareCard';

export default StyleDnaShareCard;

const styles = StyleSheet.create({
    art: { marginTop: 12, borderRadius: 20, overflow: 'hidden' },
    name: {
        fontFamily: fonts.display,
        fontSize: 30,
        lineHeight: 35,
        color: '#ffffff',
        marginTop: 16,
    },
    nameSticker: { fontSize: 24, lineHeight: 29, marginTop: 12 },
    traits: { marginTop: 14, gap: 6 },
    trait: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    traitLabel: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
    },
    traitValue: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: '#ffffff' },
    count: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 12,
    },
});
