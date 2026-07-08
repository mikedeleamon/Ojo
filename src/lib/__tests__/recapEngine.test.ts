import {
  buildWeeklyRecap,
  isoWeekKey,
  RecapCard,
  RecapInput,
} from '../recapEngine';
import type { Closet, ClothingArticle, OutfitHistoryEntry, SavedTripFitPlan } from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Fixed "now": a Tuesday, mid-day local time to dodge date-boundary flake.
const NOW = new Date('2026-07-07T12:00:00');

const article = (over: Partial<ClothingArticle> & { _id: string }): ClothingArticle => ({
  clothingType: 'T-Shirt',
  color: 'Navy',
  ...over,
});

const closet = (articles: ClothingArticle[], over: Partial<Closet> = {}): Closet => ({
  _id: 'c1',
  name: 'Main',
  userId: 'u1',
  articles,
  isPreferred: true,
  ...over,
});

let entrySeq = 0;
/** History entry worn `daysAgo` days before NOW (hour offset dodges midnight). */
const entry = (daysAgo: number, articleIds: string[]): OutfitHistoryEntry => ({
  id: `e${entrySeq++}`,
  wornAt: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  closetId: 'c1',
  closetName: 'Main',
  articleIds,
  articleSummary: articleIds.join(', '),
});

const trip = (over: Partial<SavedTripFitPlan> = {}): SavedTripFitPlan => ({
  id: 'trip1',
  destination: 'Lisbon',
  lat: 38.72,
  lon: -9.14,
  startDate: '2026-07-03',
  endDate: '2026-07-06',
  occasion: 'everyday',
  closetId: 'c1',
  days: [],
  checkedIds: [],
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const recap = (over: Partial<RecapInput>): RecapCard[] =>
  buildWeeklyRecap({ closets: [], history: [], now: NOW, seed: 'u1', ...over });

const ids = (cards: RecapCard[]): string[] => cards.map(c => c.templateId);

beforeEach(() => { entrySeq = 0; });

// ─── Empty & opener ───────────────────────────────────────────────────────────

describe('openers', () => {
  it('returns a single empty_week card when nothing was logged this week', () => {
    const a = article({ _id: 'a1' });
    const cards = recap({
      closets: [closet([a])],
      history: [entry(30, ['a1'])],  // old wear only
    });
    expect(ids(cards)).toEqual(['empty_week']);
    expect(cards[0].section).toBe('opener');
  });

  it('uses hero_week at 3+ outfits and hero_light below', () => {
    const a = article({ _id: 'a1' });
    const closets = [closet([a])];

    const busy = recap({ closets, history: [entry(1, ['a1']), entry(2, ['a1']), entry(3, ['a1'])] });
    expect(busy[0].templateId).toBe('hero_week');

    const light = recap({ closets, history: [entry(1, ['a1'])] });
    expect(light[0].templateId).toBe('hero_light');
    // singular grammar, never "1 outfits"
    expect(light[0].body).not.toMatch(/1 outfits/);
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('renders identical cards for identical input + seed', () => {
    const a = article({ _id: 'a1', color: 'Rust' });
    const b = article({ _id: 'a2', color: 'Navy' });
    const input: Partial<RecapInput> = {
      closets: [closet([a, b])],
      history: [entry(1, ['a1', 'a2']), entry(2, ['a1', 'a2']), entry(3, ['a1', 'a2'])],
    };
    expect(recap(input)).toEqual(recap(input));
  });

  it('varies copy by seed but not template structure', () => {
    const a = article({ _id: 'a1' });
    const history = [entry(1, ['a1']), entry(2, ['a1']), entry(3, ['a1'])];
    const one = recap({ closets: [closet([a])], history, seed: 'user-one' });
    const two = recap({ closets: [closet([a])], history, seed: 'user-two' });
    expect(ids(one)).toEqual(ids(two));
  });
});

// ─── Color templates ──────────────────────────────────────────────────────────

describe('color templates', () => {
  it('color_story counts per-outfit presence, not per-article', () => {
    // Two navy articles in ONE outfit must count that outfit once.
    const n1 = article({ _id: 'n1', color: 'Navy' });
    const n2 = article({ _id: 'n2', color: 'Navy', clothingType: 'Jeans' });
    const w  = article({ _id: 'w1', color: 'White' });
    const cards = recap({
      closets: [closet([n1, n2, w])],
      history: [
        entry(1, ['n1', 'n2']),   // navy ×2 articles, ONE navy outfit
        entry(2, ['n1', 'w1']),
        entry(3, ['n2', 'w1']),
        entry(4, ['w1']),
      ],
    });
    const story = cards.find(c => c.templateId === 'color_story');
    expect(story).toBeDefined();
    // Navy present in 3 of 4 outfits — never "4 of 4" (the per-article count)
    expect(story!.headline + story!.body).toMatch(/Navy/);
    expect(story!.body).toMatch(/3 of your 4|personality trait/);
  });

  it('only one color-section card appears even when story + pair both fire', () => {
    const n = article({ _id: 'n1', color: 'Navy' });
    const r = article({ _id: 'r1', color: 'Rust', clothingType: 'Jeans' });
    const cards = recap({
      closets: [closet([n, r])],
      history: [entry(1, ['n1', 'r1']), entry(2, ['n1', 'r1']), entry(3, ['n1', 'r1'])],
    });
    const colorCards = cards.filter(c => c.section === 'color');
    expect(colorCards).toHaveLength(1);
  });
});

// ─── Item templates ───────────────────────────────────────────────────────────

describe('item templates', () => {
  it('woke_up fires for a 90+ day comeback and suppresses still_sleeping', () => {
    const hero    = article({ _id: 'hero', name: 'Denim Jacket' });
    const sleeper = article({ _id: 'zzz', name: 'Wool Coat' });
    const filler  = article({ _id: 'f1', color: 'White' });
    const cards = recap({
      closets: [closet([hero, sleeper, filler])],
      history: [
        entry(100, ['hero']),           // long ago
        entry(1, ['hero', 'f1']),       // comeback this week
        entry(2, ['f1']),
        entry(3, ['f1']),
        entry(200, ['zzz']),            // dormant 200d — would fire still_sleeping
      ],
    });
    const woke = cards.find(c => c.templateId === 'woke_up');
    expect(woke).toBeDefined();
    expect(woke!.headline + woke!.body).toMatch(/Denim Jacket|99 days|days off/);
    expect(ids(cards)).not.toContain('still_sleeping');
  });

  it('still_sleeping fires at 120+ dormant days when no comeback happened', () => {
    const sleeper = article({ _id: 'zzz', name: 'Wool Coat' });
    // Fillers get prior wears (no debut) and ≤2 week wears (no mvp), so no
    // higher-salience items card crowds still_sleeping out of its section.
    const f1 = article({ _id: 'f1' });
    const f2 = article({ _id: 'f2', clothingType: 'Jeans' });
    const cards = recap({
      closets: [closet([sleeper, f1, f2])],
      history: [
        entry(150, ['zzz']),
        entry(20, ['f1']), entry(25, ['f2']),
        entry(1, ['f1']), entry(2, ['f1']), entry(3, ['f2']),
      ],
    });
    const still = cards.find(c => c.templateId === 'still_sleeping');
    expect(still).toBeDefined();
    expect(still!.body).toMatch(/Wool Coat/);
  });

  it('debut fires only for a first-ever wear', () => {
    const fresh = article({ _id: 'new1', name: 'Linen Shirt' });
    const old   = article({ _id: 'old1' });
    const cards = recap({
      closets: [closet([fresh, old])],
      history: [
        entry(30, ['old1']),
        entry(1, ['new1']), entry(3, ['old1']), entry(4, ['old1']),
      ],
    });
    const debut = cards.find(c => c.templateId === 'debut');
    expect(debut).toBeDefined();
    expect(debut!.body).toMatch(/Linen Shirt/);
  });

  it('mvp_item needs 3 wears in the week', () => {
    const a = article({ _id: 'a1', name: 'Black Tee' });
    const b = article({ _id: 'b1', clothingType: 'Jeans' });
    const cards = recap({
      closets: [closet([a, b])],
      history: [entry(1, ['a1', 'b1']), entry(2, ['a1']), entry(3, ['a1'])],
    });
    const mvp = cards.find(c => c.templateId === 'mvp_item');
    expect(mvp).toBeDefined();
    expect(mvp!.headline + mvp!.body).toMatch(/Black Tee|3 (appearances|times)/);
  });
});

// ─── Habits & milestones ──────────────────────────────────────────────────────

describe('habits & milestones', () => {
  it('milestone at 30 carries the personalization copy', () => {
    const a = article({ _id: 'a1' });
    // 28 old entries (spaced 2 days apart — no accidental streak) + 3 this week
    const history = [
      ...Array.from({ length: 28 }, (_, i) => entry(10 + i * 2, ['a1'])),
      entry(1, ['a1']), entry(2, ['a1']), entry(3, ['a1']),
    ];
    const cards = recap({ closets: [closet([a])], history });
    const milestone = cards.find(c => c.templateId === 'milestone');
    expect(milestone).toBeDefined();
    expect(milestone!.body).toMatch(/Personalization unlocked/);
  });

  it('streak fires at 4 consecutive logged days', () => {
    const a = article({ _id: 'a1' });
    const cards = recap({
      closets: [closet([a])],
      history: [entry(0, ['a1']), entry(1, ['a1']), entry(2, ['a1']), entry(3, ['a1'])],
    });
    const streak = cards.find(c => c.templateId === 'streak');
    expect(streak).toBeDefined();
    // Copy varies by seeded pick; every variant names the count or the run
    expect(streak!.headline + streak!.body).toMatch(/4 days|every day since/);
  });

  it('cpw_win fires when cost-per-wear crosses a round threshold', () => {
    // $30 tee: 2 prior wears ($15) → 4 total ($7.50) crosses the $10 bar
    const a = article({ _id: 'a1', name: 'White Tee', purchasePrice: 30 });
    const b = article({ _id: 'b1', clothingType: 'Jeans' });
    const cards = recap({
      closets: [closet([a, b])],
      history: [
        entry(40, ['a1']), entry(50, ['a1']),
        entry(1, ['a1', 'b1']), entry(3, ['a1', 'b1']), entry(5, ['b1']),
      ],
    });
    const cpw = cards.find(c => c.templateId === 'cpw_win');
    expect(cpw).toBeDefined();
    expect(cpw!.body).toMatch(/\$7\.50/);
  });
});

// ─── Context, closer & composition rules ──────────────────────────────────────

describe('composition', () => {
  it('trip_week counts only outfits logged inside the trip dates', () => {
    const a = article({ _id: 'a1' });
    const cards = recap({
      closets: [closet([a])],
      history: [
        entry(1, ['a1']),   // 2026-07-06 — inside trip
        entry(4, ['a1']),   // 2026-07-03 — inside trip
        entry(6, ['a1']),   // 2026-07-01 — before trip
      ],
      plans: [trip()],
    });
    const tripCard = cards.find(c => c.templateId === 'trip_week');
    expect(tripCard).toBeDefined();
    expect(tripCard!.headline + tripCard!.body).toMatch(/Lisbon/);
    expect(tripCard!.body).toMatch(/2 outfits/);
  });

  it('places gap_nudge second-to-last with a shop CTA, share_cta last', () => {
    const a = article({ _id: 'a1' });
    const cards = recap({
      closets: [closet([a])],
      history: [entry(1, ['a1']), entry(2, ['a1']), entry(3, ['a1'])],
      gaps: [{ type: 'missing_coat', count: 5, message: '' }],
    });
    const last = cards[cards.length - 1];
    const secondLast = cards[cards.length - 2];
    expect(last.templateId).toBe('share_cta');
    expect(last.cta).toBe('share');
    expect(secondLast.templateId).toBe('gap_nudge');
    expect(secondLast.cta).toBe('shop');
    expect(secondLast.gapType).toBe('missing_coat');
    expect(secondLast.body).toMatch(/coat/i);
  });

  it('never exceeds 6 cards even when everything fires', () => {
    // Rich week: streak, mvp, color story+pair, debut, comeback, cpw, trip, gap
    const a = article({ _id: 'a1', name: 'Black Tee', color: 'Black', purchasePrice: 20 });
    const b = article({ _id: 'b1', color: 'Rust', clothingType: 'Jeans' });
    const fresh = article({ _id: 'new1', color: 'Black', clothingType: 'Sneakers' });
    const cards = recap({
      closets: [closet([a, b, fresh])],
      history: [
        entry(100, ['a1']),
        entry(0, ['a1', 'b1']), entry(1, ['a1', 'b1']), entry(2, ['a1', 'b1']),
        entry(3, ['a1', 'new1']),
      ],
      plans: [trip()],
      gaps: [{ type: 'missing_boots', count: 4, message: '' }],
    });
    expect(cards.length).toBeLessThanOrEqual(6);
    expect(cards[0].section).toBe('opener');
    expect(cards[cards.length - 1].templateId).toBe('share_cta');
  });

  it('suppresses a template shown within its cooldown window', () => {
    const a = article({ _id: 'a1', name: 'Black Tee' });
    const history = [entry(1, ['a1']), entry(2, ['a1']), entry(3, ['a1'])];
    const closets = [closet([a])];

    const fresh = recap({ closets, history });
    expect(ids(fresh)).toContain('mvp_item');

    const cooled = recap({
      closets, history,
      previouslyShown: [{ templateId: 'mvp_item', shownAt: entry(6, []).wornAt }],
    });
    expect(ids(cooled)).not.toContain('mvp_item');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe('isoWeekKey', () => {
  it('formats an ISO week key', () => {
    expect(isoWeekKey(new Date('2026-07-07T12:00:00'))).toMatch(/^2026-W\d{2}$/);
  });

  it('handles year boundaries per ISO-8601', () => {
    // Jan 1 2027 is a Friday → ISO week 53 of 2026
    expect(isoWeekKey(new Date('2027-01-01T12:00:00'))).toBe('2026-W53');
  });
});
