/**
 * ColorChord
 * ----------
 * Chord / arc diagram of the user's most-frequent colour pairings (Style DNA).
 * Each distinct colour becomes a node on a ring; every logged pairing is a chord
 * bowing through the centre, its thickness + opacity scaled by how often that
 * combo appears. Chords are stroked with a colour-A → colour-B gradient so the
 * relationship reads at a glance. Styled to sit inside a GlassCard.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { ColorTokens, fonts } from '../../theme/tokens';
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

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface NodePos {
  name: string;
  x: number;
  y: number;
}

interface Chord {
  key: string;
  from: NodePos;
  to: NodePos;
  width: number;
  opacity: number;
}

/** Lay colour nodes evenly around a ring (heaviest first) and build chords. */
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
    // Start at the top (-90°) and walk clockwise.
    const angle = (-90 + (i / Math.max(1, n)) * 360) * (Math.PI / 180);
    pos[name] = {
      name,
      x: CENTER + Math.cos(angle) * NODE_R,
      y: CENTER + Math.sin(angle) * NODE_R,
    };
  });

  const maxCount = Math.max(1, ...pairs.map(p => p.count));
  const chords: Chord[] = pairs
    .map(({ pair, count }) => {
      const [a, b] = pair.split('|');
      const from = pos[a];
      const to = pos[b];
      if (!from || !to) return null;
      const t = count / maxCount;
      return {
        key: pair,
        from,
        to,
        width: lerp(1.5, 7, t),
        opacity: lerp(0.4, 0.95, t),
      };
    })
    .filter((c): c is Chord => c !== null);

  return { nodes: names.map(name => pos[name]), chords };
};

/** Anchor a label to the side of the ring it sits on, so text grows outward. */
const anchorFor = (x: number): 'start' | 'middle' | 'end' => {
  if (x < CENTER - 4) return 'end';
  if (x > CENTER + 4) return 'start';
  return 'middle';
};

export function ColorChord({ pairs, colors, reduceMotion }: Props) {
  const { nodes, chords } = useMemo(() => buildLayout(pairs), [pairs]);

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

  return (
    <Animated.View
      style={{ alignItems: 'center', opacity: anim, transform: [{ scale }] }}
    >
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

        {/* Faint guide ring under the chords for depth */}
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
              strokeWidth={c.width}
              strokeOpacity={c.opacity}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </G>

        {/* Colour nodes + labels */}
        {nodes.map(node => {
          const hex = swatchHex(node.name);
          const labelX =
            CENTER + ((node.x - CENTER) / NODE_R) * LABEL_R;
          const labelY =
            CENTER + ((node.y - CENTER) / NODE_R) * LABEL_R;
          return (
            <G key={node.name}>
              <Circle
                cx={node.x}
                cy={node.y}
                r={SWATCH_R}
                fill={hex}
                stroke={colors.white}
                strokeWidth={1.5}
                strokeOpacity={0.5}
              />
              <SvgText
                x={labelX}
                y={labelY}
                fill={colors.textMuted}
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
    </Animated.View>
  );
}
