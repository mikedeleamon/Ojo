import { useMemo, useState } from 'react';
import { Image } from 'react-native';
import { View, Text, Pressable, GlassCard } from '../primitives';
import { HangerIcon } from '../shared';
import { useTheme } from '../../theme/ThemeContext';
import { addHistoryEntry } from '../../lib/outfitHistory';
import { hapticSuccess } from '../../lib/haptics';
import { makeStyles } from './TripModeCard.styles';
import type { SavedTripFitPlan, ClothingArticle } from '../../types';
import type { OutfitResult } from '../../lib/outfit/types';

interface Props {
    trip: SavedTripFitPlan;
    outfit: OutfitResult | null;
    dayIndex: number;
    total: number;
    locationConfirmed: boolean;
    source: 'logged' | 'generated' | null;
    driftNote: string | null;
    closetId: string;
    closetName: string;
    onOpenTrip: () => void;
    onDismiss: () => void;
}

const Thumb = ({
    article,
    bg,
    muted,
}: {
    article: ClothingArticle;
    bg: string;
    muted: string;
}) => {
    const [err, setErr] = useState(false);
    return (
        <GlassCard glassStyle="clear" style={[thumbBase, { backgroundColor: bg }]}>
            {article.imageUrl && !err ? (
                <Image
                    source={{ uri: article.imageUrl }}
                    style={{ width: 56, height: 56 }}
                    resizeMode="cover"
                    onError={() => setErr(true)}
                />
            ) : (
                <HangerIcon size={22} color={muted} decorative />
            )}
        </GlassCard>
    );
};

const thumbBase = {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
};

export default function TripModeCard({
    trip,
    outfit,
    dayIndex,
    total,
    locationConfirmed,
    source,
    driftNote,
    closetId,
    closetName,
    onOpenTrip,
    onDismiss,
}: Props) {
    const { colors } = useTheme();
    const st = useMemo(() => makeStyles(colors), [colors]);
    const [logged, setLogged] = useState(false);

    const articles = useMemo(
        () => (outfit?.slots ?? []).map((s) => s.article),
        [outfit],
    );

    const handleWoreThis = async () => {
        if (logged || articles.length === 0) return;
        setLogged(true);
        hapticSuccess();
        const summary = articles
            .map((a) => a.name || a.clothingType)
            .filter(Boolean)
            .join(' · ');
        try {
            await addHistoryEntry({
                closetId,
                closetName,
                articleIds: articles.map((a) => a._id),
                articleSummary: summary || 'Trip outfit',
            });
        } catch {
            /* fire-and-forget; the local write already happened in addHistoryEntry */
        }
    };

    return (
        <View style={st.wrap} pointerEvents="box-none">
            <GlassCard glassStyle="regular" style={st.card}>
                <Pressable
                    style={st.dismissBtn}
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss Trip Mode"
                    hitSlop={8}
                >
                    <Text style={st.dismissText}>✕</Text>
                </Pressable>

                <View style={st.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={st.eyebrow}>Trip Mode</Text>
                        <Text style={st.destination} numberOfLines={1}>
                            {trip.destination}
                        </Text>
                        <Text style={st.dayLine}>
                            Day {dayIndex} of {total} · {trip.occasion}
                        </Text>
                    </View>
                    <GlassCard glassStyle="clear" style={st.badge}>
                        <Text style={st.badgeText}>
                            {locationConfirmed ? '📍 You’re here' : '🗓️ Trip today'}
                        </Text>
                    </GlassCard>
                </View>

                {articles.length > 0 ? (
                    <View style={st.thumbRow}>
                        {articles.slice(0, 5).map((a, i) => (
                            <Thumb
                                key={a._id ?? i}
                                article={a}
                                bg={colors.glassBg}
                                muted={colors.textMuted}
                            />
                        ))}
                    </View>
                ) : (
                    <Text style={st.emptyText}>
                        No outfit saved for today yet — open your trip to plan one.
                    </Text>
                )}

                {driftNote && <Text style={st.driftNote}>⚠️ {driftNote}</Text>}

                {source === 'generated' && articles.length > 0 && (
                    <Text style={st.sourceTag}>✨ Built from today’s weather</Text>
                )}

                <View style={st.actionsRow}>
                    <Pressable
                        style={[st.primaryBtn, (logged || articles.length === 0) && { opacity: 0.6 }]}
                        onPress={handleWoreThis}
                        disabled={logged || articles.length === 0}
                        accessibilityRole="button"
                        accessibilityLabel="Log this outfit as worn"
                    >
                        <Text style={st.primaryBtnText}>
                            {logged ? '✓ Logged' : 'Wore this'}
                        </Text>
                    </Pressable>
                    <Pressable
                        style={st.secondaryBtn}
                        onPress={onOpenTrip}
                        accessibilityRole="button"
                        accessibilityLabel="Open this trip"
                    >
                        <Text style={st.secondaryBtnText}>Open trip</Text>
                    </Pressable>
                </View>
            </GlassCard>
        </View>
    );
}
