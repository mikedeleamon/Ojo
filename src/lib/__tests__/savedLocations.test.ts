import { addLocation, removeLocation, newLocationId } from '../savedLocations';
import type { LocationCoords, SavedLocation } from '../../types';

const coords = (lat: number, lon: number, name = 'Test'): LocationCoords => ({
  lat,
  lon,
  name,
});

describe('addLocation', () => {
  it('appends a geocoded city with an id and timestamps', () => {
    const next = addLocation([], coords(51.5074, -0.1278, 'London'), 'London');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ name: 'London', query: 'London', lat: 51.5074, lon: -0.1278 });
    expect(next[0].id).toBeTruthy();
    expect(next[0].createdAt).toBeTruthy();
  });

  it('falls back to the typed query when the geocoder gives no name', () => {
    const next = addLocation([], coords(35.68, 139.69, ''), '  Tokyo  ');
    expect(next[0].name).toBe('Tokyo');
    expect(next[0].query).toBe('Tokyo');
  });

  it('de-dupes on rounded coordinates (returns the same array)', () => {
    const first = addLocation([], coords(40.7128, -74.006, 'NYC'), 'NYC');
    const again = addLocation(first, coords(40.71280001, -74.00600001, 'New York'), 'New York');
    expect(again).toBe(first);
    expect(again).toHaveLength(1);
  });
});

describe('removeLocation', () => {
  it('drops the matching id and leaves the rest', () => {
    const list = addLocation(
      addLocation([], coords(51.5, -0.1, 'London'), 'London'),
      coords(35.6, 139.6, 'Tokyo'),
      'Tokyo',
    );
    const target = list[0] as SavedLocation;
    const next = removeLocation(list, target.id);
    expect(next).toHaveLength(1);
    expect(next.find(l => l.id === target.id)).toBeUndefined();
  });
});

describe('newLocationId', () => {
  it('produces unique ids', () => {
    expect(newLocationId()).not.toBe(newLocationId());
  });
});
