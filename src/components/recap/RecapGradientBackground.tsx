/**
 * RecapGradientBackground — the recap's ambient background: the weather
 * gradients slowly crossfading into one another under a heavy ink scrim, the
 * same motion as OjoLandingSite's <GradientBackground>.
 *
 * Two stacked layers ping-pong: layer A is always opaque underneath, layer B
 * fades in over it (t: 0→1), then the *hidden* layer's gradient is swapped for
 * the next one and the fade runs back the other way (t: 1→0). Only ever
 * mutating the fully-covered layer is what keeps the swap from flashing a frame
 * of the wrong gradient — a plain "reset opacity, then advance the index"
 * approach shows the outgoing gradient for one frame.
 *
 * Honors Reduce Motion (WCAG 2.3.3) by holding the brand gradient forever.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, AccessibilityInfo, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  RECAP_GRADIENT_CYCLE,
  RECAP_GRADIENT_START,
  RECAP_GRADIENT_END,
  RECAP_SCRIM,
  RecapGradient,
} from '../../lib/recapVisuals';

const HOLD_MS = 2500;  // fully displayed
const FADE_MS = 8000;  // crossfade
const LEN = RECAP_GRADIENT_CYCLE.length;

interface Layers { a: number; b: number; cur: number }

export interface RecapGradientCycle {
  layers: Layers;
  t: Animated.Value;
  /** The gradient currently dominant on screen — what the story card exports. */
  currentColors: RecapGradient;
  reduceMotion: boolean;
}

export function useRecapGradientCycle(): RecapGradientCycle {
  const [layers, setLayers] = useState<Layers>({ a: 0, b: 1 % LEN, cur: 0 });
  const [reduceMotion, setReduceMotion] = useState(false);
  const t = useRef(new Animated.Value(0)).current;
  // Which layer the next fade reveals: 1 → fade B in, 0 → fade back to A.
  const dirRef = useRef<0 | 1>(1);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => { if (alive) setReduceMotion(v); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion || LEN < 2) return;
    let alive = true;
    let hold: ReturnType<typeof setTimeout>;
    let anim: Animated.CompositeAnimation | null = null;

    const run = () => {
      hold = setTimeout(() => {
        if (!alive) return;
        const target = dirRef.current;
        anim = Animated.timing(t, {
          toValue: target,
          duration: FADE_MS,
          easing: Easing.bezier(0.76, 0, 0.24, 1),
          useNativeDriver: true,
        });
        anim.start(({ finished }) => {
          if (!alive || !finished) return;
          setLayers(prev => {
            const shown = target === 1 ? prev.b : prev.a;
            const next = (shown + 1) % LEN;
            // Reload whichever layer is now completely covered.
            return target === 1
              ? { a: next, b: prev.b, cur: shown }
              : { a: prev.a, b: next, cur: shown };
          });
          dirRef.current = target === 1 ? 0 : 1;
          run();
        });
      }, HOLD_MS);
    };

    run();
    return () => { alive = false; clearTimeout(hold); anim?.stop(); };
  }, [reduceMotion, t]);

  return {
    layers,
    t,
    currentColors: RECAP_GRADIENT_CYCLE[reduceMotion ? 0 : layers.cur],
    reduceMotion,
  };
}

/** Purely decorative — never intercepts touches. */
const RecapGradientBackground = ({ layers, t, reduceMotion }: RecapGradientCycle) => (
  <View style={StyleSheet.absoluteFill} pointerEvents='none'>
    <LinearGradient
      colors={RECAP_GRADIENT_CYCLE[reduceMotion ? 0 : layers.a]}
      start={RECAP_GRADIENT_START}
      end={RECAP_GRADIENT_END}
      style={StyleSheet.absoluteFill}
    />
    {!reduceMotion && (
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: t }]}>
        <LinearGradient
          colors={RECAP_GRADIENT_CYCLE[layers.b]}
          start={RECAP_GRADIENT_START}
          end={RECAP_GRADIENT_END}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    )}
    <View style={[StyleSheet.absoluteFill, { backgroundColor: RECAP_SCRIM }]} />
  </View>
);

export default RecapGradientBackground;
