import { selectNudgeworthySteps, buildNudgeContent } from '../sameDayNudge';
import type { WidgetTimelineStep } from '../widget/snapshot.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const step = (over: Partial<WidgetTimelineStep> = {}): WidgetTimelineStep => ({
  time: 'Afternoon',
  action: 'Remove Grey Fleece — warming up',
  hour: 15,
  ...over,
});

const at = (hour: number, minute = 0) => new Date(2026, 7, 16, hour, minute, 0);

// ─── selectNudgeworthySteps ─────────────────────────────────────────────────────

describe('selectNudgeworthySteps', () => {
  it('excludes a "Keep your … on" reassurance step', () => {
    const timeline = [step({ action: 'Keep your Grey Fleece on', hour: 8 })];
    expect(selectNudgeworthySteps(timeline, at(6))).toEqual([]);
  });

  it('excludes a step under the 90-minute lead floor', () => {
    // 2:15pm now, step fires 3pm — 45 minutes away.
    const timeline = [step({ hour: 15 })];
    expect(selectNudgeworthySteps(timeline, at(14, 15))).toEqual([]);
  });

  it('excludes a step whose hour already passed today', () => {
    const timeline = [step({ hour: 8 })];
    expect(selectNudgeworthySteps(timeline, at(14))).toEqual([]);
  });

  it('includes each change-prefix template past the lead floor', () => {
    const templates = [
      'Remove Grey Fleece — warming up',
      'Add Grey Fleece back — sun is setting, cooling down',
      'Rain starts — keep Navy Peacoat on',
      'Rain clears — safe to shed layers',
    ];
    for (const action of templates) {
      const timeline = [step({ action, hour: 15 })]; // 6h out from 9am
      const result = selectNudgeworthySteps(timeline, at(9));
      expect(result).toHaveLength(1);
      expect(result[0].step.action).toBe(action);
    }
  });

  it('caps at NUDGE_MAX_PER_DAY, keeping the earliest hours', () => {
    const timeline = [
      step({ action: 'Rain clears — safe to shed layers', hour: 20 }),
      step({ action: 'Remove Grey Fleece — warming up', hour: 12 }),
      step({ action: 'Rain starts — keep Navy Peacoat on', hour: 16 }),
    ];
    const result = selectNudgeworthySteps(timeline, at(6));
    expect(result.map(c => c.step.hour)).toEqual([12, 16]);
  });

  it('returns an empty array for an undefined or empty timeline', () => {
    expect(selectNudgeworthySteps(undefined, at(9))).toEqual([]);
    expect(selectNudgeworthySteps([], at(9))).toEqual([]);
  });

  it('computes fireAt on the same calendar day as now, at the step hour', () => {
    const timeline = [step({ hour: 15 })];
    const [{ fireAt }] = selectNudgeworthySteps(timeline, at(6));
    expect(fireAt.getFullYear()).toBe(2026);
    expect(fireAt.getMonth()).toBe(7);
    expect(fireAt.getDate()).toBe(16);
    expect(fireAt.getHours()).toBe(15);
  });
});

// ─── buildNudgeContent ───────────────────────────────────────────────────────────

describe('buildNudgeContent', () => {
  it('builds a clock-time title with the city', () => {
    const content = buildNudgeContent({ step: step({ hour: 15 }), city: 'Brooklyn, NY' });
    expect(content.title).toBe('3PM in Brooklyn');
  });

  it('falls back gracefully without a city', () => {
    const content = buildNudgeContent({ step: step({ hour: 15 }) });
    expect(content.title).toBe('3PM weather update');
  });

  it('formats midnight and noon correctly', () => {
    expect(buildNudgeContent({ step: step({ hour: 0 }) }).title).toBe('12AM weather update');
    expect(buildNudgeContent({ step: step({ hour: 12 }) }).title).toBe('12PM weather update');
  });

  it('reuses the action text verbatim, adding punctuation if missing', () => {
    const content = buildNudgeContent({ step: step({ action: 'Remove Grey Fleece — warming up' }) });
    expect(content.body).toBe('Remove Grey Fleece — warming up.');
  });

  it('does not double up punctuation already present', () => {
    const content = buildNudgeContent({ step: step({ action: 'Rain starts — keep it on!' }) });
    expect(content.body).toBe('Rain starts — keep it on!');
  });
});
