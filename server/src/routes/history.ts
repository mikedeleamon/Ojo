import { Router, Response } from 'express';
import OutfitHistory from '../models/OutfitHistory';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// Safety bound, not a functional limit — caps the payload for very heavy users.
// Mirrors MAX_ENTRIES in the client's outfitHistory.ts.
const MAX_ENTRIES = 2000;

/** GET /api/history — entries for the authenticated user, newest first (capped) */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entries = await OutfitHistory
      .find({ userId: req.userId })
      .sort({ wornAt: -1 })
      .limit(MAX_ENTRIES)
      .lean();

    // Return in the client OutfitHistoryEntry shape
    res.json(entries.map(e => ({
      id:             e.clientId,
      wornAt:         e.wornAt.toISOString(),
      closetId:       e.closetId,
      closetName:     e.closetName,
      articleIds:     e.articleIds,
      articleSummary: e.articleSummary,
    })));
  } catch (err) {
    console.error('[history] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/history — create a new entry; silently ignores duplicate clientId */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, wornAt, closetId, closetName, articleIds, articleSummary } = req.body;
    if (!id || !wornAt || !closetId || !closetName) {
      res.status(400).json({ error: 'id, wornAt, closetId, and closetName are required' });
      return;
    }

    const wornAtDate = new Date(wornAt);
    if (isNaN(wornAtDate.getTime())) {
      res.status(400).json({ error: 'wornAt must be a valid date' });
      return;
    }
    // Small skew tolerance so a client clock slightly ahead of the server
    // doesn't get rejected.
    if (wornAtDate.getTime() > Date.now() + 5 * 60 * 1000) {
      res.status(400).json({ error: 'wornAt cannot be in the future' });
      return;
    }

    const entry = await OutfitHistory.findOneAndUpdate(
      { userId: req.userId, clientId: id },
      { $setOnInsert: { userId: req.userId, clientId: id, wornAt: wornAtDate, closetId, closetName, articleIds: articleIds ?? [], articleSummary: articleSummary ?? '' } },
      { upsert: true, new: true },
    );
    res.status(201).json({ id: entry.clientId });
  } catch (err) {
    console.error('[history] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/history/:id — delete a single entry by clientId */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await OutfitHistory.findOneAndDelete({ userId: req.userId, clientId: req.params.id });
    res.sendStatus(204);
  } catch (err) {
    console.error('[history] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/history?confirm=true — clear all entries for the authenticated user */
router.delete('/', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.query.confirm !== 'true') {
    res.status(400).json({ error: 'Pass ?confirm=true to clear all history' });
    return;
  }
  try {
    await OutfitHistory.deleteMany({ userId: req.userId });
    res.sendStatus(204);
  } catch (err) {
    console.error('[history] clear error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
