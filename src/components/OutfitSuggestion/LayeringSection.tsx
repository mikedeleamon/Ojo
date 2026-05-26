import { useMemo } from 'react';
import { View, Text, GlassCard } from '../primitives';
import type { OutfitSlot } from '../../lib/outfit/types';
import type { LayeringResult } from '../../lib/layering/types';
import { useTheme } from '../../theme/ThemeContext';
import { CSS_COLORS, LAYER_TIERS } from './constants';
import { makeLayerStyles } from './OutfitSuggestion.styles';

const ConfidencePip = ({ value }: { value: number }) => {
    const { colors } = useTheme();
    const layerStyles = useMemo(() => makeLayerStyles(colors), [colors]);
    const pct = Math.round(value * 100);
    const col =
        pct >= 80
            ? 'rgba(52,211,153,0.85)'
            : pct >= 60
              ? 'rgba(251,191,36,0.85)'
              : 'rgba(148,163,184,0.75)';
    return (
        <View style={[layerStyles.confidencePip, { borderColor: col }]}>
            <Text style={[layerStyles.confidenceText, { color: col }]}>
                Confidence Score: {pct}%
            </Text>
        </View>
    );
};

const LayerRow = ({
    label,
    slot,
}: {
    label: string;
    slot: OutfitSlot | null;
}) => {
    const { colors } = useTheme();
    const layerStyles = useMemo(() => makeLayerStyles(colors), [colors]);
    if (!slot) return null;
    const name = slot.article.name || slot.article.clothingType;
    const dotColor = slot.article.color ? CSS_COLORS[slot.article.color] : null;
    return (
        <View style={layerStyles.layerRow}>
            <Text style={layerStyles.layerTierLabel}>{label}</Text>
            <View style={layerStyles.layerRowDivider} />
            {dotColor && (
                <View style={[layerStyles.layerDot, { backgroundColor: dotColor }]} />
            )}
            <Text style={layerStyles.layerName} numberOfLines={1}>
                {name}
            </Text>
            {slot.article.fabricType ? (
                <Text style={layerStyles.layerFabric}>{slot.article.fabricType}</Text>
            ) : null}
        </View>
    );
};

export const LayeringSection = ({ layering }: { layering: LayeringResult }) => {
    const { colors } = useTheme();
    const layerStyles = useMemo(() => makeLayerStyles(colors), [colors]);
    const hasLayers =
        layering.layers.base || layering.layers.mid || layering.layers.outer;
    return (
        <View style={layerStyles.root}>
            <View style={layerStyles.header}>
                <Text style={layerStyles.title}>Layering</Text>
                <ConfidencePip value={layering.confidence} />
            </View>

            {hasLayers && (
                <GlassCard style={layerStyles.layerStack}>
                    {LAYER_TIERS.map(({ key, label }) => (
                        <LayerRow
                            key={key}
                            label={label}
                            slot={layering.layers[key]}
                        />
                    ))}
                </GlassCard>
            )}

            <Text style={layerStyles.recommendation}>{layering.recommendation}</Text>

            {layering.timeline && layering.timeline.length > 0 && (
                <View style={layerStyles.timeline}>
                    {layering.timeline.map((step, i) => (
                        <View key={i} style={layerStyles.timelineRow}>
                            <Text style={layerStyles.timelineTime}>{step.time}</Text>
                            <View style={layerStyles.timelineDivider} />
                            <Text style={layerStyles.timelineAction}>{step.action}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};
