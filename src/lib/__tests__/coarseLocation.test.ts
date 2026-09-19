import * as client from '../coarseLocation';
import * as server from '../../../server/src/lib/coarseLocation';

describe('coarsen', () => {
  it('rounds to two decimal places (~1 km)', () => {
    expect(client.coarsen(30.267153)).toBe(30.27);
    expect(client.coarsen(-97.743061)).toBe(-97.74);
    expect(client.coarsen(51.5)).toBe(51.5);
  });

  it('leaves an already-rounded value unchanged', () => {
    expect(client.coarsen(client.coarsen(40.712776))).toBe(40.71);
  });

  it('never moves a point more than half a unit in the last place', () => {
    for (const v of [0.004999, 12.345678, -33.868819, 179.999, -179.999]) {
      expect(Math.abs(client.coarsen(v) - v)).toBeLessThanOrEqual(0.005 + 1e-9);
    }
  });
});

describe('client and server round identically', () => {
  // Two copies, because the app bundle can't import from the server tree —
  // if they drift, the app sends one precision and the server stores another.
  it('share the same precision', () => {
    expect(server.COORD_DECIMALS).toBe(client.COORD_DECIMALS);
  });

  it('agree on every sample', () => {
    for (const v of [30.267153, -97.743061, 0.005, -0.005, 89.999, -45.55555]) {
      expect(server.coarsen(v)).toBe(client.coarsen(v));
    }
  });
});
