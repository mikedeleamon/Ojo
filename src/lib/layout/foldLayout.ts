/**
 * foldLayout.ts — the one place that decides how a screen is laid out on the
 * current window. Pure: window size and an optional hinge go in, a layout comes
 * out. Never branches on device model, so the same rules serve the iPhone Duo,
 * Galaxy Z Fold and any other large window.
 */

export type LayoutMode = 'compact' | 'compact-short' | 'two-pane';

export type Rect = { x: number; y: number; width: number; height: number };

export type Hinge = {
  /** In window coordinates. */
  bounds: Rect;
  orientation: 'vertical' | 'horizontal';
  /** True when the bounds cover pixels (a physical gap); false for a seamless fold. */
  occludes: boolean;
  posture: 'flat' | 'half-opened';
};

export type FoldLayout = {
  mode: LayoutMode;
  window: { width: number; height: number };
  hinge: Hinge | null;
  /** How the two panes sit relative to each other. Null outside two-pane mode. */
  axis: 'row' | 'column' | null;
  panes: { primary: Rect; secondary: Rect } | null;
  /** Keep-clear distance on each side of a seamless fold line. */
  gutter: number;
};

/** A window this wide always gets two panes. */
export const TWO_PANE_MIN_WIDTH = 840;
/** A narrower window can still get two panes if it's also clearly landscape. */
export const TWO_PANE_MIN_WIDTH_WIDE = 600;
export const TWO_PANE_MIN_ASPECT = 1.2;
/** Short and wide, like the iPhone Duo cover: one column, tightened. */
export const COMPACT_SHORT_MIN_WIDTH = 430;
export const COMPACT_SHORT_MAX_HEIGHT = 720;
export const FOLD_GUTTER = 24;

function isTwoPane(win: { width: number; height: number }, hinge: Hinge | null): boolean {
  if (hinge && win.width >= TWO_PANE_MIN_WIDTH_WIDE) return true;
  if (win.width >= TWO_PANE_MIN_WIDTH) return true;
  return win.width >= TWO_PANE_MIN_WIDTH_WIDE && win.width / win.height >= TWO_PANE_MIN_ASPECT;
}

function splitPanes(
  win: { width: number; height: number },
  hinge: Hinge | null,
  axis: 'row' | 'column',
): { primary: Rect; secondary: Rect } {
  const length = axis === 'row' ? win.width : win.height;
  const hingeStart = hinge ? (axis === 'row' ? hinge.bounds.x : hinge.bounds.y) : length / 2;
  const hingeSize = hinge ? (axis === 'row' ? hinge.bounds.width : hinge.bounds.height) : 0;

  // A seamless fold has no pixels to lose, so only an occluding hinge is removed.
  const firstEnd = hinge?.occludes ? hingeStart : hingeStart + hingeSize / 2;
  const secondStart = hinge?.occludes ? hingeStart + hingeSize : firstEnd;

  if (axis === 'row') {
    return {
      primary: { x: 0, y: 0, width: firstEnd, height: win.height },
      secondary: { x: secondStart, y: 0, width: win.width - secondStart, height: win.height },
    };
  }
  return {
    primary: { x: 0, y: 0, width: win.width, height: firstEnd },
    secondary: { x: 0, y: secondStart, width: win.width, height: win.height - secondStart },
  };
}

export function computeFoldLayout(
  win: { width: number; height: number },
  hinge: Hinge | null = null,
): FoldLayout {
  if (isTwoPane(win, hinge)) {
    let axis: 'row' | 'column';
    if (hinge) axis = hinge.orientation === 'vertical' ? 'row' : 'column';
    else axis = win.width >= win.height ? 'row' : 'column';

    return {
      mode: 'two-pane',
      window: win,
      hinge,
      axis,
      panes: splitPanes(win, hinge, axis),
      gutter: hinge?.occludes ? 0 : FOLD_GUTTER,
    };
  }

  const short = win.width >= COMPACT_SHORT_MIN_WIDTH && win.height < COMPACT_SHORT_MAX_HEIGHT;
  return {
    mode: short ? 'compact-short' : 'compact',
    window: win,
    hinge,
    axis: null,
    panes: null,
    gutter: 0,
  };
}

/**
 * Home only. The Duo's inner screen turned upright (669×951) fails the two-pane
 * rule on aspect, so it reports 'compact', yet the fold runs across the middle of
 * the window. Home then puts the weather above the fold and the outfit below it.
 *
 * Separate from isTwoPane on purpose: Closet, Login, Onboarding, Auth and Settings
 * test mode === 'two-pane' without checking the axis, so changing that rule would
 * flip them too. iOS only: Android has no hinge data here yet, and a Galaxy Z
 * Fold's inner screen is this shape with its fold running the other way.
 */
export const STACKED_HOME_MIN_WIDTH = 600;
export const STACKED_HOME_MIN_HEIGHT = 840;

export type StackedHome = {
  /** Height of the weather half, ending short of the fold. */
  weatherHeight: number;
  /** Where the outfit half starts, past the fold. */
  outfitTop: number;
};

export function stackedHomeSplit(os: string, layout: FoldLayout): StackedHome | null {
  if (os !== 'ios' || layout.mode !== 'compact') return null;
  const { width, height } = layout.window;
  if (width < STACKED_HOME_MIN_WIDTH || height < STACKED_HOME_MIN_HEIGHT) return null;
  const keepClear = FOLD_GUTTER / 2;
  return {
    weatherHeight: Math.round(height / 2 - keepClear),
    outfitTop: Math.round(height / 2 + keepClear),
  };
}
