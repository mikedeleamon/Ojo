import { backdropLayersFor, NO_LAYERS } from '../backdropLayers';

describe('backdropLayersFor', () => {
    it('keeps the four layers the app already had', () => {
        expect(backdropLayersFor('Clear', false)).toEqual({ ...NO_LAYERS, stars: true });
        expect(backdropLayersFor('Thunderstorms', true)).toEqual({ ...NO_LAYERS, rain: 'storm', flash: true });
        expect(backdropLayersFor('Rain', true)).toEqual({ ...NO_LAYERS, rain: 'light' });
        expect(backdropLayersFor('Drizzle', false)).toEqual({ ...NO_LAYERS, rain: 'drizzle' });
    });

    it('adds snow, sleet and fog', () => {
        expect(backdropLayersFor('Light snow', true)).toEqual({ ...NO_LAYERS, flakes: 'snow' });
        expect(backdropLayersFor('Sleet', true)).toEqual({ ...NO_LAYERS, rain: 'sleet', flakes: 'pellets' });
        expect(backdropLayersFor('Freezing rain', false)).toEqual({ ...NO_LAYERS, rain: 'sleet', flakes: 'pellets' });
        expect(backdropLayersFor('Fog', true)).toEqual({ ...NO_LAYERS, fog: true });
        expect(backdropLayersFor('Mist', false)).toEqual({ ...NO_LAYERS, fog: true });
    });

    it('adds sun glare to clear and sunny days only', () => {
        for (const condition of ['Clear', 'Sunny', 'Mostly sunny', 'Hot']) {
            expect(backdropLayersFor(condition, true)).toEqual({ ...NO_LAYERS, glare: true });
        }
        expect(backdropLayersFor('Clear', false).glare).toBe(false);
        expect(backdropLayersFor('Hot', false)).toEqual(NO_LAYERS);
    });

    it('leaves the rest gradient-only', () => {
        for (const condition of ['Haze', 'Cloudy', 'Partly cloudy']) {
            expect(backdropLayersFor(condition, true)).toEqual(NO_LAYERS);
        }
    });
});
