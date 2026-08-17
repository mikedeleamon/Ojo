import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import Closet from '../models/Closet';
import OutfitHistory from '../models/OutfitHistory';
import Trip from '../models/Trip';
import TripFitPlan from '../models/TripFitPlan';
import { signToken } from '../lib/jwt';
import { deleteManyFromR2 } from '../lib/r2';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('username email');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    // Surfaced here so a cold start with a remembered token still learns it has
    // to run the age gate — the login response that would have carried the flag
    // happened on some earlier launch.
    res.json({
      username: user.username,
      email: user.email,
      needsAgeVerification: !req.ageVerified,
    });
  } catch (err) {
    console.error('[user] me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/check-username?username=foo
 * Lightweight availability check used by the Profile screen while editing.
 * Returns { available } — false when another account already owns the name.
 * Excludes the caller so re-saving your own current username reads as available.
 */
router.get('/check-username', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
    if (!username) { res.status(400).json({ error: 'username is required' }); return; }
    const exists = await User.exists({ username, _id: { $ne: req.userId } });
    res.json({ available: !exists });
  } catch (err) {
    console.error('[user] check-username error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
  } catch (err) {
    console.error('[user] profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/password', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();
    // Return a fresh token so the client stays logged in with the new version
    res.json({ token: signToken(user.id, user.tokenVersion) });
  } catch (err) {
    console.error('[user] password update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Read the image URLs *before* the closets are deleted. They are the only
    // record of which R2 objects belong to this user, so once the documents are
    // gone the images are unreachable and would sit in the bucket forever.
    const closets = await Closet.find({ userId: req.userId }).select('articles.imageUrl').lean();
    const imageUrls = closets.flatMap(c => (c.articles ?? []).map(a => a.imageUrl));

    await Promise.all([
      User.findByIdAndDelete(req.userId),
      Closet.deleteMany({ userId: req.userId }),
      OutfitHistory.deleteMany({ userId: req.userId }),
      Trip.deleteMany({ userId: req.userId }),
      TripFitPlan.deleteMany({ userId: req.userId }),
    ]);
    res.sendStatus(204);

    // The account is already gone, which is what the user asked for. Purging
    // object storage happens after the response so a slow or unavailable R2
    // can't turn a successful deletion into a 500.
    deleteManyFromR2(imageUrls).catch(err =>
      console.error('[user] R2 cleanup error after account deletion:', err),
    );
  } catch (err) {
    console.error('[user] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('settings');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user.settings);
  } catch (err) {
    console.error('[user] settings get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const SETTINGS_EDITABLE_FIELDS = [
  'clothingStyle',
  'location',
  'lat',
  'lon',
  'temperatureScale',
  'hiTempThreshold',
  'lowTempThreshold',
  'humidityPreference',
  'gender',
  'savedLocations',
  'tripModeEnabled',
  'tripModeRadiusMi',
] as const;

router.put('/settings', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Merge individual fields rather than replacing the whole sub-document.
    // Whitelist keys so callers cannot write arbitrary settings paths.
    const updateFields: Record<string, unknown> = {};
    for (const field of SETTINGS_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updateFields[`settings.${field}`] = req.body[field];
      }
    }
    if (Object.keys(updateFields).length === 0) {
      res.sendStatus(204);
      return;
    }
    await User.findByIdAndUpdate(req.userId, { $set: updateFields });
    res.sendStatus(204);
  } catch (err) {
    console.error('[user] settings update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
