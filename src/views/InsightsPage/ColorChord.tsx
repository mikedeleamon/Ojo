/**
 * ColorChord
 * ----------
 * Chord / arc diagram of the user's most-frequent colour pairings (Style DNA).
 * Each distinct colour becomes a node on a ring; every logged pairing is a chord
 * bowing through the centre, its thickness + opacity scaled by how often that
 * combo appears.
 *
 * Clarity aids (the diagram is the evidence, not the message):
 *   • a plain-language headline states the signature combo up front
 *   • tap a colour node to highlight its pairings and dim the rest, with a
 *     readout of who it pairs with and how often
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { Text } from '../../components/primitives';
import { ColorTokens, fonts, fontSizes, fontWeights } from '../../theme/tokens';
import { hapticSelection } from '../../lib/haptics';
import { swatchHex } from './swatches';

interface Props {
  pairs: Array<{ pair: string; count: number }>;
  colors: ColorTokens;
  reduceMotion: boolean;
}

const SIZE = 260;
const CENTER = SIZE / 2;
const NODE_R = 92;     // ring radius the colour nodes sit on
const LABEL_R = 110;   // radius for the colour-name labels
const SWATCH_R = 8;    // node dot radius
const HIT_R = 20;      // invisible touch target around each node

const DIM = 0.08;      // opacity for de-emphasised chords when a node is active

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface NodePos {
  name: string;
  x: number;
  y: number;
}

interface Chord {
  key: string;
  a: string;
  b: string;
  count: number;
  from: NodePos;
  to: NodePos;
  width: number;
  opacity: number;
}

/** Lay colour nodes around a ring, build chords, and index each node's partners. */
const buildLayout = (pairs: Array<{ pair: string; count: number }>) => {
  const weight: Record<string, number> = {};
  for (const { pair, count } of pairs) {
    const [a, b] = pair.split('|');
    weight[a] = (weight[a] ?? 0) + count;
    weight[b] = (weight[b] ?? 0) + count;
  }

  const names = Object.keys(weight).sort((x, y) => weight[y] - weight[x]);
  const n = names.length;

  const pos: Record<string, NodePos> = {};
  names.forEach((name, i) => {
    const angle = (-90 + (i / Math.max(1, n)) * 360) * (Math.PI / 180);
    pos[name] = {
      name,
      x: CENTER + Math.cos(angle) * NODE_R,
      y: CENTER + Math.sin(angle) * NODE_R,
    };
  });

  const maxCount = Math.max(1, ...pairs.map(p => p.count));
  const partners: Record<string, Array<{ partner: string; count: number }>> = {};

  const chords: Chord[] = pairs
    .map(({ pair, count }) => {
      const [a, b] = pair.split('|');
      const from = pos[a];
      const to = pos[b];
      if (!from || !to) return null;
      (partners[a] ??= []).push({ partner: b, count });
      (partners[b] ??= []).push({ partner: a, count });
      const t = count / maxCount;
      return {
        key: pair,
        a,
        b,
        count,
        from,
        to,
        width: lerp(1.5, 7, t),
        opacity: lerp(0.4, 0.95, t),
      };
    })
    .filter((c): c is Chord => c !== null);

  for (const k of Object.keys(partners)) {
    partners[k].sort((x, y) => y.count - x.count);
  }

  return { nodes: names.map(name => pos[name]), chords, partners };
};

const anchorFor = (x: number): 'start' | 'middle' | 'end' => {
  if (x < CENTER - 4) return 'end';
  if (x > CENTER + 4) return 'start';
  return 'middle';
};

export function ColorChord({ pairs, colors, reduceMotion }: Props) {
  const { nodes, chords, partners } = useMemo(() => buildLayout(pairs), [pairs]);
  const [selected, setSelected] = useState<string | null>(null);

  // Reset any selection if the underlying data changes.
  useEffect(() => setSelected(null), [pairs]);

  const anim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [pairs, reduceMotion, anim]);

  if (chords.length === 0) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  const toggle = (name: string) => {
    hapticSelection();
    setSelected(prev => (prev === name ? null : name));
  };

  const touches = (c: Chord) =>
    selected === null || c.a === selected || c.b === selected;
  const involved = (name: string) =>
    selected === null || name === selected ||
    (partners[selected]?.some(p => p.partner === name) ?? false);

  const top = pairs[0];
  const [ta, tb] = top.pair.split('|');

  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ scale }] }}
    >
      {/* Headline — the takeaway in words */}
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.textSecondary,
          lineHeight: fontSizes.sm * 1.45,
          marginBottom: 4,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: fontWeights.semibold }}>
          {ta} + {tb}
        </Text>{' '}
        is your signature combo — worn together{' '}
        <Text style={{ color: colors.textPrimary, fontWeight: fontWeights.semibold }}>
          {top.count}×
        </Text>
        .
      </Text>

      <View style={{ alignItems: 'center' }}>
        <Svg width="100%" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            {chords.map((c, i) => {
              const a = swatchHex(c.from.name);
              const b = swatchHex(c.to.name);
              return (
                <LinearGradient
                  key={c.key}
                  id={`chord-${i}`}
                  x1={c.from.x}
                  y1={c.from.y}
                  x2={c.to.x}
                  y2={c.to.y}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={a} stopOpacity={0.95} />
                  <Stop offset="1" stopColor={b} stopOpacity={0.95} />
                </LinearGradient>
              );
            })}
          </Defs>

          {/* Faint guide ring for depth */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={NODE_R}
            stroke={colors.glassBorder}
            strokeWidth={1}
            fill="none"
          />

          {/* Chords — bow toward centre via a quadratic with the centre as control */}
          <G>
            {chords.map((c, i) => (
              <Path
                key={c.key}
                d={`M ${c.from.x} ${c.from.y} Q ${CENTER} ${CENTER} ${c.to.x} ${c.to.y}`}
                stroke={`url(#chord-${i})`}
                strokeWidth={touches(c) ? c.width : Math.max(1, c.width * 0.6)}
                strokeOpacity={touches(c) ? c.opacity : DIM}
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </G>

          {/* Colour nodes + labels (tap target wraps each) */}
          {nodes.map(node => {
            const hex = swatchHex(node.name);
            const on = involved(node.name);
            const labelX = CENTER + ((node.x - CENTER) / NODE_R) * LABEL_R;
            const labelY = CENTER + ((node.y - CENTER) / NODE_R) * LABEL_R;
            const isSel = selected === node.name;
            return (
              <G
                key={node.name}
                onPress={() => toggle(node.name)}
                opacity={on ? 1 : 0.3}
              >
                {/* Invisible larger hit area */}
                <Circle cx={node.x} cy={node.y} r={HIT_R} fill={colors.white} fillOpacity={0} />
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={isSel ? SWATCH_R + 2 : SWATCH_R}
                  fill={hex}
                  stroke={colors.white}
                  strokeWidth={isSel ? 2.5 : 1.5}
                  strokeOpacity={isSel ? 0.9 : 0.5}
                />
                <SvgText
                  x={labelX}
                  y={labelY}
                  fill={isSel ? colors.textPrimary : colors.textMuted}
                  fontSize={9}
                  fontFamily={fonts.body}
                  textAnchor={anchorFor(node.x)}
                  alignmentBaseline="middle"
                >
                  {node.name}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Readout — selection details, or a hint to explore */}
      {selected ? (
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: fontSizes.xs * 1.5,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: fontWeights.semibold }}>
            {selected}
          </Text>{' '}
          pairs with{' '}
          {(partners[selected] ?? [])
            .slice(0, 3)
            .map(p => `${p.partner} (${p.count}×)`)
            .join(' · ')}
        </Text>
      ) : (
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          Tap a colour to see what it pairs with
        </Text>
      )}
    </Animated.View>
  );
}
