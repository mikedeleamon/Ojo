import {
  claimReconcile,
  releaseReconcile,
  resetLaunchReconcilers,
} from '../launchReconcile';

beforeEach(() => resetLaunchReconcilers());

describe('claimReconcile', () => {
  it('grants the first claim and refuses the rest', () => {
    expect(claimReconcile('tripPlans')).toBe(true);
    expect(claimReconcile('tripPlans')).toBe(false);
    expect(claimReconcile('tripPlans')).toBe(false);
  });

  it('tracks each task separately', () => {
    expect(claimReconcile('tripPlans')).toBe(true);
    expect(claimReconcile('weeklyRecap')).toBe(true);
    expect(claimReconcile('morningBrief')).toBe(true);
    expect(claimReconcile('sameDayNudge')).toBe(true);
  });
});

describe('releaseReconcile', () => {
  it('lets one task run again without re-arming the others', () => {
    claimReconcile('tripPlans');
    claimReconcile('weeklyRecap');

    releaseReconcile('tripPlans');

    expect(claimReconcile('tripPlans')).toBe(true);
    expect(claimReconcile('weeklyRecap')).toBe(false);
  });
});

describe('resetLaunchReconcilers', () => {
  // Sign-out cancels every scheduled local notification, so an account switch
  // that didn't re-arm these would leave the next account with none at all.
  it('re-arms every task for the next signed-in account', () => {
    claimReconcile('tripPlans');
    claimReconcile('weeklyRecap');
    claimReconcile('morningBrief');
    claimReconcile('sameDayNudge');

    resetLaunchReconcilers();

    expect(claimReconcile('tripPlans')).toBe(true);
    expect(claimReconcile('weeklyRecap')).toBe(true);
    expect(claimReconcile('morningBrief')).toBe(true);
    expect(claimReconcile('sameDayNudge')).toBe(true);
  });
});
