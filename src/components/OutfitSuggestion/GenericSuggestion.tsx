/**
 * GenericSuggestion
 * ─────────────────
 * Today's advice for a signed-in user whose closet can't produce an outfit yet.
 *
 * Deliberately NOT a copy of the real outfit card. It carries the headline, the
 * layering advice and the weather notes — the part that is genuinely useful —
 * and nothing that would imply ownership: no garment tiles, no illustrations,
 * no Outfit Score, no confidence figure, no "Wore this today". Scoring or
 * logging a garment the user doesn't own is a number about nothing, and the
 * wear log is training data for *their* taste.
 *
 * The CTA is the point of the card, not an afterthought: this state should
 * always be pushing toward a closet that makes it unnecessary.
 */
import { useMemo } from 'react';
import { View, Text, Pressable } from '../primitives';
import { GENERIC_SUGGESTION_NOTE, type GenericOutfit } from '../../lib/archetypes/genericOutfit';
import { climateBandLabel } from '../../lib/climate';
import { makeStyles } from './OutfitSuggestion.styles';
import { useTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';

interface Props {
    outfit: GenericOutfit;
    /** Copy above the advice, so the card explains why it isn't personal yet. */
    title: string;
    ctaLabel: string;
    onCta: () => void;
}

export default function GenericSuggestion({ outfit, title, ctaLabel, onCta }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.genericCard}>
            <Text style={styles.genericLabel}>
                {`Typical ${climateBandLabel(outfit.band)} wardrobe`}
            </Text>
            <Text style={styles.genericTitle}>{title}</Text>

            <Text style={styles.genericHeadline}>{outfit.headline}</Text>

            {outfit.recommendation ? (
                <Text style={styles.genericBody}>{outfit.recommendation}</Text>
            ) : null}

            {outfit.timeline && outfit.timeline.length > 0 && (
                <View style={styles.genericTimeline}>
                    {outfit.timeline.map((step, i) => (
                        <View key={i} style={styles.genericTimelineRow}>
                            <Text style={styles.genericTimelineTime}>{step.time}</Text>
                            <Text style={styles.genericTimelineAction}>{step.action}</Text>
                        </View>
                    ))}
                </View>
            )}

            {outfit.notes.length > 0 && (
                <View style={{ gap: 4, marginTop: spacing.xs }}>
                    {outfit.notes.slice(0, 3).map((n, i) => (
                        <Text key={i} style={styles.note}>· {n}</Text>
                    ))}
                </View>
            )}

            <Text style={styles.genericNote}>{GENERIC_SUGGESTION_NOTE}</Text>

            <Pressable
                style={styles.ctaBtn}
                onPress={onCta}
                accessibilityRole='button'
                accessibilityLabel={ctaLabel}
            >
                <Text style={styles.ctaBtnText}>{ctaLabel}</Text>
            </Pressable>
        </View>
    );
}
