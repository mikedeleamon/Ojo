import { Router, Response } from 'express';
import Closet from '../models/Closet';
import { requireAuth, AuthRequest } from '../middleware/auth';

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
    await Closet.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.sendStatus(204);
  } catch (err) {
    console.error('[closets] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/preferred', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Closet.updateMany({ userId: req.userId }, { isPreferred: false });
    const closet = await Closet.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isPreferred: true },
      { new: true },
    );
    if (!closet) { res.status(404).json({ error: 'Closet not found' }); return; }
    res.json(closet);
  } catch (err) {
    console.error('[closets] preferred update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:closetId/articles', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const closet = await Closet.findOne({ _id: req.params.closetId, userId: req.userId });
    if (!closet) { res.status(404).json({ error: 'Closet not found' }); return; }
    closet.articles.push(req.body);
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
    Object.assign(article, req.body);
    await closet.save();
    res.json(closet);
  } catch (err) {
    console.error('[closets] update article error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:closetId/articles/:articleId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const closet = await Closet.findOne({ _id: req.params.closetId, userId: req.userId });
    if (!closet) { res.status(404).json({ error: 'Closet not found' }); return; }
    closet.articles.pull({ _id: req.params.articleId });
    await closet.save();
    res.json(closet);
  } catch (err) {
    console.error('[closets] delete article error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
