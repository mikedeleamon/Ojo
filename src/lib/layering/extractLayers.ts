import type { OutfitSlot } from '../outfit/types';

/**
 * Pulls the first base, mid, and outer slot from an outfit using the role
 * already assigned by outfitEngine. Bottoms, footwear, and accessories are
 * layer-neutral and ignored here.
 */
export const extractLayers = (
  slots: OutfitSlot[],
): { base: OutfitSlot | null; mid: OutfitSlot | null; outer: OutfitSlot | null } => {
  let base: OutfitSlot | null = null;
  let mid: OutfitSlot | null = null;
  let outer: OutfitSlot | null = null;

  for (const slot of slots) {
    if ((slot.role === 'top' || slot.role === 'fullBody') && !base) base = slot;
    if (slot.role === 'midLayer' && !mid) mid = slot;
    if (slot.role === 'outerwear' && !outer) outer = slot;
  }

  return { base, mid, outer };
};
