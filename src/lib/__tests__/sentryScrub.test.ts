import { stripQuery, scrubBreadcrumb, scrubEvent } from '../sentryScrub';
import type { ScrubbableBreadcrumb, ScrubbableEvent } from '../sentryScrub';

describe('stripQuery', () => {
  it('removes coordinates from the real weather request shape', () => {
    expect(stripQuery('/api/weather/current?lat=40.7128&lon=-74.006'))
      .toBe('/api/weather/current');
  });

  it('handles the absolute form axios records against the API host', () => {
    expect(stripQuery('https://ojo-production-0f30.up.railway.app/api/weather/daily?lat=1&lon=2'))
      .toBe('https://ojo-production-0f30.up.railway.app/api/weather/daily');
  });

  it('leaves a clean URL untouched', () => {
    expect(stripQuery('/api/closets')).toBe('/api/closets');
  });

  it('strips fragments as well as query strings', () => {
    expect(stripQuery('/api/x#lat=1')).toBe('/api/x');
    expect(stripQuery('/api/x?a=1#lat=2')).toBe('/api/x');
  });

  it('survives the degenerate inputs', () => {
    expect(stripQuery('')).toBe('');
    expect(stripQuery('?lat=1')).toBe('');
    expect(stripQuery('/api/weather?')).toBe('/api/weather');
  });

  it('does not mistake an encoded question mark for a separator', () => {
    expect(stripQuery('/api/search/%3Fnot-a-query')).toBe('/api/search/%3Fnot-a-query');
  });
});

describe('scrubBreadcrumb', () => {
  it('scrubs the url and leaves sibling data intact', () => {
    const b = { data: { url: '/api/weather/current?lat=51.5&lon=-0.12', status_code: 500 } };
    expect(scrubBreadcrumb(b).data).toEqual({ url: '/api/weather/current', status_code: 500 });
  });

  it('returns the breadcrumb rather than dropping it (null would discard it)', () => {
    const b = { data: { url: '/api/x?lat=1' } };
    expect(scrubBreadcrumb(b)).toBe(b);
  });

  it('no-ops on breadcrumbs without a url', () => {
    expect(scrubBreadcrumb({ data: { message: 'tapped' } }).data).toEqual({ message: 'tapped' });
    expect(scrubBreadcrumb({} as ScrubbableBreadcrumb).data).toBeUndefined();
  });

  it('ignores a non-string url instead of throwing', () => {
    const b = { data: { url: 42 } };
    expect(scrubBreadcrumb(b).data.url).toBe(42);
  });
});

describe('scrubEvent', () => {
  it('scrubs request.url on the event itself', () => {
    const e = { request: { url: '/api/weather/hourly?lat=35.6&lon=139.6' } };
    expect(scrubEvent(e).request.url).toBe('/api/weather/hourly');
  });

  it('no-ops when there is no request context', () => {
    expect(scrubEvent({} as ScrubbableEvent).request).toBeUndefined();
    expect(scrubEvent({ request: {} }).request).toEqual({});
  });
});

describe('no coordinate survives either path', () => {
  const COORD = /lat=|lon=|-?\d+\.\d{3,}/;

  it('breadcrumb', () => {
    const out = scrubBreadcrumb({ data: { url: '/api/weather/current?lat=40.71280&lon=-74.00600' } });
    expect(COORD.test(String(out.data.url))).toBe(false);
  });

  it('event', () => {
    const out = scrubEvent({ request: { url: '/api/weather/daily?lat=-33.86880&lon=151.20930' } });
    expect(COORD.test(String(out.request.url))).toBe(false);
  });
});
