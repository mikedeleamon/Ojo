import {
    humanizeCondition,
    humanizeConditionTitle,
    humanizeConditionShort,
} from '../humanizeCondition';

describe('humanizeCondition', () => {
    it('handles all documented WeatherKit conditionCodes', () => {
        // Spot-check the full list — these are the codes Apple documents as of
        // late 2025. If Apple adds new ones the generic fallback covers them.
        const cases: Array<[string, string]> = [
            ['Clear',                  'Clear'],
            ['MostlyClear',            'Mostly clear'],
            ['PartlyCloudy',           'Partly cloudy'],
            ['MostlyCloudy',           'Mostly cloudy'],
            ['Cloudy',                 'Cloudy'],
            ['Foggy',                  'Foggy'],
            ['Haze',                   'Hazy'],
            ['Smoky',                  'Smoky'],
            ['Breezy',                 'Breezy'],
            ['Windy',                  'Windy'],
            ['Drizzle',                'Drizzle'],
            ['Rain',                   'Rain'],
            ['HeavyRain',              'Heavy rain'],
            ['SunShowers',             'Sun showers'],
            ['ScatteredShowers',       'Scattered showers'],
            ['IsolatedThunderstorms',  'Isolated thunderstorms'],
            ['ScatteredThunderstorms', 'Scattered thunderstorms'],
            ['Thunderstorms',          'Thunderstorms'],
            ['StrongStorms',           'Strong storms'],
            ['Frigid',                 'Frigid'],
            ['Hot',                    'Hot'],
            ['Flurries',               'Flurries'],
            ['Snow',                   'Snow'],
            ['HeavySnow',              'Heavy snow'],
            ['SunFlurries',            'Sun flurries'],
            ['Sleet',                  'Sleet'],
            ['WintryMix',              'Wintry mix'],
            ['Blizzard',               'Blizzard'],
            ['BlowingSnow',            'Blowing snow'],
            ['FreezingDrizzle',        'Freezing drizzle'],
            ['FreezingRain',           'Freezing rain'],
            ['Hail',                   'Hail'],
            ['Hurricane',              'Hurricane'],
            ['TropicalStorm',          'Tropical storm'],
            ['BlowingDust',            'Blowing dust'],
        ];
        for (const [code, expected] of cases) {
            expect(humanizeCondition(code)).toBe(expected);
        }
    });

    it('falls back to camelCase split for unknown codes', () => {
        // Hypothetical future WeatherKit additions
        expect(humanizeCondition('MostlyClearAndWindy')).toBe('Mostly clear and windy');
        expect(humanizeCondition('VeryLightDrizzle')).toBe('Very light drizzle');
    });

    it('handles all-caps runs in unknown codes', () => {
        expect(humanizeCondition('ABCThing')).toBe('Abc thing');
    });

    it('returns empty string for null / undefined / empty', () => {
        expect(humanizeCondition(null)).toBe('');
        expect(humanizeCondition(undefined)).toBe('');
        expect(humanizeCondition('')).toBe('');
    });
});

describe('humanizeConditionTitle', () => {
    it('produces title case for known codes', () => {
        expect(humanizeConditionTitle('MostlyClear')).toBe('Mostly Clear');
        expect(humanizeConditionTitle('PartlyCloudy')).toBe('Partly Cloudy');
        expect(humanizeConditionTitle('HeavyRain')).toBe('Heavy Rain');
        expect(humanizeConditionTitle('BlowingSnow')).toBe('Blowing Snow');
        expect(humanizeConditionTitle('FreezingDrizzle')).toBe('Freezing Drizzle');
        expect(humanizeConditionTitle('ScatteredThunderstorms')).toBe('Scattered Thunderstorms');
    });

    it('title-cases unknown codes via camelCase split', () => {
        expect(humanizeConditionTitle('MostlyClearAndWindy')).toBe('Mostly Clear And Windy');
    });

    it('returns empty string for falsy input', () => {
        expect(humanizeConditionTitle(null)).toBe('');
        expect(humanizeConditionTitle('')).toBe('');
    });
});

describe('humanizeConditionShort', () => {
    it('collapses related codes to one-word chips', () => {
        // Clear / cloudy
        expect(humanizeConditionShort('Clear')).toBe('Clear');
        expect(humanizeConditionShort('MostlyClear')).toBe('Clear');
        expect(humanizeConditionShort('PartlyCloudy')).toBe('Cloudy');
        expect(humanizeConditionShort('MostlyCloudy')).toBe('Cloudy');

        // Rain family
        expect(humanizeConditionShort('Rain')).toBe('Rain');
        expect(humanizeConditionShort('HeavyRain')).toBe('Rain');
        expect(humanizeConditionShort('SunShowers')).toBe('Rain');

        // Storm family
        expect(humanizeConditionShort('Thunderstorms')).toBe('Storms');
        expect(humanizeConditionShort('IsolatedThunderstorms')).toBe('Storms');
        expect(humanizeConditionShort('StrongStorms')).toBe('Storms');

        // Snow family
        expect(humanizeConditionShort('Snow')).toBe('Snow');
        expect(humanizeConditionShort('Flurries')).toBe('Snow');
        expect(humanizeConditionShort('BlowingSnow')).toBe('Snow');

        // Ice
        expect(humanizeConditionShort('FreezingDrizzle')).toBe('Ice');
        expect(humanizeConditionShort('FreezingRain')).toBe('Ice');
    });

    it('falls back to last word, sentence-cased, for unknown codes', () => {
        expect(humanizeConditionShort('SomeKindOfStorm')).toBe('Storm');
        expect(humanizeConditionShort('VeryLightDrizzle')).toBe('Drizzle');
    });

    it('returns empty string for falsy input', () => {
        expect(humanizeConditionShort(undefined)).toBe('');
        expect(humanizeConditionShort('')).toBe('');
    });
});
