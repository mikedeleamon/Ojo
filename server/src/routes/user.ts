import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Closet from '../models/Closet';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId).select('username email');
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ username: user.username, email: user.email });
});

router.put('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  const { username, email } = req.body;
  const conflict = await User.findOne({
    _id: { $ne: req.userId },
    $or: [{ email: email?.toLowerCase() }, { username }],
  });
  if (conflict) { res.status(409).json({ error: 'Email or username already in use' }); return; }
  await User.findByIdAndUpdate(req.userId, {
    ...(username && { username }),
    ...(email && { email: email.toLowerCase() }),
  });
  res.sendStatus(204);
});

router.put('/password', async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' }); return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' }); return;
  }
  const user = await User.findById(req.userId);
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    res.status(401).json({ error: 'Current password is incorrect' }); return;
  }
  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.sendStatus(204);
});

router.delete('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  await Promise.all([
    User.findByIdAndDelete(req.userId),
    Closet.deleteMany({ userId: req.userId }),
  ]);
  res.sendStatus(204);
});

router.get('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId).select('settings');
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user.settings);
});

router.put('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  await User.findByIdAndUpdate(req.userId, { settings: req.body });
  res.sendStatus(204);
});

export default router;
