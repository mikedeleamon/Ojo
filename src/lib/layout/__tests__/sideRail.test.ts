import { hasSideRail } from '../sideRail';

describe('hasSideRail', () => {
  it.each([
    ['iPhone Duo inner display', 'ios', 84, true],
    ['iPhone Duo cover display', 'ios', 84, true],
    ['regular iPhone, portrait', 'ios', 0, false],
    ['Android with a right inset', 'android', 48, false],
  ])('%s', (_label, os, right, expected) => {
    expect(hasSideRail(os, { right })).toBe(expected);
  });
});
