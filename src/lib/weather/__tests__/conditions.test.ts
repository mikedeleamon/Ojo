import {
    classifyCondition,
    iconTypeFor,
    gradientFor,
    footerBgFor,
    isClearNight,
    isThunderstorm,
} from '../conditions';
import { weatherGradients } from '../../../theme/tokens';

describe('classifyCondition', () => {
    it('maps common WeatherKit condition codes to kinds', () => {
        expect(classifyCondition('Thunderstorms')).toBe('thunderstorm');
        expect(classifyCondition('Heavy Rain')).toBe('rain');
        expect(classifyCondition('Drizzle')).toBe('drizzle');
        expect(classifyCondition('BlowingSnow')).toBe('snow');
        expect(classifyCondition('Sleet')).toBe('ice');
        expect(classifyCondition('Freezing Rain')).toBe('ice');
        expect(classifyCondition('MostlyClear')).toBe('clear');
        expect(classifyCondition('Sunny')).toBe('sunny');
        expect(classifyCondition('PartlyCloudy')).toBe('partlyCloudy');
        expect(classifyCondition('Cloudy')).toBe('cloudy');
        expect(classifyCondition('Foggy')).toBe('fog');
        expect(classifyCondition('Haze')).toBe('haze');
    });

    it('falls back to clear for unknown input', () => {
        expect(classifyCondition('Gravitational Anomaly')).toBe('clear');
    });
});

describe('icon / gradient / footer stay consistent with the kind', () => {
    it('resolves clear by day vs night', () => {
        expect(iconTypeFor('Clear', true)).toBe('sunny');
        expect(iconTypeFor('Clear', false)).toBe('clear-night');
        expect(gradientFor('Clear', true)).toBe(weatherGradients.clearDay);
        expect(gradientFor('Clear', false)).toBe(weatherGradients.clearNight);
    });

    it('renders partly-cloudy night against the clear-night gradient', () => {
        expect(iconTypeFor('PartlyCloudy', false)).toBe('partly-cloudy-night');
        expect(gradientFor('PartlyCloudy', false)).toBe(weatherGradients.clearNight);
    });

    it('uses the snow icon but ice gradient for sleet', () => {
        expect(iconTypeFor('Sleet', true)).toBe('snow');
        expect(gradientFor('Sleet', true)).toBe(weatherGradients.ice);
    });

    it('returns a footer tint for every kind', () => {
        for (const c of ['Sunny', 'Cloudy', 'Rain', 'Snow', 'Thunderstorms']) {
            expect(footerBgFor(c, true)).toMatch(/^rgba\(/);
        }
    });
});

describe('background flags', () => {
    it('flags clear nights only at night', () => {
        expect(isClearNight('Clear', false)).toBe(true);
        expect(isClearNight('Clear', true)).toBe(false);
        expect(isClearNight('Rain', false)).toBe(false);
    });

    it('flags thunderstorms', () => {
        expect(isThunderstorm('Thunderstorms')).toBe(true);
        expect(isThunderstorm('Scattered Thunderstorms')).toBe(true);
        expect(isThunderstorm('Cloudy')).toBe(false);
    });
});
