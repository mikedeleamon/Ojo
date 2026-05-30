import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';
import { signToken } from '../lib/jwt';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  generateResetToken,
  hashResetToken,
  buildResetDeepLink,
  sendResetEmail,
} from '../lib/passwordReset';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: 'identifier and password are required' });
      return;
    }
    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    res.json({
      token: signToken(user.id, user.tokenVersion),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, username, email, password, birthday } = req.body;
    if (!firstName || !lastName || !username || !email || !password) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }
    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      res.status(409).json({ error: 'Email or username already in use' });
      return;
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName,
      lastName,
      username,
      email: email.toLowerCase(),
      password: hashed,
      birthday: birthday ?? '',
    });
    res.status(201).json({
      token: signToken(user.id, user.tokenVersion),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
    });
  } catch (err) {
    console.error('[auth] signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always returns 204, regardless of whether the email is registered, so the
 * endpoint cannot be used to enumerate accounts.
 */
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const { raw, hash, expiresAt } = generateResetToken();
      user.resetPasswordTokenHash = hash;
      user.resetPasswordExpires   = expiresAt;
      await user.save();

      try {
        await sendResetEmail(user.email, buildResetDeepLink(raw));
      } catch (err) {
        // Never let email failures leak to the client.
        console.error('[auth] sendResetEmail failed:', err);
      }
    }

    res.sendStatus(204);
  } catch (err) {
    console.error('[auth] forgot-password error:', err);
    // Still 204 — same response for failure as for unknown email.
    res.sendStatus(204);
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 *
 * Verifies the SHA-256 hash of the supplied token against any non-expired
 * user, sets the new password, and bumps tokenVersion to revoke other
 * sessions.
 */
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ error: 'token and newPassword are required' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const tokenHash = hashResetToken(String(token));
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires:   { $gt: new Date() },
    }).select('+resetPasswordTokenHash +resetPasswordExpires');

    if (!user) {
      res.status(400).json({ error: 'Reset link is invalid or has expired' });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires   = undefined;
    await user.save();

    res.json({
      token: signToken(user.id, user.tokenVersion),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
    });
  } catch (err) {
    console.error('[auth] reset-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('tokenVersion').lean();
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ token: signToken(String(user._id), user.tokenVersion) });
  } catch (err) {
    console.error('[auth] refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
