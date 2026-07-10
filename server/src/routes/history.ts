import { Router, Response } from 'express';
import OutfitHistory from '../models/OutfitHistory';
import User from '../models/User';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// Safety bound, not a functional limit — caps the payload for very heavy users.
// Mirrors MAX_ENTRIES in the client's outfitHistory.ts.
const MAX_ENTRIES = 2000;

// Cap ranker training negatives per entry so the document stays small; the
// client sends at most topK−1 (=2) today.
const MAX_NEGATIVES = 5;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** GET /api/history — entries + clear tombstone for the authenticated user */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [entries, user] = await Promise.all([
      OutfitHistory
        .find({ userId: req.userId })
        .sort({ wornAt: -1 })
        .limit(MAX_ENTRIES)
        .lean(),
      User.findById(req.userId).select('historyLastClearedAt').lean(),
    ]);

    res.json({
      clearedAt: user?.historyLastClearedAt?.toISOString() ?? null,
      entries: entries.map(e => ({
        id:             e.clientId,
        wornAt:         e.wornAt.toISOString(),
        closetId:       e.closetId,
        closetName:     e.closetName,
        articleIds:     e.articleIds,
        articleSummary: e.articleSummary,
        // ML-ranker instrumentation — omitted for entries that predate it
        ...(e.context   ? { context:   e.context }   : {}),
        ...(e.engine    ? { engine:    e.engine }    : {}),
        ...(e.negatives?.length ? { negatives: e.negatives } : {}),
      })),
    });
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

    // ML-ranker instrumentation: optional, validated loosely (shape, not values)
    // and silently dropped when malformed — a bad context must never block the
    // wear log itself. Mongoose sub-schema validation handles field types.
    const context = isPlainObject(req.body.context) && typeof req.body.context.feelsLikeF === 'number'
      ? req.body.context
      : undefined;
    const engine = isPlainObject(req.body.engine) && typeof req.body.engine.score === 'number'
      ? req.body.engine
      : undefined;
    const negatives = Array.isArray(req.body.negatives)
      ? req.body.negatives
          .filter((n: unknown) =>
            isPlainObject(n) && Array.isArray((n as { articleIds?: unknown }).articleIds))
          .slice(0, MAX_NEGATIVES)
      : undefined;

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
      { $setOnInsert: {
        userId: req.userId, clientId: id, wornAt: wornAtDate, closetId, closetName,
        articleIds: articleIds ?? [], articleSummary: articleSummary ?? '',
        ...(context   ? { context }   : {}),
        ...(engine    ? { engine }    : {}),
        ...(negatives?.length ? { negatives } : {}),
      } },
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

/** DELETE /api/history?confirm=true — clear all entries and stamp the tombstone */
router.delete('/', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.query.confirm !== 'true') {
    res.status(400).json({ error: 'Pass ?confirm=true to clear all history' });
    return;
  }
  try {
    const clearedAt = new Date();
    await Promise.all([
      OutfitHistory.deleteMany({ userId: req.userId }),
      User.findByIdAndUpdate(req.userId, { historyLastClearedAt: clearedAt }),
    ]);
    res.sendStatus(204);
  } catch (err) {
    console.error('[history] clear error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
