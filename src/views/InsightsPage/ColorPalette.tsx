/**
 * ColorPalette
 * ------------
 * Circle-pack ("packed bubbles") view of the wardrobe's colour composition.
 * Each colour is a glassy orb sized by how many garments carry it, so the
 * dominant palette reads instantly. Greedy tangent packing keeps the cluster
 * tight around the centre — no layout dependency needed. Styled for a GlassCard.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { ArticleInsight } from '../../lib/insightsEngine';
import { ColorTokens, fonts } from '../../theme/tokens';
import { swatchHex, metallicStops, readableOn } from './swatches';

interface Props {
  articles: ArticleInsight[];
  colors: ColorTokens;
  reduceMotion: boolean;
}

const W = 320;
const H = 220;
const PAD = 8;
const TOP_N = 11;          // distinct colours before the rest fold into "Other"
const MIN_LABEL_R = 16;    // orb radius needed to show the count
const MIN_NAME_R = 26;     // orb radius needed to also show the name

interface RawBubble {
  name: string;
  count: number;
  r: number;
}
interface Packed extends RawBubble {
  x: number;
  y: number;
}
interface Laid extends RawBubble {
  cx: number;
  cy: number;
  rr: number;
}

/** Aggregate article colours into sized bubbles (top N + folded "Other"). */
const buildBubbles = (articles: ArticleInsight[]): RawBubble[] => {
  const counts: Record<string, number> = {};
  for (const it of articles) {
    const c = it.article.color;
    if (!c) continue;
    counts[c] = (counts[c] ?? 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_N);
  const restCount = sorted
    .slice(TOP_N)
    .reduce((sum, [, n]) => sum + n, 0);

  // Area ∝ count → radius ∝ sqrt(count). Absolute scale comes later from fit().
  const bubbles: RawBubble[] = top.map(([name, count]) => ({
    name,
    count,
    r: Math.sqrt(count),
  }));
  if (restCount > 0) {
    bubbles.push({ name: 'Other', count: restCount, r: Math.sqrt(restCount) });
  }
  return bubbles;
};

/** Greedy tangent packing: place each orb touching an existing one, nearest the
 *  origin without overlapping. O(n² · angles) — fine for a dozen bubbles. */
const pack = (bubbles: RawBubble[]): Packed[] => {
  const placed: Packed[] = [];
  const STEP = Math.PI / 24;

  for (const b of bubbles) {
    if (placed.length === 0) {
      placed.push({ ...b, x: 0, y: 0 });
      continue;
    }

    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;

    for (const p of placed) {
      const ring = p.r + b.r;
      for (let a = 0; a < Math.PI * 2; a += STEP) {
        const x = p.x + Math.cos(a) * ring;
        const y = p.y + Math.sin(a) * ring;

        let ok = true;
        for (const q of placed) {
          if (Math.hypot(x - q.x, y - q.y) < b.r + q.r - 0.5) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        const d = Math.hypot(x, y);
        if (d < bestDist) {
          bestDist = d;
          best = { x, y };
        }
      }
    }

    placed.push({ ...b, x: best?.x ?? 0, y: best?.y ?? 0 });
  }

  return placed;
};

/** Scale + centre the packed cluster into the viewBox. */
const fit = (packed: Packed[]): Laid[] => {
  if (packed.length === 0) return [];

  const minX = Math.min(...packed.map(p => p.x - p.r));
  const maxX = Math.max(...packed.map(p => p.x + p.r));
  const minY = Math.min(...packed.map(p => p.y - p.r));
  const maxY = Math.max(...packed.map(p => p.y + p.r));

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);

  const offsetX = (W - spanX * scale) / 2;
  const offsetY = (H - spanY * scale) / 2;

  return packed.map(p => ({
    ...p,
    cx: (p.x - minX) * scale + offsetX,
    cy: (p.y - minY) * scale + offsetY,
    rr: p.r * scale,
  }));
};

export function ColorPalette({ articles, colors, reduceMotion }: Props) {
  const bubbles = useMemo(() => fit(pack(buildBubbles(articles))), [articles]);

  const anim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 650,
      useNativeDriver: true,
    }).start();
  }, [articles, reduceMotion, anim]);

  if (bubbles.length === 0) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }] }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          {bubbles.map((b, i) => {
            const stops = metallicStops(b.name);
            if (!stops) return null;
            return (
              <LinearGradient
                key={b.name}
                id={`orb-${i}`}
                x1={b.cx - b.rr}
                y1={b.cy - b.rr}
                x2={b.cx + b.rr}
                y2={b.cy + b.rr}
                gradientUnits="userSpaceOnUse"
              >
                {stops.map((s, si) => (
                  <Stop
                    key={si}
                    offset={si / (stops.length - 1)}
                    stopColor={s}
                  />
                ))}
              </LinearGradient>
            );
          })}
        </Defs>

        {bubbles.map((b, i) => {
          const hex = swatchHex(b.name);
          const fill = metallicStops(b.name) ? `url(#orb-${i})` : hex;
          const textColor = readableOn(hex);
          return (
            <G key={b.name}>
              {/* Orb body */}
              <Circle cx={b.cx} cy={b.cy} r={b.rr} fill={fill} fillOpacity={0.9} />
              {/* Glass rim */}
              <Circle
                cx={b.cx}
                cy={b.cy}
                r={b.rr}
                stroke={colors.white}
                strokeWidth={1}
                strokeOpacity={0.3}
                fill="none"
              />
              {/* Top-left sheen for the glassy sphere read */}
              <Circle
                cx={b.cx - b.rr * 0.3}
                cy={b.cy - b.rr * 0.34}
                r={b.rr * 0.45}
                fill={colors.white}
                fillOpacity={0.18}
              />
              {b.rr >= MIN_NAME_R && (
                <SvgText
                  x={b.cx}
                  y={b.cy - 3}
                  fill={textColor}
                  fontSize={Math.min(13, b.rr * 0.42)}
                  fontFamily={fonts.body}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {b.name}
                </SvgText>
              )}
              {b.rr >= MIN_LABEL_R && (
                <SvgText
                  x={b.cx}
                  y={b.rr >= MIN_NAME_R ? b.cy + 11 : b.cy}
                  fill={textColor}
                  fontSize={Math.min(12, b.rr * 0.4)}
                  fontFamily={fonts.display}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {b.count}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </Animated.View>
  );
}
