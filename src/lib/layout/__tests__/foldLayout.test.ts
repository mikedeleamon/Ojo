import { computeFoldLayout, FOLD_GUTTER, stackedHomeSplit, type Hinge } from '../foldLayout';

const verticalFold = (x: number, height: number, overrides: Partial<Hinge> = {}): Hinge => ({
  bounds: { x, y: 0, width: 0, height },
  orientation: 'vertical',
  occludes: false,
  posture: 'flat',
  ...overrides,
});

describe('computeFoldLayout', () => {
  describe('compact', () => {
    it.each([
      ['iPhone 17 Pro', 402, 874],
      ['iPhone 17 Pro Max', 440, 956],
      ['iPhone SE', 375, 667],
      ['Galaxy Z Fold cover', 374, 816],
    ])('%s stays a single column', (_name, width, height) => {
      const layout = computeFoldLayout({ width, height });
      expect(layout.mode).toBe('compact');
      expect(layout.panes).toBeNull();
      expect(layout.axis).toBeNull();
      expect(layout.gutter).toBe(0);
    });

    it('a window under 600 stays compact even with a hinge', () => {
      expect(computeFoldLayout({ width: 500, height: 800 }, verticalFold(250, 800)).mode).toBe('compact');
    });

    it('a narrow but tall window is not two-pane by aspect', () => {
      expect(computeFoldLayout({ width: 650, height: 900 }).mode).toBe('compact');
    });
  });

  describe('compact-short', () => {
    it('iPhone Duo cover', () => {
      const layout = computeFoldLayout({ width: 466, height: 678 });
      expect(layout.mode).toBe('compact-short');
      expect(layout.panes).toBeNull();
    });

    it('needs both the width and the short height', () => {
      expect(computeFoldLayout({ width: 429, height: 678 }).mode).toBe('compact');
      expect(computeFoldLayout({ width: 466, height: 720 }).mode).toBe('compact');
    });
  });

  describe('two-pane', () => {
    it('iPhone Duo inner, no hinge reported: splits at the center with a gutter', () => {
      const layout = computeFoldLayout({ width: 951, height: 669 });
      expect(layout.mode).toBe('two-pane');
      expect(layout.axis).toBe('row');
      expect(layout.gutter).toBe(FOLD_GUTTER);
      expect(layout.panes?.primary).toEqual({ x: 0, y: 0, width: 475.5, height: 669 });
      expect(layout.panes?.secondary).toEqual({ x: 475.5, y: 0, width: 475.5, height: 669 });
    });

    it('a width of 840 is enough on its own, at any aspect', () => {
      expect(computeFoldLayout({ width: 840, height: 1000 }).mode).toBe('two-pane');
      expect(computeFoldLayout({ width: 839, height: 1000 }).mode).toBe('compact');
    });

    it('a wide window from 600 needs an aspect of at least 1.2', () => {
      expect(computeFoldLayout({ width: 600, height: 500 }).mode).toBe('two-pane');
      expect(computeFoldLayout({ width: 600, height: 501 }).mode).not.toBe('two-pane');
    });

    it('a window taller than wide stacks when no hinge says otherwise', () => {
      const layout = computeFoldLayout({ width: 900, height: 1200 });
      expect(layout.axis).toBe('column');
      expect(layout.panes?.primary).toEqual({ x: 0, y: 0, width: 900, height: 600 });
      expect(layout.panes?.secondary).toEqual({ x: 0, y: 600, width: 900, height: 600 });
    });

    it('Galaxy Z Fold inner, nearly square, splits along its reported vertical hinge', () => {
      const layout = computeFoldLayout({ width: 690, height: 750 }, verticalFold(345, 750));
      expect(layout.mode).toBe('two-pane');
      expect(layout.axis).toBe('row');
      expect(layout.panes?.primary.width).toBe(345);
      expect(layout.panes?.secondary.x).toBe(345);
      expect(layout.panes?.secondary.width).toBe(345);
    });

    it('a horizontal hinge stacks the panes', () => {
      const layout = computeFoldLayout(
        { width: 700, height: 800 },
        { bounds: { x: 0, y: 400, width: 700, height: 0 }, orientation: 'horizontal', occludes: false, posture: 'flat' },
      );
      expect(layout.axis).toBe('column');
      expect(layout.panes?.primary).toEqual({ x: 0, y: 0, width: 700, height: 400 });
      expect(layout.panes?.secondary).toEqual({ x: 0, y: 400, width: 700, height: 400 });
    });

    it('removes an occluding hinge from both panes and drops the gutter', () => {
      const layout = computeFoldLayout(
        { width: 1000, height: 700 },
        verticalFold(490, 700, { bounds: { x: 490, y: 0, width: 20, height: 700 }, occludes: true }),
      );
      expect(layout.panes?.primary.width).toBe(490);
      expect(layout.panes?.secondary.x).toBe(510);
      expect(layout.panes?.secondary.width).toBe(490);
      expect(layout.gutter).toBe(0);
    });

    it('treats a half-opened posture like flat', () => {
      const flat = computeFoldLayout({ width: 900, height: 700 }, verticalFold(450, 700));
      const half = computeFoldLayout({ width: 900, height: 700 }, verticalFold(450, 700, { posture: 'half-opened' }));
      expect(half.mode).toBe(flat.mode);
      expect(half.panes).toEqual(flat.panes);
    });
  });
});

describe('stackedHomeSplit', () => {
  const split = (width: number, height: number, os = 'ios') =>
    stackedHomeSplit(os, computeFoldLayout({ width, height }));

  it('splits the iPhone Duo inner screen, turned upright, at the fold', () => {
    expect(split(669, 951)).toEqual({ weatherHeight: 464, outfitTop: 488 });
  });

  it.each([
    ['Duo inner screen, usual pose', 951, 669],
    ['Duo cover', 466, 678],
    ['iPhone 17 Pro Max', 440, 956],
    ['iPhone SE', 375, 667],
    ['wide enough but short', 669, 700],
  ])('leaves %s alone', (_name, width, height) => {
    expect(split(width, height)).toBeNull();
  });

  it('stays off Android, where the fold can run the other way', () => {
    expect(split(669, 951, 'android')).toBeNull();
  });
});
