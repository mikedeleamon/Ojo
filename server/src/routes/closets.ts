import { Router, Response } from 'express';
import Closet from '../models/Closet';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { uploadToR2, deleteFromR2, deleteManyFromR2, UploadValidationError } from '../lib/r2';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const closets = await Closet.find({ userId: req.userId }).sort({ createdAt: 1 });
    res.json(closets);
  } catch (err) {
    console.error('[closets] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }
    const closet = await Closet.create({ name, userId: req.userId });
    res.status(201).json(closet);
  } catch (err) {
    console.error('[closets] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const closet = await Closet.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { name: req.body.name },
      { new: true },
    );
    if (!closet) { res.status(404).json({ error: 'Closet not found' }); return; }
    res.json(closet);
  } catch (err) {
    console.error('[closets] update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // findOneAndDelete hands back the deleted document, so the articles' image
    // URLs are still available here — the same R2 cleanup the single-article
    // delete does, applied to every article the closet held.
    const closet = await Closet.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.sendStatus(204);

    if (closet) {
      deleteManyFromR2(closet.articles.map(a => a.imageUrl)).catch(err =>
        console.error('[closets] R2 cleanup error:', err),
      );
    }
  } catch (err) {
    console.error('[closets] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/preferred', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const target = await Closet.findOne({ _id: req.params.id, userId: req.userId });
    if (!target) { res.status(404).json({ error: 'Closet not found' }); return; }

    // Toggle: tapping "preferred" on the already-preferred closet clears it so
    // the user can have no preferred closet; otherwise this becomes the sole
    // preferred one. Either way every other closet is cleared first.
    const makePreferred = !target.isPreferred;
    await Closet.updateMany({ userId: req.userId }, { isPreferred: false });
    const closet = await Closet.findByIdAndUpdate(
      target._id,
      { isPreferred: makePreferred },
      { new: true },
    );
    res.json(closet);
  } catch (err) {
    console.error('[closets] preferred update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:closetId/upload-image', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { base64 } = req.body;
    if (typeof base64 !== 'string' || !base64.startsWith('data:')) {
      res.status(400).json({ error: 'Valid base64 data URI is required' });
      return;
    }
    const imageUrl = await uploadToR2(base64);
    res.json({ imageUrl });
  } catch (err) {
    // Type and size rejections are the caller's to fix, not server faults —
    // answering 500 for them hid a wide-open upload behind a generic error.
    if (err instanceof UploadValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[closets] upload-image error:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

const ARTICLE_EDITABLE_FIELDS = [
  'name',
  'clothingType',
  'topOrBottom',
  'clothingCategory',
  'clothingCategories',
  'fabricType',
  'color',
  'gender',
  'isAccessory',
  'bodyZone',
  'merchant',
  'purchasePrice',
  'imageUrl',
  'detectedGarmentType',
  'detectedColors',
  'detectedFabric',
  'identificationConfidence',
] as const;

router.post('/:closetId/articles', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const closet = await Closet.findOne({ _id: req.params.closetId, userId: req.userId });
    if (!closet) { res.status(404).json({ error: 'Closet not found' }); return; }

    // Whitelist incoming fields so callers cannot plant arbitrary keys on the subdoc
    const articleInput: Record<string, unknown> = {};
    for (const field of ARTICLE_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        articleInput[field] = req.body[field];
      }
    }
    closet.articles.push(articleInput);
    await closet.save();
    res.status(201).json(closet);
  } catch (err) {
    console.error('[closets] add article error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:closetId/articles/:articleId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const closet = await Closet.findOne({ _id: req.params.closetId, userId: req.userId });
    if (!closet) { res.status(404).json({ error: 'Closet not found' }); return; }
    const article = closet.articles.id(req.params.articleId);
    if (!article) { res.status(404).json({ error: 'Article not found' }); return; }

    // If imageUrl is being changed, delete old R2 image
    const oldImageUrl = article.imageUrl;

    for (const field of ARTICLE_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        (article as unknown as Record<string, unknown>)[field] = req.body[field];
      }
    }

    await closet.save();
    res.json(closet);

    // Clean up the old R2 image AFTER the save is durable. Deleting first meant
    // a failing save (validation, a Mongo blip) left the document still
    // pointing at an object that no longer existed — a permanently broken image
    // with nothing to reconcile it, since the route answers 500 and the client
    // retries against the same stale URL.
    if (req.body.imageUrl && oldImageUrl && oldImageUrl !== req.body.imageUrl && !oldImageUrl.startsWith('data:')) {
      deleteFromR2(oldImageUrl).catch(err => console.error('[closets] R2 cleanup error:', err));
    }
  } catch (err) {
    console.error('[closets] update article error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:closetId/articles/:articleId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const closet = await Closet.findOne({ _id: req.params.closetId, userId: req.userId });
    if (!closet) { res.status(404).json({ error: 'Closet not found' }); return; }
    const article = closet.articles.id(req.params.articleId);
    // Read the URL off the subdoc before pulling it — the reference is detached
    // once it leaves the array.
    const imageUrl = article?.imageUrl;

    closet.articles.pull({ _id: req.params.articleId });
    await closet.save();
    res.json(closet);

    // Same ordering rule as the update handler above: the object is only
    // unreachable once the removal is durable. Deleting before the save meant a
    // failed save left the article in the closet with its image already gone.
    if (imageUrl && !imageUrl.startsWith('data:')) {
      deleteFromR2(imageUrl).catch(err => console.error('[closets] R2 cleanup error:', err));
    }
  } catch (err) {
    console.error('[closets] delete article error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
