/**
 * export_data.ts — step 1 of the visual-library pipeline (see README.md).
 *
 * Runs the app's own code and writes the result to work/data/library.json, so
 * the Python renderer never keeps a second copy of anything:
 *   - every backdrop look (src/lib/visualLibrary/looks.ts), with the gradient
 *     gradientFor() gives it and the layers backdropLayersFor() puts on it;
 *   - every particle number (src/lib/weather/backdropSpec.ts);
 *   - the Weekly Recap's gradient cycle, geometry, timing and easing
 *     (src/lib/recapVisuals.ts).
 *
 *   npx tsx scripts/visual-library/export_data.ts
 *
 * Re-run after changing any of those files.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { gradientFor } from '../../src/lib/weather/conditions';
import { backdropLayersFor } from '../../src/lib/weather/backdropLayers';
import * as spec from '../../src/lib/weather/backdropSpec';
import { ALL_LOOKS, REQUIRED_LOOP_KEYS, recipeFor } from '../../src/lib/visualLibrary/looks';
import {
  RECAP_GRADIENT_CYCLE,
  RECAP_GRADIENT_END,
  RECAP_GRADIENT_EASING,
  RECAP_GRADIENT_FADE_MS,
  RECAP_GRADIENT_HOLD_MS,
  RECAP_GRADIENT_START,
  RECAP_SCRIM,
} from '../../src/lib/recapVisuals';

// $VL_WORK redirects the whole pipeline to a throwaway work folder (vl_common.py).
const outDir = join(process.env.VL_WORK ?? join(__dirname, 'work'), 'data');
mkdirSync(outDir, { recursive: true });

// The story canvas, in points: an iPhone 17 Pro's width at Instagram's 9:16.
// Particle sizes are in points, so they come out the size they are on a phone.
const CANVAS_WIDTH_PT = 402;

const looks = Object.fromEntries(
  ALL_LOOKS.map((look) => {
    const r = recipeFor(look);
    return [look, {
      recipe: r,
      gradient: gradientFor(r.condition, r.isDayTime, r.sun?.elevationDeg, r.sun?.isRising),
      layers: backdropLayersFor(r.condition, r.isDayTime),
    }];
  }),
);

const library = {
  canvas: {
    widthPt: CANVAS_WIDTH_PT,
    heightPt: (CANVAS_WIDTH_PT * 16) / 9,
    // Default colours of the layers as WeatherHUD mounts them.
    particleColor: '#fefefe',
    fogColor: '#ffffff',
    flashColor: '#ffffff',
  },
  looks,
  loops: { required: REQUIRED_LOOP_KEYS },
  spec: {
    rain: {
      variants: spec.RAIN_VARIANTS,
      dropsPerGroup: spec.DROPS_PER_GROUP,
      streakWidth: spec.STREAK_WIDTH,
      angle: spec.DEFAULT_RAIN_ANGLE,
    },
    flash: {
      ms: spec.FLASH_MS,
      curve: spec.FLASH_CURVE,
      gapMinMs: spec.FLASH_GAP_MIN_MS,
      gapSpreadMs: spec.FLASH_GAP_SPREAD_MS,
    },
    stars: {
      seeds: spec.STAR_SEEDS,
      staticSeeds: spec.STATIC_STAR_SEEDS,
      nearMinD: spec.NEAR_MIN_D,
      phases: spec.PHASE_CONFIGS,
      fastPhaseIndices: spec.FAST_PHASE_INDICES,
      slowPhaseIndices: spec.SLOW_PHASE_INDICES,
      twinkleMinNear: spec.TWINKLE_MIN_NEAR,
      twinkleMinFar: spec.TWINKLE_MIN_FAR,
      minD: spec.STAR_MIN_D,
      maxD: spec.STAR_MAX_D,
      sparklePath: spec.SPARKLE_D,
      spanRatio: spec.SPAN_RATIO,
    },
    shootingStar: spec.SHOOTING_STAR,
    sunGlare: spec.SUN_GLARE,
    flakes: {
      perColumn: spec.FLAKES_PER_COLUMN,
      stroke: spec.FLAKE_STROKE,
      snow: spec.SNOW_GROUPS,
      pellets: spec.SLEET_PELLET_GROUPS,
    },
    fog: spec.FOG_LAYERS,
  },
  recap: {
    cycle: RECAP_GRADIENT_CYCLE,
    start: RECAP_GRADIENT_START,
    end: RECAP_GRADIENT_END,
    scrim: RECAP_SCRIM,
    holdMs: RECAP_GRADIENT_HOLD_MS,
    fadeMs: RECAP_GRADIENT_FADE_MS,
    easing: RECAP_GRADIENT_EASING,
  },
};

const outFile = join(outDir, 'library.json');
writeFileSync(outFile, JSON.stringify(library, null, 2) + '\n');
console.log(
  `Wrote ${outFile}\n` +
  `  ${ALL_LOOKS.length} looks, ${REQUIRED_LOOP_KEYS.length} loops (with the recap)`,
);
