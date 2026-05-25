import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import User from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('tokenVersion').lean();
    if (!user || (payload.ver ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
