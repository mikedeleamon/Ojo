import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const signToken = (userId: string): string =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });

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
      token: signToken(user.id),
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
      token: signToken(user.id),
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      settings: user.settings,
    });
  } catch (err) {
    console.error('[auth] signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ token: signToken(user.id) });
  } catch (err) {
    console.error('[auth] refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
