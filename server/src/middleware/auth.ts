import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import User from '../models/User';

export interface AuthRequest extends Request {
  userId?: string;
  /**
   * Whether the account holds the `pro` entitlement, mirrored from RevenueCat
   * by routes/revenuecat.ts. Resolved here from the same document lookup that
   * checks tokenVersion, so the free-tier caps in routes/closets.ts cost no
   * extra query.
   */
  isPro?: boolean;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  // Idempotent: several routers mount requireAuth themselves and are also
  // mounted behind it in index.ts (so the per-user rate limiters have a userId
  // to key on).
  // Without this guard that pairing would cost a second identical user lookup
  // on every request to those routers.
  if (req.userId) {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub)
      .select('tokenVersion isPro')
      .lean();
    if (!user || (payload.ver ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = payload.sub;
    req.isPro = !!user.isPro;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
