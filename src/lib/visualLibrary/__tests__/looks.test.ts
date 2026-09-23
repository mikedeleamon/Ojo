import { classifyCondition } from '../../weather/conditions';
import { gradientFor } from '../../weather/conditions';
import { backdropLayersFor } from '../../weather/backdropLayers';
import { ALL_LOOKS, FIXED_LOOK_KINDS, REQUIRED_LOOP_KEYS, lookFor, recipeFor } from '../looks';

describe('backdrop looks', () => {
    it('has 23 distinct looks: 9 fixed, 2 partly cloudy, 12 sky stages', () => {
        expect(ALL_LOOKS).toHaveLength(23);
        expect(new Set(ALL_LOOKS).size).toBe(23);
        expect(ALL_LOOKS.filter((l) => l.startsWith('sky.'))).toHaveLength(12);
    });

    it('wants a loop per look plus the recap', () => {
        expect(REQUIRED_LOOP_KEYS).toEqual([...ALL_LOOKS, 'recap']);
    });

    // The recipe is how the loop renderer reproduces a look; if it fed a
    // different look back through lookFor, the story would show the wrong sky.
    it('round-trips every look through its recipe', () => {
        for (const look of ALL_LOOKS) {
            const r = recipeFor(look);
            expect(lookFor({ condition: r.condition, isDayTime: r.isDayTime, sun: r.sun })).toBe(look);
        }
    });

    it('uses condition text the classifier reads as the right kind', () => {
        for (const kind of FIXED_LOOK_KINDS) {
            expect(classifyCondition(recipeFor(kind).condition)).toBe(kind);
        }
    });

    it('gives every look a distinct gradient or particle layer', () => {
        const fingerprints = ALL_LOOKS.map((look) => {
            const r = recipeFor(look);
            const gradient = gradientFor(r.condition, r.isDayTime, r.sun?.elevationDeg, r.sun?.isRising);
            return JSON.stringify([gradient, backdropLayersFor(r.condition, r.isDayTime)]);
        });
        expect(new Set(fingerprints).size).toBe(ALL_LOOKS.length);
    });

    it('turns stars on for sky stages once the sun is down', () => {
        const starry = ALL_LOOKS.filter((look) => {
            const r = recipeFor(look);
            return backdropLayersFor(r.condition, r.isDayTime).stars;
        });
        expect([...starry].sort()).toEqual([
            'sky.afterglow', 'sky.blueHour', 'sky.clearNight', 'sky.dawn',
            'sky.dawnAfterglow', 'sky.dawnBlue', 'sky.sunset',
        ]);
    });
});

describe('lookFor', () => {
    it('reads precipitation and cloud straight from the condition', () => {
        expect(lookFor({ condition: 'Light snow', isDayTime: true })).toBe('snow');
        expect(lookFor({ condition: 'Freezing rain', isDayTime: false })).toBe('ice');
        expect(lookFor({ condition: 'Mostly cloudy', isDayTime: false })).toBe('cloudy');
        expect(lookFor({ condition: 'Drizzle', isDayTime: false })).toBe('drizzle');
    });

    it('switches partly cloudy on IsDayTime, as the app does', () => {
        expect(lookFor({ condition: 'Partly cloudy', isDayTime: true })).toBe('partlyCloudy.day');
        expect(lookFor({ condition: 'Partly cloudy', isDayTime: false })).toBe('partlyCloudy.night');
    });

    it('follows the sun for clear and sunny skies', () => {
        expect(lookFor({ condition: 'Sunny', isDayTime: true, sun: { elevationDeg: 50, isRising: true } }))
            .toBe('sky.clearDay');
        expect(lookFor({ condition: 'Clear', isDayTime: false, sun: { elevationDeg: -5, isRising: false } }))
            .toBe('sky.sunset');
        expect(lookFor({ condition: 'Clear', isDayTime: false, sun: { elevationDeg: -9, isRising: true } }))
            .toBe('sky.dawnBlue');
    });

    it('computes the sun from coordinates when not given one', () => {
        const newYork = { lat: 40.7128, lon: -74.006 };
        // 2026-06-21 16:00 UTC is noon in New York; 04:00 UTC is midnight.
        expect(lookFor({ condition: 'Clear', isDayTime: true, coords: newYork, at: new Date('2026-06-21T16:00:00Z') }))
            .toBe('sky.clearDay');
        expect(lookFor({ condition: 'Clear', isDayTime: false, coords: newYork, at: new Date('2026-06-21T04:00:00Z') }))
            .toBe('sky.clearNight');
    });

    it('falls back to IsDayTime for clear skies without a sun or coordinates', () => {
        expect(lookFor({ condition: 'Clear', isDayTime: true })).toBe('sky.clearDay');
        expect(lookFor({ condition: 'Clear', isDayTime: false })).toBe('sky.clearNight');
    });
});
