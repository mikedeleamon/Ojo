import type { Closet } from '../types';

/**
 * The closet list after deleting one, mirroring DELETE /api/closets/:id: when
 * the deleted closet was preferred, the oldest remaining closet (by createdAt)
 * becomes preferred. Applied to the local cache so Home never sees a list with
 * no preferred closet, which would show the "pick a preferred closet" picker
 * until the next refetch.
 *
 * A missing createdAt sorts first, as it does in Mongo's ascending sort.
 */
export const withoutCloset = (closets: Closet[], id: string): Closet[] => {
  const deleted = closets.find((c) => c._id === id);
  const rest = closets.filter((c) => c._id !== id);
  if (!deleted?.isPreferred || rest.length === 0 || rest.some((c) => c.isPreferred)) return rest;

  const oldest = rest.reduce((a, b) => ((b.createdAt ?? '') < (a.createdAt ?? '') ? b : a));
  return rest.map((c) => (c._id === oldest._id ? { ...c, isPreferred: true } : c));
};
