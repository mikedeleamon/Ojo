import { buildBriefContent, buildBriefTitle, buildBriefBody } from '../morningBrief';
import type { DailyForecast, Settings, ClothingArticle } from '../../types';
import type { OutfitResult, OutfitSlot, OutfitRole } from '../outfit/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const settings = (over: Partial<Settings> = {}): Settings => ({
  clothingStyles: ['Casual'],
  location: 'Brooklyn, NY',
  temperatureScale: 'Imperial',
  hiTempThreshold: 75,
  lowTempThreshold: 55,
  humidityPreference: 50,
  ...over,
});

const day = (over: Partial<DailyForecast> = {}): DailyForecast => ({
  date: '2026-08-16',
  minTempF: 54,
  maxTempF: 72,
  dayPhrase: 'Cloudy',
  hasPrecipitation: false,
  ...over,
});

const article = (name: string, clothingType: string): ClothingArticle => ({
  _id: name,
  name,
  clothingType,
});

const slot = (role: OutfitRole, name: string, type: string): OutfitSlot => ({
  role,
  article: article(name, type),
});

const outfit = (over: Partial<OutfitResult> = {}): OutfitResult => ({
  status: 'ok',
  headline: 'A bit cool — layer up.',
  slots: [slot('top', 'White Oxford', 'Shirt'), slot('bottom', 'Dark Jeans', 'Jeans')],
  notes: [],
  score: 80,
  scoreBreakdown: { fabric: 1, color: 1, style: 1, simplicity: 1, preference: 1 },
  ...over,
});

const swingOn = { enabled: true, thresholdF: 15 };
const swingOff = { enabled: false, thresholdF: 15 };

// ─── Title ────────────────────────────────────────────────────────────────────

describe('buildBriefTitle', () => {
  it('leads with condition, place and the day range', () => {
    expect(
      buildBriefTitle({ day: day(), outfit: null, city: 'Brooklyn, NY', settings: settings(), swing: swingOff }),
    ).toBe('Cloudy in Brooklyn · 54°–72°');
  });

  it('drops the state from the city, matching the old server copy', () => {
    const title = buildBriefTitle({
      day: day(), outfit: null, city: 'San Francisco, CA', settings: settings(), swing: swingOff,
    });
    expect(title).toContain('San Francisco');
    expect(title).not.toContain('CA');
  });

  it('omits the place when there is no city', () => {
    expect(
      buildBriefTitle({ day: day(), outfit: null, settings: settings(), swing: swingOff }),
    ).toBe('Cloudy · 54°–72°');
  });

  it('converts to celsius', () => {
    expect(
      buildBriefTitle({
        day: day(), outfit: null, city: 'Brooklyn', settings: settings({ temperatureScale: 'Metric' }), swing: swingOff,
      }),
    ).toBe('Cloudy in Brooklyn · 12°–22°');
  });

  it('collapses a flat day to a single temperature', () => {
    expect(
      buildBriefTitle({
        day: day({ minTempF: 60, maxTempF: 60 }), outfit: null, settings: settings(), swing: swingOff,
      }),
    ).toBe('Cloudy · 60°');
  });

  it('never labels a weekday — every brief fires on the morning it describes', () => {
    const title = buildBriefTitle({
      day: day({ date: '2026-08-20' }), outfit: null, city: 'Brooklyn', settings: settings(), swing: swingOff,
    });
    expect(title).not.toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
  });
});

// ─── Body ─────────────────────────────────────────────────────────────────────

describe('buildBriefBody — with an outfit', () => {
  it('prefers the engine layering sentence, which already names garments', () => {
    const body = buildBriefBody({
      day: day(),
      outfit: outfit({
        layering: {
          layers: { base: null, mid: null, outer: null },
          recommendation: 'Start with your Grey Fleece over the White Oxford.',
          confidence: 0.8,
          missingMid: false,
          missingOuter: false,
          needsMid: false,
          needsOuter: false,
        },
      }),
      settings: settings(),
      swing: swingOff,
    });
    expect(body).toBe('Start with your Grey Fleece over the White Oxford.');
  });

  it('falls back to naming garments when there is no layering sentence', () => {
    const body = buildBriefBody({
      day: day(), outfit: outfit(), settings: settings(), swing: swingOff,
    });
    expect(body).toBe('White Oxford over your dark jeans.');
  });

  it('leads with the outermost layer', () => {
    const body = buildBriefBody({
      day: day(),
      outfit: outfit({
        slots: [
          slot('top', 'White Oxford', 'Shirt'),
          slot('outerwear', 'Navy Peacoat', 'Coat'),
          slot('bottom', 'Dark Jeans', 'Jeans'),
        ],
      }),
      settings: settings(),
      swing: swingOff,
    });
    expect(body).toBe('Navy Peacoat over your white oxford.');
  });

  it('handles a single-garment outfit without dangling grammar', () => {
    const body = buildBriefBody({
      day: day(),
      outfit: outfit({ slots: [slot('fullBody', 'Linen Dress', 'Dress')] }),
      settings: settings(),
      swing: swingOff,
    });
    expect(body).toBe('Linen Dress today.');
  });
});

describe('buildBriefBody — swing suffix', () => {
  it('appends when the spread clears the threshold', () => {
    const body = buildBriefBody({
      day: day({ minTempF: 50, maxTempF: 80 }), outfit: outfit(), settings: settings(), swing: swingOn,
    });
    expect(body).toContain('30°F swing — wear layers you can shed.');
  });

  it('stays quiet under the threshold', () => {
    const body = buildBriefBody({
      day: day({ minTempF: 60, maxTempF: 70 }), outfit: outfit(), settings: settings(), swing: swingOn,
    });
    expect(body).not.toContain('swing');
  });

  it('stays quiet when the setting is off', () => {
    const body = buildBriefBody({
      day: day({ minTempF: 50, maxTempF: 80 }), outfit: outfit(), settings: settings(), swing: swingOff,
    });
    expect(body).not.toContain('swing');
  });

  it('stays quiet when the whole day is hot, even with a wide raw spread', () => {
    // 83°-106° is a 23°F swing (clears the 15°F threshold) but never dips
    // below the user's own hiTempThreshold (75°) — there's no layer to shed.
    const body = buildBriefBody({
      day: day({ minTempF: 83, maxTempF: 106 }), outfit: outfit(), settings: settings(), swing: swingOn,
    });
    expect(body).not.toContain('swing');
  });

  it('stays quiet when the whole day stays cold', () => {
    // Never climbs into "warm" or "hot", so there's nothing to shed later.
    const body = buildBriefBody({
      day: day({ minTempF: 10, maxTempF: 40 }), outfit: outfit(), settings: settings(), swing: swingOn,
    });
    expect(body).not.toContain('swing');
  });

  it('converts the spread as a delta, not as a temperature', () => {
    // 30°F of spread is 17°C of spread. Running it through the °F→°C formula
    // would give -1, which is the bug this asserts against.
    const body = buildBriefBody({
      day: day({ minTempF: 50, maxTempF: 80 }),
      outfit: outfit(),
      settings: settings({ temperatureScale: 'Metric' }),
      swing: swingOn,
    });
    expect(body).toContain('17°C swing');
  });

  it('defers to the engine when a timeline already said it', () => {
    const body = buildBriefBody({
      day: day({ minTempF: 50, maxTempF: 80 }),
      outfit: outfit({
        layering: {
          layers: { base: null, mid: null, outer: null },
          recommendation: 'Wear the fleece — you can drop it as the day warms up.',
          timeline: [{ time: 'Late morning', action: 'Remove Grey Fleece — warming up' }],
          confidence: 0.8,
          missingMid: false,
          missingOuter: false,
          needsMid: false,
          needsOuter: false,
        },
      }),
      settings: settings(),
      swing: swingOn,
    });
    expect(body).not.toContain('swing');
  });

  it('drops the suffix rather than overrunning the lock screen', () => {
    const long = 'A'.repeat(140);
    const body = buildBriefBody({
      day: day({ minTempF: 50, maxTempF: 80 }),
      outfit: outfit({
        layering: {
          layers: { base: null, mid: null, outer: null },
          recommendation: long,
          confidence: 0.8,
          missingMid: false,
          missingOuter: false,
          needsMid: false,
          needsOuter: false,
        },
      }),
      settings: settings(),
      swing: swingOn,
    });
    expect(body).toBe(long);
  });
});

describe('buildBriefBody — no wearable outfit', () => {
  const noOutfit = (over: Partial<DailyForecast> = {}) =>
    buildBriefBody({ day: day(over), outfit: null, settings: settings(), swing: swingOff });

  it('never claims an outfit and never tells the user to go look for one', () => {
    const body = noOutfit();
    expect(body).not.toMatch(/open ojo|in the app|check your/i);
  });

  it('covers every temperature — the 50-75F hole is what killed the first version', () => {
    // Walk the whole line in 1° steps; every one must produce real copy.
    for (let t = -20; t <= 120; t++) {
      const body = noOutfit({ minTempF: t, maxTempF: t + 10 });
      expect(body.length).toBeGreaterThan(0);
      expect(body).not.toMatch(/open ojo|in the app/i);
    }
  });

  it('leads with precipitation over temperature', () => {
    expect(noOutfit({ hasPrecipitation: true })).toMatch(/rain/i);
    expect(noOutfit({ dayPhrase: 'Snow', hasPrecipitation: true })).toMatch(/snow/i);
  });

  it('speaks to heat and to freezing', () => {
    expect(noOutfit({ minTempF: 78, maxTempF: 95 })).toMatch(/hot/i);
    expect(noOutfit({ minTempF: 10, maxTempF: 25 })).toMatch(/cold/i);
  });

  it('treats an outfit with no slots as no outfit', () => {
    const body = buildBriefBody({
      day: day(),
      outfit: outfit({ status: 'insufficient', headline: '', slots: [] }),
      settings: settings(),
      swing: swingOff,
    });
    expect(body).toBe('Mild all day — nothing dramatic needed.');
  });
});

describe('buildBriefContent', () => {
  it('returns both halves', () => {
    const content = buildBriefContent({
      day: day(), outfit: outfit(), city: 'Brooklyn, NY', settings: settings(), swing: swingOn,
    });
    expect(content).toEqual({
      title: 'Cloudy in Brooklyn · 54°–72°',
      body: 'White Oxford over your dark jeans. 18°F swing — wear layers you can shed.',
    });
  });
});
