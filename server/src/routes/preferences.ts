import { Router, Response } from 'express';
import UserPreferences from '../models/UserPreferences';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const EMPTY_PROFILE = {
  colors: {}, fabrics: {}, categories: {}, colorPairs: {}, totalOutfits: 0,
};

/** GET /api/preferences — return the user's preference profile */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const prefs = await UserPreferences.findOne({ userId: req.userId }).lean();
    res.json(prefs
      ? { colors: prefs.colors, fabrics: prefs.fabrics, categories: prefs.categories, colorPairs: prefs.colorPairs, totalOutfits: prefs.totalOutfits }
      : EMPTY_PROFILE,
    );
  } catch (err) {
    console.error('[preferences] get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /api/preferences — upsert the full preference profile */
router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { colors, fabrics, categories, colorPairs, totalOutfits } = req.body;
    await UserPreferences.findOneAndUpdate(
      { userId: req.userId },
      { $set: { colors: colors ?? {}, fabrics: fabrics ?? {}, categories: categories ?? {}, colorPairs: colorPairs ?? {}, totalOutfits: totalOutfits ?? 0 } },
      { upsert: true },
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('[preferences] update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
