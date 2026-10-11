/**
 * Deleting the preferred closet must leave the cache with the same preferred
 * closet the server just promoted (DELETE /api/closets/:id), or Home falls back
 * to the "pick a preferred closet" picker until the next refetch.
 */
import { withoutCloset } from '../preferredCloset';
import type { Closet } from '../../types';

const closet = (id: string, createdAt: string | undefined, isPreferred = false): Closet => ({
  _id: id, name: id, userId: 'u', articles: [], isPreferred, createdAt,
});

describe('withoutCloset', () => {
  it('promotes the oldest remaining closet when the preferred one is deleted', () => {
    // Cache order is newest-first after a local create, so position can't decide.
    const list = [
      closet('newest', '2026-10-03T00:00:00.000Z'),
      closet('starred', '2026-10-02T00:00:00.000Z', true),
      closet('oldest', '2026-10-01T00:00:00.000Z'),
    ];
    const next = withoutCloset(list, 'starred');
    expect(next.map((c) => c._id)).toEqual(['newest', 'oldest']);
    expect(next.find((c) => c.isPreferred)?._id).toBe('oldest');
  });

  it('leaves the star alone when a non-preferred closet is deleted', () => {
    const list = [closet('a', '2026-10-01T00:00:00.000Z', true), closet('b', '2026-10-02T00:00:00.000Z')];
    expect(withoutCloset(list, 'b')).toEqual([list[0]]);
  });

  it('returns an empty list when the last closet is deleted', () => {
    expect(withoutCloset([closet('only', '2026-10-01T00:00:00.000Z', true)], 'only')).toEqual([]);
  });

  it('treats a missing createdAt as oldest, like the server sort', () => {
    const list = [
      closet('dated', '2026-10-01T00:00:00.000Z'),
      closet('starred', '2026-10-02T00:00:00.000Z', true),
      closet('legacy', undefined),
    ];
    expect(withoutCloset(list, 'starred').find((c) => c.isPreferred)?._id).toBe('legacy');
  });

  it('does not mutate the input', () => {
    const list = [closet('starred', '2026-10-02T00:00:00.000Z', true), closet('other', '2026-10-01T00:00:00.000Z')];
    withoutCloset(list, 'starred');
    expect(list[1].isPreferred).toBe(false);
  });
});
