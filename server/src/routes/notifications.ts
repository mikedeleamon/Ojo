import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

// Register or update push token
router.post('/token', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== 'string') {
      res.status(400).json({ error: 'pushToken is required' });
      return;
    }
    await User.findByIdAndUpdate(req.userId, { pushToken });
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications] token save error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification settings
router.get('/settings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('notificationSettings');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user.notificationSettings);
  } catch (err) {
    console.error('[notifications] settings get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification settings
router.put('/settings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      morningBriefEnabled,
      morningBriefHourUTC,
      weatherChangeEnabled,
      tempSwingEnabled,
      tempSwingThresholdF,
      closetGapEnabled,
      weeklyRecapEnabled,
      weeklyRecapDay,
    } = req.body;

    await User.findByIdAndUpdate(req.userId, {
      notificationSettings: {
        morningBriefEnabled:  Boolean(morningBriefEnabled),
        morningBriefHourUTC:  Number(morningBriefHourUTC)  || 12,
        weatherChangeEnabled: Boolean(weatherChangeEnabled),
        tempSwingEnabled:     Boolean(tempSwingEnabled),
        tempSwingThresholdF:  Number(tempSwingThresholdF)  || 20,
        closetGapEnabled:     Boolean(closetGapEnabled),
        weeklyRecapEnabled:   Boolean(weeklyRecapEnabled),
        weeklyRecapDay:       Number(weeklyRecapDay)       || 0,
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications] settings update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
